'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileImage,
  GitCompareArrows,
  LoaderCircle,
  RotateCcw,
  ScanLine,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { OcrStock } from '@/app/api/portfolio/ocr/route';
import { isBlockedLeverage } from '@/utils/leverageGuard';
import { BROKER_LABELS, BROKER_ORDER, type Broker } from '@/config/constants';
import {
  applyPortfolioReconciliation,
  buildPortfolioImportChanges,
  reconcilePortfolioImport,
  type ImportHoldingDraft,
  type ReconciliationRow,
} from '@/lib/portfolioReconciliation';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { logApiCall } from '@/lib/apiLogger';
import { supabase } from '@/lib/supabase';
import { logFeatureFirstUse } from '@/lib/tourTelemetry';
import { OCR_DISABLED_COPY, OCR_UI_ENABLED } from '@/config/ocrFeature';

interface Props {
  onClose: () => void;
}

type Step = 'upload' | 'loading' | 'review' | 'done' | 'error';
type TargetCat = 'investing' | 'watching';

interface OcrError {
  title: string;
  hint: string;
  code?: string;
  canRetry: boolean;
}

// 편집 가능한 OCR 데이터
interface EditableStock extends OcrStock {
  editAvgCost: string;
  editShares: string;
}

const STATUS_COPY: Record<ReconciliationRow['status'], { label: string; detail: string }> = {
  new: { label: '새 항목', detail: '현재 기록에 없는 종목이에요.' },
  changed: { label: '변경 있음', detail: '기존값과 달라진 항목을 확인해보세요.' },
  unchanged: { label: '그대로', detail: '기존 기록과 값이 같아요.' },
  needs_review: { label: '확인 필요', detail: '값이나 계좌를 확인해야 반영할 수 있어요.' },
};

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function toImportDrafts(stocks: EditableStock[]): ImportHoldingDraft[] {
  return stocks.map((stock) => {
    const avgCost = Number(stock.editAvgCost);
    const shares = Number(stock.editShares);
    return {
      symbol: stock.symbol,
      name: stock.name,
      avgCost: Number.isFinite(avgCost) && avgCost > 0 ? avgCost : null,
      shares: Number.isFinite(shares) && shares > 0 ? shares : null,
      currency: stock.currency,
    };
  });
}

function actionableIndices(rows: ReconciliationRow[]): Set<number> {
  return new Set(rows
    .filter((row) => (row.status === 'new' || row.status === 'changed')
      && !isBlockedLeverage(row.draft.symbol, row.draft.name))
    .map((row) => row.inputIndex));
}

function formatHoldingValue(field: 'avgCost' | 'shares', value: number, currency: 'KRW' | 'USD'): string {
  if (field === 'shares') return `${value.toLocaleString()}주`;
  return currency === 'KRW' ? `${value.toLocaleString()}원` : `$${value.toLocaleString()}`;
}

export default function OcrImportModal({ onClose }: Props) {
  const stocks = usePortfolioStore(s => s.stocks);
  const commitPortfolioImport = usePortfolioStore(s => s.commitPortfolioImport);
  const restoreLastPortfolioImport = usePortfolioStore(s => s.restoreLastPortfolioImport);
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [source, setSource] = useState('');
  const [detectedBroker, setDetectedBroker] = useState<string>('');
  const [ocrStocks, setOcrStocks] = useState<EditableStock[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [errorDetail, setErrorDetail] = useState<OcrError | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [applied, setApplied] = useState(0);
  const [skippedUntouched, setSkippedUntouched] = useState(0);
  const [skippedLeverage, setSkippedLeverage] = useState(0);
  const [targetCat, setTargetCat] = useState<TargetCat>('investing');
  const [updated, setUpdated] = useState(0);
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef(0);
  const flowIdRef = useRef('');
  useFocusTrap(true, dialogRef, onClose);

  const selectedBroker = detectedBroker as Broker | '';
  const importDrafts = useMemo(() => toImportDrafts(ocrStocks), [ocrStocks]);
  const reconciliationRows = useMemo(
    () => reconcilePortfolioImport(importDrafts, stocks, selectedBroker, targetCat),
    [importDrafts, selectedBroker, stocks, targetCat],
  );
  const allActionableIndices = useMemo(() => actionableIndices(reconciliationRows), [reconciliationRows]);
  const reconciliationCounts = useMemo(() => reconciliationRows.reduce((counts, row) => ({
    ...counts,
    [row.status]: counts[row.status] + 1,
  }), { new: 0, changed: 0, unchanged: 0, needs_review: 0 }), [reconciliationRows]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    flowIdRef.current = crypto.randomUUID();
    void logApiCall('portfolio_import_started', undefined, {
      source: 'ocr',
      flowId: flowIdRef.current,
    });
  }, []);

  const processFile = async (file: File) => {
    setErrorDetail(null);
    if (!OCR_UI_ENABLED) {
      setErrorDetail({
        title: OCR_DISABLED_COPY.title,
        hint: OCR_DISABLED_COPY.detail,
        code: 'disabled',
        canRetry: false,
      });
      setStep('error');
      return;
    }
    setLastFile(file);
    setPreview(URL.createObjectURL(file));
    setStep('loading');

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setErrorDetail({
        title: '이미지 인식은 로그인 후 이용할 수 있어요.',
        hint: '로그인한 뒤 스크린샷을 다시 선택해주세요.',
        code: 'unauthorized',
        canRetry: false,
      });
      setStep('error');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch('/api/portfolio/ocr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;

      if (!res.ok) {
        const code = data.code as string | undefined;
        setErrorDetail({
          title: typeof data.error === 'string' ? data.error : '분석에 실패했어요.',
          hint: typeof data.hint === 'string' ? data.hint : '잠시 후 다시 시도해주세요.',
          code,
          // rate_limit·service_down은 재시도 무의미, 나머지는 재시도 가능
          canRetry: code !== 'rate_limit'
            && code !== 'service_down'
            && code !== 'too_large'
            && code !== 'bad_type'
            && code !== 'unauthorized'
            && code !== 'daily_limit'
            && code !== 'disabled',
        });
        setStep('error');
        return;
      }

      // EditableStock으로 변환
      const editable: EditableStock[] = (data.stocks as OcrStock[]).map(s => ({
        ...s,
        editAvgCost: s.avgCost !== null ? String(s.avgCost) : '',
        editShares: s.shares !== null ? String(s.shares) : '',
      }));

      setOcrStocks(editable);
      setSource(typeof data.source === 'string' ? data.source : '');
      // Phase B-1 — 증권사 자동 추정 (Broker enum 키)
      const VALID_KEYS = ['toss','kiwoom','mirae','kis','samsung','nh','kb','shinhan','meritz','hana','daishin','yuanta','sk','eugene','kakaopay','other'];
      const responseBrokerKey = typeof data.brokerKey === 'string' ? data.brokerKey : '';
      const brokerKey = VALID_KEYS.includes(responseBrokerKey) ? responseBrokerKey as Broker : '';
      setDetectedBroker(brokerKey);
      const rows = reconcilePortfolioImport(toImportDrafts(editable), stocks, brokerKey, targetCat);
      setSelected(actionableIndices(rows));
      setStep('review');
      const counts = rows.reduce((summary, row) => ({
        ...summary,
        [row.status]: summary[row.status] + 1,
      }), { new: 0, changed: 0, unchanged: 0, needs_review: 0 });
      void logApiCall('portfolio_import_reviewed', undefined, {
        source: 'ocr',
        flowId: flowIdRef.current,
        ...counts,
        elapsedMs: Date.now() - startedAtRef.current,
      });
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === 'AbortError';
      setErrorDetail({
        title: timedOut ? '이미지 인식 시간이 길어지고 있어요.' : '네트워크 연결에 문제가 있어요.',
        hint: timedOut ? 'CSV로 전환하거나 잠시 후 다시 시도해주세요.' : '인터넷 연결을 확인하고 다시 시도해주세요.',
        code: timedOut ? 'service_down' : 'network',
        canRetry: !timedOut,
      });
      setStep('error');
      void logApiCall('portfolio_import_failed', undefined, {
        source: 'ocr',
        flowId: flowIdRef.current,
        code: timedOut ? 'timeout' : 'network',
      });
    }
  };

  const handleFile = (file: File) => {
    startedAtRef.current = Date.now();
    // 사전 검증: 타입·크기 API 호출 전 차단
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setErrorDetail({
        title: '이미지 파일만 올릴 수 있어요.',
        hint: 'JPG, PNG, WEBP 형식으로 저장한 후 다시 시도해주세요.',
        code: 'bad_type',
        canRetry: false,
      });
      setStep('error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorDetail({
        title: '파일이 너무 커요.',
        hint: `현재 ${(file.size / 1024 / 1024).toFixed(1)}MB · 10MB 이하로 압축하거나 다시 캡처해주세요.`,
        code: 'too_large',
        canRetry: false,
      });
      setStep('error');
      return;
    }
    processFile(file);
  };

  const retryLast = () => {
    if (lastFile) {
      processFile(lastFile);
    } else {
      fileRef.current?.click();
    }
  };

  const switchToCsv = () => {
    onClose();
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('open-record-import'));
    });
  };

  const switchToLogin = () => {
    onClose();
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('open-login'));
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const updateField = (i: number, field: 'editAvgCost' | 'editShares', value: string) => {
    setOcrStocks(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const applyToPortfolio = () => {
    const leverageIndices = new Set(reconciliationRows
      .filter((row) => selected.has(row.inputIndex)
        && isBlockedLeverage(row.draft.symbol, row.draft.name))
      .map((row) => row.inputIndex));
    const safeSelection = new Set([...selected].filter((index) => !leverageIndices.has(index)));
    const result = applyPortfolioReconciliation(
      stocks,
      reconciliationRows,
      safeSelection,
      selectedBroker,
      targetCat,
    );
    const changes = buildPortfolioImportChanges(
      reconciliationRows,
      safeSelection,
      () => ({ broker: selectedBroker, targetCategory: targetCat }),
    );
    const id = commitPortfolioImport(
      result.stocks,
      selectedBroker ? `${BROKER_LABELS[selectedBroker]} 스크린샷` : '스크린샷 가져오기',
      {
        summary: result.summary,
        changes,
        excludedCount: leverageIndices.size,
      },
    );

    setApplied(result.summary.added);
    setUpdated(result.summary.updated);
    setSkippedUntouched(result.summary.needsReview + result.summary.unchanged + result.summary.skippedLimit);
    setSkippedLeverage(leverageIndices.size);
    setCheckpointId(id);
    setRestored(false);
    setStep('done');
    logFeatureFirstUse('safe-import');
    void logApiCall('portfolio_import_approved', undefined, {
      source: 'ocr',
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
    if (!checkpointId || !restoreLastPortfolioImport(checkpointId)) return;
    setRestored(true);
    logFeatureFirstUse('import-restore');
    void logApiCall('portfolio_import_restored', undefined, {
      source: 'ocr',
      flowId: flowIdRef.current,
    });
  };

  const reset = () => {
    setStep('upload');
    setPreview(null);
    setOcrStocks([]);
    setSelected(new Set());
    setErrorDetail(null);
    setLastFile(null);
    setSkippedUntouched(0);
    setUpdated(0);
    setCheckpointId(null);
    setRestored(false);
    startedAtRef.current = Date.now();
    flowIdRef.current = crypto.randomUUID();
    void logApiCall('portfolio_import_started', undefined, {
      source: 'ocr',
      flowId: flowIdRef.current,
      sourceAction: 'reset',
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const selectableCount = reconciliationRows.filter((row) => selected.has(row.inputIndex)
    && (row.status === 'new' || row.status === 'changed')
    && !isBlockedLeverage(row.draft.symbol, row.draft.name)).length;
  const needsReviewCount = reconciliationRows.filter((row) => row.status === 'needs_review').length;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ocr-import-title" tabIndex={-1} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* 헤더 */}
        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div id="ocr-import-title" style={{ fontSize: 17, fontWeight: 700, color: '#191F28' }}>스크린샷으로 가져오기</div>
            <div style={{ fontSize: 12, color: '#8B95A1', marginTop: 3 }}>MTS/HTS 보유종목 화면 캡처 → 자동 입력</div>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', background: 'none', border: 'none', color: '#B0B8C1', cursor: 'pointer', padding: 4 }}><X size={19} aria-hidden="true" /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* STEP: upload */}
          {step === 'upload' && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#3182F6' : 'var(--border-light, #E5E8EB)'}`,
                  borderRadius: 16, padding: '48px 24px', textAlign: 'center',
                  cursor: 'pointer', background: dragOver ? 'rgba(49,130,246,0.04)' : '#FAFAFA',
                  transition: 'all 0.15s',
                }}
              >
                <Upload size={34} color="var(--brand-primary, #0E7C7B)" aria-hidden="true" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: '#191F28', marginBottom: 6 }}>보유종목 화면 스크린샷</div>
                <div style={{ fontSize: 13, color: '#8B95A1', lineHeight: 1.6 }}>
                  캡처해서 간단하게 첨부만하세요<br />JPG · PNG · WEBP · 최대 10MB
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              <div style={{ marginTop: 20, padding: '14px 16px', background: '#F8F9FA', borderRadius: 12 }}>
                <div role="note" style={{ fontSize: 12, color: '#4E5968', lineHeight: 1.7, marginBottom: 12 }}>
                  이미지는 종목 인식을 위해 Google Gemini로 전송되며 주비 서버에는 저장하지 않아요.
                  이름·계좌번호 등 개인정보는 가리고 올려주세요.{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>
                    개인정보처리방침
                  </a>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', marginBottom: 8 }}>지원 증권사</div>
                <div style={{ fontSize: 12, color: '#8B95A1', lineHeight: 1.8 }}>
                  키움 영웅문 · 삼성 mPOP · 미래에셋 m.ALL<br />
                  NH투자 · 한국투자 · 토스증권 · KB증권<br />
                  Interactive Brokers · 기타 모든 MTS/HTS
                </div>
              </div>
            </div>
          )}

          {/* STEP: loading */}
          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              {preview && (
                <img src={preview} alt="업로드된 이미지" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 12, marginBottom: 24, opacity: 0.6 }} />
              )}
              <ScanLine size={30} color="var(--brand-primary, #0E7C7B)" aria-hidden="true" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#191F28', marginBottom: 6 }}>AI가 종목 정보를 읽는 중...</div>
              <div style={{ fontSize: 13, color: '#8B95A1' }}>Gemini 2.5 Flash 분석 중 (5~10초)</div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#3182F6', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.6 }} />
                ))}
              </div>
              <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.4);opacity:1} }`}</style>
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && (
            <div>
              {preview && (
                <img src={preview} alt="업로드된 이미지" style={{ width: '100%', maxHeight: 140, objectFit: 'contain', borderRadius: 12, marginBottom: 16, border: '1px solid var(--border-light, #F2F4F6)' }} />
              )}

              {/* 카테고리 선택 */}
              <label style={{ display: 'block', marginBottom: 12, color: 'var(--text-secondary, #4E5968)', fontSize: 12, fontWeight: 700 }}>
                이 화면의 증권사
                <select
                  value={detectedBroker}
                  onChange={(event) => {
                    const nextBroker = event.target.value as Broker | '';
                    setDetectedBroker(nextBroker);
                    setSelected(actionableIndices(reconcilePortfolioImport(importDrafts, stocks, nextBroker, targetCat)));
                  }}
                  style={{ width: '100%', minHeight: 42, marginTop: 6, padding: '8px 10px', border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 10, background: 'var(--card-bg, #FFFFFF)', color: 'var(--text-primary, #191F28)', fontSize: 13 }}
                >
                  <option value="">확인 필요</option>
                  {BROKER_ORDER.map((broker) => <option key={broker} value={broker}>{BROKER_LABELS[broker]}</option>)}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {([['investing', '투자 중'], ['watching', '관심 종목']] as [TargetCat, string][]).map(([cat, label]) => (
                  <button key={cat} onClick={() => {
                    setTargetCat(cat);
                    setSelected(actionableIndices(reconcilePortfolioImport(importDrafts, stocks, selectedBroker, cat)));
                  }}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      background: targetCat === cat ? '#191F28' : '#F2F4F6',
                      color: targetCat === cat ? '#fff' : '#4E5968',
                      border: 'none', cursor: 'pointer',
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#191F28' }}>{ocrStocks.length}개 종목 인식됨</span>
                  {source && source !== '알 수 없음' && (
                    <span style={{ fontSize: 12, color: '#8B95A1', marginLeft: 8 }}>{source}</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelected(selectableCount === allActionableIndices.size ? new Set() : allActionableIndices);
                  }}
                  style={{ fontSize: 12, color: '#3182F6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  {selectableCount === allActionableIndices.size ? '전체 해제' : '변경 전체 선택'}
                </button>
              </div>

              <div style={{ marginBottom: 12, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, borderRadius: 12, background: 'var(--bg-subtle, #F8F9FA)' }}>
                {([
                  ['새 항목', reconciliationCounts.new],
                  ['변경', reconciliationCounts.changed],
                  ['그대로', reconciliationCounts.unchanged],
                  ['확인 필요', reconciliationCounts.needs_review],
                ] as const).map(([label, count], index) => (
                  <div key={label} style={{ minWidth: 0, textAlign: 'center', borderLeft: index === 0 ? 'none' : '1px solid var(--border-light, #E5E8EB)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-primary, #191F28)', fontSize: 14, fontWeight: 800 }}>
                      {index === 1 ? <GitCompareArrows size={13} aria-hidden="true" /> : null}{count}
                    </div>
                    <div style={{ marginTop: 3, color: 'var(--text-tertiary, #8B95A1)', fontSize: 9 }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ocrStocks.map((s, i) => {
                  const row = reconciliationRows[i];
                  const status = row?.status || 'needs_review';
                  const actionable = status === 'new' || status === 'changed';
                  const blocked = isBlockedLeverage(s.symbol, s.name);
                  const isSelected = selected.has(i);
                  const statusCopy = STATUS_COPY[status];

                  return (
                    <div
                      key={`${s.symbol}-${i}`}
                      style={{
                        padding: '12px 14px', borderRadius: 12,
                        border: `1.5px solid ${status === 'needs_review' || blocked ? 'var(--color-warning, #FF9500)' : isSelected ? 'var(--brand-primary, #0E7C7B)' : 'var(--border-light, #E5E8EB)'}`,
                        background: isSelected ? 'var(--brand-primary-bg, rgba(14,124,123,0.06))' : 'var(--card-bg, #FFFFFF)',
                        opacity: status === 'unchanged' ? 0.72 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {/* 상단: 체크 + 종목명 */}
                      <div
                        onClick={() => actionable && !blocked && toggleSelect(i)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: actionable && !blocked ? 'pointer' : 'default' }}
                      >
                        <div style={{
                          width: 20, height: 20, borderRadius: 6,
                          background: isSelected ? 'var(--brand-primary, #0E7C7B)' : 'var(--bg-subtle, #F2F4F6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {isSelected ? <Check size={13} color="var(--text-inverse, #FFFFFF)" aria-hidden="true" /> : null}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {s.name || s.symbol}
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary, #8B95A1)', fontWeight: 400 }}>{s.symbol}</span>
                            <span style={{ fontSize: 10, color: status === 'changed' ? 'var(--brand-primary, #0E7C7B)' : status === 'needs_review' || blocked ? 'var(--color-warning, #FF9500)' : 'var(--text-secondary, #6B7684)', fontWeight: 700 }}>
                              {blocked ? '반영 제한' : statusCopy.label}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: s.currency === 'USD' ? 'rgba(49,130,246,0.1)' : 'rgba(0,198,190,0.1)', color: s.currency === 'USD' ? '#3182F6' : '#00C6BE', fontWeight: 600 }}>
                          {s.currency}
                        </span>
                      </div>

                      <div style={{ marginTop: 8, marginLeft: 32 }}>
                        {status === 'changed' && row?.changes.length ? (
                          <div style={{ display: 'grid', gap: 5 }}>
                            {row.changes.map((change) => (
                              <div key={change.field} style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)' }}>
                                {change.field === 'avgCost' ? '평단' : '수량'} · {formatHoldingValue(change.field, change.before, s.currency)} → <strong>{formatHoldingValue(change.field, change.after, s.currency)}</strong>
                              </div>
                            ))}
                          </div>
                        ) : status === 'needs_review' && row?.reason === 'missing_values' ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: 10, color: '#8B95A1', display: 'block', marginBottom: 2 }}>평균매수가</label>
                                <input
                                  type="number"
                                  placeholder={s.currency === 'KRW' ? '0' : '0.00'}
                                  value={s.editAvgCost}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => updateField(i, 'editAvgCost', e.target.value)}
                                  style={{
                                    width: '100%', padding: '6px 8px', fontSize: 13, fontWeight: 600,
                                    border: `1px solid ${s.editAvgCost ? 'var(--border-light, #E5E8EB)' : '#FF9500'}`,
                                    borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                                    background: '#fff',
                                  }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: 10, color: '#8B95A1', display: 'block', marginBottom: 2 }}>보유수량</label>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={s.editShares}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => updateField(i, 'editShares', e.target.value)}
                                  style={{
                                    width: '100%', padding: '6px 8px', fontSize: 13, fontWeight: 600,
                                    border: `1px solid ${s.editShares ? 'var(--border-light, #E5E8EB)' : '#FF9500'}`,
                                    borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                                    background: '#fff',
                                  }}
                                />
                              </div>
                            </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)' }}>
                            {Number(s.editAvgCost) > 0 ? `평단 ${formatHoldingValue('avgCost', Number(s.editAvgCost), s.currency)} · ` : ''}
                            {Number(s.editShares) > 0 ? `${formatHoldingValue('shares', Number(s.editShares), s.currency)} · ` : ''}
                            {blocked ? '정책상 자동 반영하지 않아요.' : statusCopy.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {needsReviewCount > 0 && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,149,0,0.08)', borderRadius: 10, fontSize: 12, color: '#FF9500', lineHeight: 1.6 }}>
                  {needsReviewCount}개 항목은 값 또는 증권사를 확인해야 해요. 확인 전에는 기록을 바꾸지 않아요.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={reset} style={{ flex: 1, padding: '12px 0', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#4E5968', cursor: 'pointer' }}>
                  다시 촬영
                </button>
                <button
                  onClick={applyToPortfolio}
                  disabled={selectableCount === 0}
                  style={{ flex: 2, padding: '12px 0', background: selectableCount > 0 ? '#3182F6' : '#B0B8C1', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', cursor: selectableCount > 0 ? 'pointer' : 'not-allowed' }}
                >
                  {selectableCount}개 변경 승인
                </button>
              </div>
            </div>
          )}

          {/* STEP: error — 구조화된 에러 안내 */}
          {step === 'error' && errorDetail && (
            <div style={{ padding: '8px 0' }}>
              {preview && (
                <img
                  src={preview}
                  alt="업로드 이미지 미리보기"
                  style={{ width: '100%', maxHeight: 140, objectFit: 'contain', borderRadius: 12, marginBottom: 16, border: '1px solid var(--border-light, #F2F4F6)', opacity: 0.55 }}
                />
              )}

              <div
                style={{
                  padding: '20px 18px',
                  borderRadius: 14,
                  background: errorDetail.code === 'rate_limit' ? 'rgba(255,149,0,0.06)' : 'rgba(239,68,82,0.05)',
                  border: `1px solid ${errorDetail.code === 'rate_limit' ? 'rgba(255,149,0,0.18)' : 'rgba(239,68,82,0.15)'}`,
                  textAlign: 'center',
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  {errorDetail.code === 'rate_limit' ? <LoaderCircle size={30} color="var(--color-warning, #FF9500)" aria-hidden="true" />
                    : errorDetail.code === 'image_empty' || errorDetail.code === 'parse_failed' ? <ScanLine size={30} color="var(--color-danger, #EF4452)" aria-hidden="true" />
                    : errorDetail.code === 'too_large' || errorDetail.code === 'bad_type' ? <FileImage size={30} color="var(--color-danger, #EF4452)" aria-hidden="true" />
                    : errorDetail.code === 'network' ? <WifiOff size={30} color="var(--color-danger, #EF4452)" aria-hidden="true" />
                    : <AlertTriangle size={30} color="var(--color-danger, #EF4452)" aria-hidden="true" />}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#191F28', marginBottom: 8, lineHeight: 1.4 }}>
                  {errorDetail.title}
                </div>
                <div style={{ fontSize: 13, color: '#4E5968', lineHeight: 1.6, wordBreak: 'keep-all' }}>
                  {errorDetail.hint}
                </div>
              </div>

              {/* 캡처 가이드 — 인식 실패류에만 노출 */}
              {(errorDetail.code === 'image_empty' || errorDetail.code === 'parse_failed') && (
                <div style={{ marginTop: 12, padding: '12px 14px', background: '#F8F9FA', borderRadius: 10, fontSize: 12, color: '#4E5968', lineHeight: 1.8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, marginBottom: 4, color: '#191F28' }}><FileImage size={14} aria-hidden="true" /> 캡처 팁</div>
                  <div>· 보유종목 또는 계좌 화면 전체를 캡처해주세요</div>
                  <div>· 종목명·수량·평단가가 한 화면에 모두 보여야 해요</div>
                  <div>· 글자가 선명하도록 확대해서 캡처하면 정확해요</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button
                  onClick={switchToCsv}
                  style={{ flex: '1 1 140px', padding: '12px 0', background: 'var(--brand-primary, #0E7C7B)', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
                >
                  CSV로 안전하게 전환
                </button>
                {errorDetail.code === 'unauthorized' ? (
                  <button
                    onClick={switchToLogin}
                    style={{ flex: '1 1 120px', padding: '12px 0', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#4E5968', cursor: 'pointer' }}
                  >
                    로그인하기
                  </button>
                ) : (
                  <button
                    onClick={reset}
                    style={{ flex: '1 1 120px', padding: '12px 0', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#4E5968', cursor: 'pointer' }}
                  >
                    다른 이미지
                  </button>
                )}
                {errorDetail.canRetry && (
                  <button
                    onClick={retryLast}
                    style={{ flex: '1 1 120px', padding: '12px 0', background: '#3182F6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
                  >
                    다시 시도
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 52, height: 52, margin: '0 auto 16px', display: 'grid', placeItems: 'center', borderRadius: 16, background: 'var(--brand-primary-light, rgba(14,124,123,0.08))' }}>
                {restored
                  ? <RotateCcw size={24} color="var(--brand-primary, #0E7C7B)" aria-hidden="true" />
                  : <CheckCircle2 size={24} color="var(--brand-primary, #0E7C7B)" aria-hidden="true" />}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#191F28', marginBottom: 8 }}>
                {restored ? '가져오기 전 기록으로 복구했어요' : `${applied + updated}개 변경을 반영했어요`}
              </div>
              <div style={{ fontSize: 13, color: '#8B95A1', marginBottom: 24, lineHeight: 1.8 }}>
                {applied > 0 && <>새 항목 {applied}개<br /></>}
                {updated > 0 && <>기존 항목 변경 {updated}개<br /></>}
                {skippedUntouched > 0 && <>그대로 두거나 확인이 필요한 항목 {skippedUntouched}개<br /></>}
                {skippedLeverage > 0 && (
                  <>
                    <span style={{ color: '#B45309' }}>단일종목 레버리지·인버스 {skippedLeverage}개는 반영하지 않았어요.</span>
                    <br />
                  </>
                )}
                {restored ? '이번 변경은 모두 취소됐어요.' : '변경 전 기록은 복구 지점으로 보관했어요.'}
              </div>
              {!restored && checkpointId && (
                <button onClick={restoreImport} style={{ width: '100%', minHeight: 44, marginBottom: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary, #4E5968)', cursor: 'pointer' }}>
                  <RotateCcw size={15} aria-hidden="true" /> 가져오기 전으로 되돌리기
                </button>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={reset} style={{ flex: 1, padding: '12px 0', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#4E5968', cursor: 'pointer' }}>
                  더 가져오기
                </button>
                <button onClick={onClose} style={{ flex: 2, padding: '12px 0', background: '#191F28', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
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
