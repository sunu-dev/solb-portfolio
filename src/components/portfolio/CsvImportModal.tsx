'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { BROKER_LABELS, BROKER_ORDER, type Broker } from '@/config/constants';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { logApiCall } from '@/lib/apiLogger';
import { buildPortfolioImportChanges } from '@/lib/portfolioReconciliation';
import { logFeatureFirstUse } from '@/lib/tourTelemetry';
import { usePortfolioStore } from '@/store/portfolioStore';
import { isBlockedLeverage } from '@/utils/leverageGuard';
import {
  applyPortfolioCsvImport,
  buildPortfolioImportTemplateCsv,
  parsePortfolioImportCsv,
  reconcilePortfolioCsvImport,
  type CsvTargetCategory,
  type PortfolioCsvParseResult,
  type PortfolioCsvReconciliationRow,
} from '@/utils/portfolioCsvImport';

interface Props {
  onClose: () => void;
}

type Step = 'select' | 'review' | 'done';

const STATUS_COPY: Record<PortfolioCsvReconciliationRow['status'], string> = {
  new: '새 항목',
  changed: '변경 있음',
  unchanged: '그대로',
  needs_review: '확인 필요',
};

const REASON_COPY: Partial<Record<PortfolioCsvReconciliationRow['reason'], string>> = {
  missing_values: '보유 종목은 수량과 평균단가가 0보다 커야 해요.',
  broker_required: '증권사를 선택해야 기존 기록과 안전하게 비교할 수 있어요.',
  duplicate_in_upload: '같은 증권사·종목이 파일에 중복되어 있어요.',
  multiple_existing_matches: '기존 기록이 여러 개라 자동으로 고를 수 없어요.',
  unassigned_existing_match: '기존 기록의 증권사가 비어 있어 직접 확인이 필요해요.',
  category_change: '보유·관심 구분이 기존 기록과 달라 직접 확인이 필요해요.',
  sold_position_match: '정리한 종목과 같아 자동으로 다시 등록하지 않아요.',
};

function actionableIndices(rows: PortfolioCsvReconciliationRow[]): Set<number> {
  return new Set(rows
    .filter((row) => (row.status === 'new' || row.status === 'changed')
      && !isBlockedLeverage(row.draft.symbol, row.draft.name))
    .map((row) => row.inputIndex));
}

function downloadText(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function decodeCsvFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('euc-kr').decode(buffer);
  }
}

export default function CsvImportModal({ onClose }: Props) {
  const stocks = usePortfolioStore((state) => state.stocks);
  const commitPortfolioImport = usePortfolioStore((state) => state.commitPortfolioImport);
  const restoreLastPortfolioImport = usePortfolioStore((state) => state.restoreLastPortfolioImport);
  const syncStatus = usePortfolioStore((state) => state.portfolioSyncStatus);
  const cloudLoadStatus = usePortfolioStore((state) => state.portfolioCloudLoadStatus);
  const [step, setStep] = useState<Step>('select');
  const [parsed, setParsed] = useState<PortfolioCsvParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [fallbackBroker, setFallbackBroker] = useState<Broker | ''>('');
  const [fallbackCategory, setFallbackCategory] = useState<CsvTargetCategory>('investing');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState({ added: 0, updated: 0, skipped: 0 });
  const [restored, setRestored] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef(0);
  const flowIdRef = useRef('');
  useFocusTrap(true, dialogRef, onClose);

  useEffect(() => {
    startedAtRef.current = Date.now();
    flowIdRef.current = crypto.randomUUID();
    void logApiCall('portfolio_import_started', undefined, {
      source: 'csv',
      flowId: flowIdRef.current,
    });
  }, []);

  const reconciliationRows = useMemo(
    () => parsed
      ? reconcilePortfolioCsvImport(parsed.rows, stocks, fallbackBroker, fallbackCategory)
      : [],
    [fallbackBroker, fallbackCategory, parsed, stocks],
  );
  const allActionable = useMemo(() => actionableIndices(reconciliationRows), [reconciliationRows]);
  const counts = useMemo(() => reconciliationRows.reduce((summary, row) => ({
    ...summary,
    [row.status]: summary[row.status] + 1,
  }), { new: 0, changed: 0, unchanged: 0, needs_review: 0 }), [reconciliationRows]);
  const selectableCount = reconciliationRows.filter((row) =>
    selected.has(row.inputIndex)
    && (row.status === 'new' || row.status === 'changed')
    && !isBlockedLeverage(row.draft.symbol, row.draft.name)).length;
  const missingBrokerCount = parsed?.rows.filter((row) => !row.broker).length || 0;
  const mutationBlocked = cloudLoadStatus === 'loading'
    || cloudLoadStatus === 'error'
    || syncStatus === 'conflict'
    || syncStatus === 'storage-error';

  const selectForContext = (broker: Broker | '', category: CsvTargetCategory) => {
    if (!parsed) return;
    setSelected(actionableIndices(
      reconcilePortfolioCsvImport(parsed.rows, stocks, broker, category),
    ));
  };

  const handleFile = async (file: File) => {
    setError('');
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('CSV 파일만 선택해주세요.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setError('CSV 파일은 1MB 이하만 가져올 수 있어요.');
      return;
    }

    try {
      const nextParsed = parsePortfolioImportCsv(await decodeCsvFile(file));
      const nextRows = reconcilePortfolioCsvImport(
        nextParsed.rows,
        stocks,
        fallbackBroker,
        fallbackCategory,
      );
      setParsed(nextParsed);
      setFileName(file.name);
      setSelected(actionableIndices(nextRows));
      setStep('review');
      const reviewCounts = nextRows.reduce((summary, row) => ({
        ...summary,
        [row.status]: summary[row.status] + 1,
      }), { new: 0, changed: 0, unchanged: 0, needs_review: 0 });
      void logApiCall('portfolio_import_reviewed', undefined, {
        source: 'csv',
        flowId: flowIdRef.current,
        ...reviewCounts,
        elapsedMs: Date.now() - startedAtRef.current,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'CSV 파일을 읽지 못했어요.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const toggleSelect = (inputIndex: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(inputIndex)) next.delete(inputIndex);
      else next.add(inputIndex);
      return next;
    });
  };

  const applyImport = () => {
    if (mutationBlocked) {
      setError('클라우드 기록 상태가 바뀌었어요. 현재 기록을 확인한 뒤 다시 시도해주세요.');
      return;
    }
    const leverageCount = reconciliationRows.filter((row) =>
      selected.has(row.inputIndex)
      && isBlockedLeverage(row.draft.symbol, row.draft.name)).length;
    const safeSelection = new Set([...selected].filter((inputIndex) => {
      const row = reconciliationRows.find((candidate) => candidate.inputIndex === inputIndex);
      return row && !isBlockedLeverage(row.draft.symbol, row.draft.name);
    }));
    const result = applyPortfolioCsvImport(stocks, reconciliationRows, safeSelection);
    const changes = buildPortfolioImportChanges(
      reconciliationRows,
      safeSelection,
      (row) => ({ broker: row.broker, targetCategory: row.targetCategory }),
    );
    // 파일명에는 계좌번호·이름이 포함될 수 있어 영구 기록에는 저장하지 않는다.
    const checkpoint = commitPortfolioImport(result.stocks, 'CSV 가져오기', {
      summary: result.summary,
      changes,
      excludedCount: leverageCount + (parsed?.skippedSold || 0),
    });

    setCheckpointId(checkpoint);
    setResultSummary({
      added: result.summary.added,
      updated: result.summary.updated,
      skipped: result.summary.needsReview
        + result.summary.unchanged
        + result.summary.skippedLimit
        + leverageCount
        + (parsed?.skippedSold || 0),
    });
    setRestored(false);
    setStep('done');
    logFeatureFirstUse('safe-import');
    void logApiCall('portfolio_import_approved', undefined, {
      source: 'csv',
      flowId: flowIdRef.current,
      selectedCount: safeSelection.size,
      added: result.summary.added,
      updated: result.summary.updated,
      unchanged: result.summary.unchanged,
      needsReview: result.summary.needsReview,
      elapsedMs: Date.now() - startedAtRef.current,
      underThreeMinutes: Date.now() - startedAtRef.current <= 3 * 60 * 1000,
    });
  };

  const restoreImport = () => {
    if (mutationBlocked) {
      setError('클라우드 기록 상태가 바뀌어 되돌리기를 멈췄어요. 현재 기록을 먼저 확인해주세요.');
      return;
    }
    if (!checkpointId || !restoreLastPortfolioImport(checkpointId)) return;
    setRestored(true);
    logFeatureFirstUse('import-restore');
    void logApiCall('portfolio_import_restored', undefined, {
      source: 'csv',
      flowId: flowIdRef.current,
    });
  };

  const reset = () => {
    setStep('select');
    setParsed(null);
    setFileName('');
    setError('');
    setSelected(new Set());
    setCheckpointId(null);
    setRestored(false);
    startedAtRef.current = Date.now();
    flowIdRef.current = crypto.randomUUID();
    void logApiCall('portfolio_import_started', undefined, {
      source: 'csv',
      flowId: flowIdRef.current,
      sourceAction: 'reset',
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-title"
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 20,
          background: 'var(--surface, #FFFFFF)',
        }}
      >
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div id="csv-import-title" style={{ color: 'var(--text-primary, #191F28)', fontSize: 17, fontWeight: 700 }}>
              CSV로 가져오기
            </div>
            <div style={{ marginTop: 3, color: 'var(--text-tertiary, #8B95A1)', fontSize: 12 }}>
              기존 기록과 비교한 뒤 선택한 변경만 반영해요
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="CSV 가져오기 닫기"
            style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', border: 0, background: 'none', color: 'var(--text-tertiary, #8B95A1)', cursor: 'pointer' }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {step === 'select' && (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '42px 20px',
                  borderRadius: 16,
                  border: '2px dashed var(--border-strong, #D1D6DB)',
                  background: 'var(--bg-subtle, #F8F9FA)',
                  color: 'var(--text-primary, #191F28)',
                  cursor: 'pointer',
                }}
              >
                <Upload size={32} color="var(--brand-primary, #0E7C7B)" aria-hidden="true" />
                <div style={{ marginTop: 10, fontSize: 15, fontWeight: 700 }}>CSV 파일 선택</div>
                <div style={{ marginTop: 5, color: 'var(--text-tertiary, #8B95A1)', fontSize: 12 }}>
                  UTF-8·한글 Excel CSV · 최대 1MB · 100행
                </div>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />

              <button
                type="button"
                onClick={() => downloadText(
                  buildPortfolioImportTemplateCsv(),
                  'joobi-portfolio-template.csv',
                  'text/csv;charset=utf-8',
                )}
                style={{
                  width: '100%',
                  marginTop: 12,
                  padding: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  borderRadius: 11,
                  border: '1px solid var(--border-strong, #E5E8EB)',
                  background: 'var(--surface, #FFFFFF)',
                  color: 'var(--text-secondary, #4E5968)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={15} aria-hidden="true" />
                입력 양식 받기
              </button>

              <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'var(--bg-subtle, #F8F9FA)', color: 'var(--text-secondary, #4E5968)', fontSize: 12, lineHeight: 1.7 }}>
                필수 열은 <strong>종목코드·수량·평균단가</strong>예요. 주비에서 내보낸 CSV도 그대로 읽을 수 있고, 정리 종목은 실수로 재등록되지 않게 자동 제외해요.
              </div>

              {error && (
                <div role="alert" style={{ marginTop: 12, padding: 12, display: 'flex', gap: 8, borderRadius: 10, background: 'rgba(239,68,82,0.07)', color: 'var(--color-danger, #EF4452)', fontSize: 12, lineHeight: 1.5 }}>
                  <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )}
            </>
          )}

          {step === 'review' && parsed && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: 12, borderRadius: 12, background: 'var(--bg-subtle, #F8F9FA)' }}>
                <FileSpreadsheet size={22} color="var(--brand-primary, #0E7C7B)" aria-hidden="true" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', color: 'var(--text-primary, #191F28)', fontSize: 13, fontWeight: 700, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
                  <div style={{ marginTop: 2, color: 'var(--text-tertiary, #8B95A1)', fontSize: 11 }}>{parsed.rows.length}개 행을 확인했어요</div>
                </div>
              </div>

              {missingBrokerCount > 0 && (
                <label style={{ display: 'block', marginBottom: 12, color: 'var(--text-secondary, #4E5968)', fontSize: 12, fontWeight: 700 }}>
                  증권사가 비어 있는 {missingBrokerCount}개 행
                  <select
                    value={fallbackBroker}
                    onChange={(event) => {
                      const broker = event.target.value as Broker | '';
                      setFallbackBroker(broker);
                      selectForContext(broker, fallbackCategory);
                    }}
                    style={{ width: '100%', minHeight: 42, marginTop: 6, padding: '8px 10px', border: '1px solid var(--border-strong, #E5E8EB)', borderRadius: 10, background: 'var(--surface, #FFFFFF)', color: 'var(--text-primary, #191F28)', fontSize: 13 }}
                  >
                    <option value="">증권사 선택</option>
                    {BROKER_ORDER.map((broker) => (
                      <option key={broker} value={broker}>{BROKER_LABELS[broker]}</option>
                    ))}
                  </select>
                </label>
              )}

              {parsed.rows.some((row) => row.category === null) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {([['investing', '투자 중'], ['watching', '관심 종목']] as const).map(([category, label]) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setFallbackCategory(category);
                        selectForContext(fallbackBroker, category);
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: 10,
                        border: 0,
                        background: fallbackCategory === category ? 'var(--text-primary, #191F28)' : 'var(--bg-subtle, #F2F4F6)',
                        color: fallbackCategory === category ? 'var(--text-inverse, #FFFFFF)' : 'var(--text-secondary, #4E5968)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 12, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, borderRadius: 12, background: 'var(--bg-subtle, #F8F9FA)' }}>
                {([
                  ['새 항목', counts.new],
                  ['변경', counts.changed],
                  ['그대로', counts.unchanged],
                  ['확인 필요', counts.needs_review],
                ] as const).map(([label, count], index) => (
                  <div key={label} style={{ textAlign: 'center', borderLeft: index ? '1px solid var(--border-light, #E5E8EB)' : 0 }}>
                    <div style={{ color: 'var(--text-primary, #191F28)', fontSize: 14, fontWeight: 800 }}>{count}</div>
                    <div style={{ marginTop: 3, color: 'var(--text-tertiary, #8B95A1)', fontSize: 9 }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setSelected(selectableCount === allActionable.size ? new Set() : allActionable)}
                  style={{ border: 0, background: 'none', color: 'var(--brand-primary, #0E7C7B)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {selectableCount === allActionable.size ? '전체 해제' : '변경 전체 선택'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reconciliationRows.map((row) => {
                  const actionable = row.status === 'new' || row.status === 'changed';
                  const blocked = isBlockedLeverage(row.draft.symbol, row.draft.name);
                  const isSelected = selected.has(row.inputIndex);
                  const detail = row.status === 'changed'
                    ? row.changes.map((change) => `${change.field === 'avgCost' ? '평단' : '수량'} ${change.before.toLocaleString()} → ${change.after.toLocaleString()}`).join(' · ')
                    : REASON_COPY[row.reason];

                  return (
                    <button
                      key={`${row.csvRowNumber}-${row.draft.symbol}`}
                      type="button"
                      disabled={!actionable || blocked}
                      onClick={() => toggleSelect(row.inputIndex)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        borderRadius: 12,
                        border: `1.5px solid ${row.status === 'needs_review' || blocked ? 'var(--color-warning, #FF9500)' : isSelected ? 'var(--brand-primary, #0E7C7B)' : 'var(--border-light, #E5E8EB)'}`,
                        background: isSelected ? 'var(--brand-primary-bg, rgba(14,124,123,0.06))' : 'var(--surface, #FFFFFF)',
                        opacity: row.status === 'unchanged' ? 0.68 : 1,
                        textAlign: 'left',
                        cursor: actionable && !blocked ? 'pointer' : 'default',
                      }}
                    >
                      <span style={{ width: 20, height: 20, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 6, background: isSelected ? 'var(--brand-primary, #0E7C7B)' : 'var(--bg-subtle, #F2F4F6)' }}>
                        {isSelected && <Check size={13} color="white" aria-hidden="true" />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', color: 'var(--text-primary, #191F28)', fontSize: 13, fontWeight: 700 }}>
                          {row.draft.name || row.draft.symbol}
                          <span style={{ color: 'var(--text-tertiary, #8B95A1)', fontSize: 11, fontWeight: 400 }}>{row.draft.symbol}</span>
                          <span style={{ color: row.status === 'needs_review' || blocked ? 'var(--color-warning, #FF9500)' : 'var(--brand-primary, #0E7C7B)', fontSize: 10 }}>
                            {blocked ? '반영 제한' : STATUS_COPY[row.status]}
                          </span>
                        </span>
                        <span style={{ display: 'block', marginTop: 5, color: 'var(--text-secondary, #4E5968)', fontSize: 11, lineHeight: 1.5 }}>
                          {row.broker ? BROKER_LABELS[row.broker] : '증권사 확인 필요'} · {row.targetCategory === 'investing' ? '투자 중' : '관심 종목'}
                          {detail ? ` · ${detail}` : ''}
                        </span>
                      </span>
                      <span style={{ color: 'var(--text-tertiary, #8B95A1)', fontSize: 10 }}>{row.csvRowNumber}행</span>
                    </button>
                  );
                })}
              </div>

              {parsed.issues.length > 0 && (
                <div role="note" style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(255,149,0,0.08)', color: 'var(--color-warning, #C96C00)', fontSize: 11, lineHeight: 1.6 }}>
                  {parsed.issues.slice(0, 3).map((issue) => (
                    <div key={`${issue.rowNumber}-${issue.message}`}>{issue.rowNumber ? `${issue.rowNumber}행 · ` : ''}{issue.message}</div>
                  ))}
                  {parsed.issues.length > 3 && <div>외 {parsed.issues.length - 3}건</div>}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={reset} style={{ flex: 1, padding: 12, border: 0, borderRadius: 12, background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #4E5968)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  다른 파일
                </button>
                <button
                  type="button"
                  onClick={applyImport}
                  disabled={selectableCount === 0 || mutationBlocked}
                  style={{ flex: 2, padding: 12, border: 0, borderRadius: 12, background: selectableCount > 0 && !mutationBlocked ? 'var(--brand-primary, #0E7C7B)' : 'var(--border-strong, #D1D6DB)', color: 'white', fontSize: 13, fontWeight: 700, cursor: selectableCount > 0 && !mutationBlocked ? 'pointer' : 'not-allowed' }}
                >
                  {selectableCount}개 변경 승인
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div style={{ padding: '28px 0 8px', textAlign: 'center' }}>
              {restored
                ? <RotateCcw size={42} color="var(--brand-primary, #0E7C7B)" aria-hidden="true" />
                : <CheckCircle2 size={42} color="var(--color-success, #34C759)" aria-hidden="true" />}
              <div style={{ marginTop: 14, color: 'var(--text-primary, #191F28)', fontSize: 17, fontWeight: 800 }}>
                {restored ? '가져오기 전 상태를 이 기기에 복구했어요' : 'CSV 변경을 이 기기에 반영했어요'}
              </div>
              {!restored && (
                <div style={{ marginTop: 8, color: 'var(--text-secondary, #4E5968)', fontSize: 13, lineHeight: 1.7 }}>
                  새 종목 {resultSummary.added}개 · 업데이트 {resultSummary.updated}개
                  {resultSummary.skipped > 0 ? ` · 미반영 ${resultSummary.skipped}개` : ''}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                {!restored && (
                  <button type="button" disabled={mutationBlocked} onClick={restoreImport} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid var(--border-strong, #E5E8EB)', background: 'var(--surface, #FFFFFF)', color: 'var(--text-secondary, #4E5968)', fontSize: 13, fontWeight: 700, cursor: mutationBlocked ? 'not-allowed' : 'pointer', opacity: mutationBlocked ? 0.5 : 1 }}>
                    되돌리기
                  </button>
                )}
                <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 12, border: 0, background: 'var(--brand-primary, #0E7C7B)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  완료
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
