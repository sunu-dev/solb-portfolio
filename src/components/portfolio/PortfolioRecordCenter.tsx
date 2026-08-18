'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatKrw, formatUsd } from '@/utils/koreanNumber';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  History,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { BROKER_LABELS } from '@/config/constants';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { logApiCall } from '@/lib/apiLogger';
import type {
  PortfolioVersionChange,
  PortfolioVersionEntry,
} from '@/lib/portfolioReconciliation';
import { logFeatureFirstUse, logTourEvent } from '@/lib/tourTelemetry';
import { usePortfolioStore } from '@/store/portfolioStore';
import CsvImportModal from './CsvImportModal';
import RecordSafetyPreviewDialog from './RecordSafetyPreviewDialog';

interface Props {
  ocrEnabled: boolean;
  onOpenOcr: () => void;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '시간 정보 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function skippedCount(entry: PortfolioVersionEntry): number {
  return entry.summary.needsReview
    + entry.summary.skippedLimit
    + entry.excludedCount;
}

function formatValue(
  field: 'avgCost' | 'shares',
  value: number,
  currency: 'KRW' | 'USD',
): string {
  if (field === 'shares') return `${value.toLocaleString()}주`;
  return currency === 'KRW'
    ? formatKrw(value, { prefix: false, suffix: '원', short: false })
    : formatUsd(value, { max: 3 });
}

function changeSummary(change: PortfolioVersionChange): string {
  if (change.kind === 'added') {
    const values = [
      change.avgCost && change.avgCost > 0
        ? `평단 ${formatValue('avgCost', change.avgCost, change.currency)}`
        : null,
      change.shares && change.shares > 0
        ? formatValue('shares', change.shares, change.currency)
        : null,
    ].filter(Boolean);
    return values.length ? `새로 등록 · ${values.join(' · ')}` : '새로 등록';
  }
  return change.fields.map((field) =>
    `${field.field === 'avgCost' ? '평단' : '수량'} `
    + `${formatValue(field.field, field.before, change.currency)} → `
    + `${formatValue(field.field, field.after, change.currency)}`,
  ).join(' · ');
}

function HistoryDialog({ onClose }: { onClose: () => void }) {
  const history = usePortfolioStore((state) => state.portfolioImportHistory);
  const restorePortfolioVersion = usePortfolioStore((state) => state.restorePortfolioVersion);
  const syncStatus = usePortfolioStore((state) => state.portfolioSyncStatus);
  const cloudLoadStatus = usePortfolioStore((state) => state.portfolioCloudLoadStatus);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [restorePending, setRestorePending] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, dialogRef, onClose);

  const confirmEntry = history.find((entry) => entry.id === confirmId);

  const restore = () => {
    if (!confirmEntry) return;
    if (cloudLoadStatus === 'loading'
      || cloudLoadStatus === 'error'
      || syncStatus === 'conflict'
      || syncStatus === 'storage-error') {
      setAnnouncement('클라우드 기록 상태가 바뀌어 복원을 멈췄어요. 현재 기록 상태를 먼저 확인해주세요.');
      return;
    }
    void logApiCall('portfolio_history_restore_attempted');
    const restored = restorePortfolioVersion(confirmEntry.id);
    if (!restored) {
      setAnnouncement('복구 지점을 찾지 못했어요. 다시 시도해주세요.');
      void logApiCall('portfolio_history_restore_failed');
      return;
    }
    setConfirmId(null);
    setRestorePending(true);
    setAnnouncement('이 기기에 복원했고 클라우드 저장을 확인 중이에요. 복원 전 상태도 새 복구 지점으로 남겼어요.');
    logFeatureFirstUse('import-restore');
    void logApiCall('portfolio_history_restore_succeeded');
  };

  const visibleAnnouncement = restorePending
    ? syncStatus === 'synced'
      ? '선택한 시점으로 복원하고 클라우드 저장까지 마쳤어요. 복원 전 상태도 새 복구 지점으로 남겼어요.'
      : syncStatus === 'error'
      ? '이 기기에는 복원됐고 클라우드 저장을 다시 시도하고 있어요. 완료될 때까지 창을 닫지 않는 편이 안전해요.'
      : syncStatus === 'storage-error'
      ? '이 기기 저장 공간 문제로 클라우드에 즉시 저장 중이에요. 완료될 때까지 창을 닫지 말아주세요.'
      : syncStatus === 'conflict'
      ? '복원 상태는 이 기기에 보존했지만 클라우드 최신 기록과 충돌했어요. 이 창을 닫고 사용할 기록을 선택해주세요.'
      : syncStatus === 'local-only'
      ? '선택한 시점으로 이 기기에 복원했어요. 현재 환경에서는 복구 지점이 이 기기에만 보관돼요.'
      : announcement
    : announcement;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(15, 23, 42, 0.56)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-history-title"
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-light, #E5E8EB)',
          borderRadius: 24,
          background: 'var(--surface, #FFFFFF)',
          boxShadow: '0 24px 80px rgba(15, 23, 42, 0.22)',
        }}
      >
        <div style={{ padding: '20px 20px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
          <div style={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 13, background: 'var(--brand-primary-bg, rgba(14,124,123,0.08))', color: 'var(--brand-primary, #0E7C7B)' }}>
            <History size={20} aria-hidden="true" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="portfolio-history-title" style={{ margin: 0, color: 'var(--text-primary, #191F28)', fontSize: 18, lineHeight: 1.35 }}>
              변경 기록과 복원
            </h2>
            <p style={{ margin: '5px 0 0', color: 'var(--text-secondary, #6B7684)', fontSize: 12, lineHeight: 1.55 }}>
              가져오기 전 기록을 최근 20개까지 보관해요. 복원해도 지금 상태를 잃지 않아요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="변경 기록 닫기"
            style={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', border: 0, borderRadius: 10, background: 'transparent', color: 'var(--text-tertiary, #8B95A1)', cursor: 'pointer' }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div aria-live="polite" style={{ minHeight: visibleAnnouncement ? 'auto' : 0 }}>
          {visibleAnnouncement && (
            <div style={{ margin: '14px 20px 0', padding: '11px 12px', display: 'flex', gap: 8, borderRadius: 11, background: 'rgba(52,199,89,0.09)', color: 'var(--color-success, #228B45)', fontSize: 12, lineHeight: 1.5 }}>
              <CheckCircle2 size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
              {visibleAnnouncement}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {history.length === 0 ? (
            <div style={{ padding: '52px 20px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, margin: '0 auto 14px', display: 'grid', placeItems: 'center', borderRadius: 17, background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-tertiary, #8B95A1)' }}>
                <History size={23} aria-hidden="true" />
              </div>
              <div style={{ color: 'var(--text-primary, #191F28)', fontSize: 15, fontWeight: 700 }}>
                아직 변경 기록이 없어요
              </div>
              <div style={{ marginTop: 6, color: 'var(--text-secondary, #8B95A1)', fontSize: 12, lineHeight: 1.6 }}>
                CSV나 스크린샷 변경을 승인하면<br />반영 전 상태가 자동으로 보관돼요.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map((entry, index) => {
                const omitted = skippedCount(entry);
                const isConfirming = confirmId === entry.id;
                return (
                  <article
                    key={entry.id}
                    style={{
                      padding: 15,
                      border: `1px solid ${isConfirming ? 'var(--brand-primary, #0E7C7B)' : 'var(--border-light, #E5E8EB)'}`,
                      borderRadius: 16,
                      background: isConfirming
                        ? 'var(--brand-primary-bg, rgba(14,124,123,0.05))'
                        : 'var(--surface, #FFFFFF)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <strong style={{ overflow: 'hidden', color: 'var(--text-primary, #191F28)', fontSize: 13, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.source}
                          </strong>
                          {index === 0 && (
                            <span style={{ padding: '2px 7px', borderRadius: 999, background: 'var(--brand-primary-bg, rgba(14,124,123,0.08))', color: 'var(--brand-primary, #0E7C7B)', fontSize: 9, fontWeight: 800 }}>
                              최근
                            </span>
                          )}
                          {entry.kind === 'restore' && (
                            <span style={{ color: 'var(--text-tertiary, #8B95A1)', fontSize: 10, fontWeight: 700 }}>
                              복원 취소 지점
                            </span>
                          )}
                        </div>
                        <div style={{ marginTop: 4, color: 'var(--text-tertiary, #8B95A1)', fontSize: 11 }}>
                          {formatTimestamp(entry.createdAt)}
                          {entry.restoredAt ? ` · ${formatTimestamp(entry.restoredAt)}에 복원함` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAnnouncement('');
                          setConfirmId(isConfirming ? null : entry.id);
                        }}
                        aria-expanded={isConfirming}
                        style={{ minHeight: 36, padding: '7px 10px', flexShrink: 0, border: '1px solid var(--border-strong, #D1D6DB)', borderRadius: 9, background: 'var(--surface, #FFFFFF)', color: 'var(--text-secondary, #4E5968)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        복원
                      </button>
                    </div>

                    {entry.kind === 'import' && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {entry.summary.added > 0 && (
                          <span style={{ padding: '4px 8px', borderRadius: 8, background: 'rgba(52,199,89,0.09)', color: 'var(--color-success, #228B45)', fontSize: 10, fontWeight: 700 }}>
                            신규 {entry.summary.added}
                          </span>
                        )}
                        {entry.summary.updated > 0 && (
                          <span style={{ padding: '4px 8px', borderRadius: 8, background: 'var(--brand-primary-bg, rgba(14,124,123,0.08))', color: 'var(--brand-primary, #0E7C7B)', fontSize: 10, fontWeight: 700 }}>
                            변경 {entry.summary.updated}
                          </span>
                        )}
                        {entry.summary.unchanged > 0 && (
                          <span style={{ padding: '4px 8px', borderRadius: 8, background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #6B7684)', fontSize: 10, fontWeight: 700 }}>
                            동일 {entry.summary.unchanged}
                          </span>
                        )}
                        {omitted > 0 && (
                          <span style={{ padding: '4px 8px', borderRadius: 8, background: 'rgba(255,149,0,0.09)', color: 'var(--color-warning, #C96C00)', fontSize: 10, fontWeight: 700 }}>
                            자동 제외 {omitted}
                          </span>
                        )}
                      </div>
                    )}

                    {entry.changes.length > 0 && (
                      <div style={{ marginTop: 10, display: 'grid', gap: 7 }}>
                        {entry.changes.slice(0, 3).map((change, changeIndex) => (
                          <div key={`${change.symbol}-${change.broker || 'none'}-${changeIndex}`} style={{ paddingTop: 7, borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
                            <div style={{ color: 'var(--text-primary, #191F28)', fontSize: 11, fontWeight: 700 }}>
                              {change.name || change.symbol}
                              <span style={{ marginLeft: 5, color: 'var(--text-tertiary, #8B95A1)', fontWeight: 400 }}>
                                {change.symbol}
                                {change.broker ? ` · ${BROKER_LABELS[change.broker]}` : ''}
                              </span>
                            </div>
                            <div style={{ marginTop: 3, color: 'var(--text-secondary, #6B7684)', fontSize: 10, lineHeight: 1.5 }}>
                              {changeSummary(change)}
                            </div>
                          </div>
                        ))}
                        {entry.changes.length > 3 && (
                          <div style={{ color: 'var(--text-tertiary, #8B95A1)', fontSize: 10 }}>
                            외 {entry.changes.length - 3}개 변경
                          </div>
                        )}
                      </div>
                    )}

                    {isConfirming && (
                      <div role="alert" style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--surface, #FFFFFF)', border: '1px solid rgba(14,124,123,0.18)' }}>
                        <div style={{ display: 'flex', gap: 8, color: 'var(--text-primary, #191F28)', fontSize: 12, fontWeight: 700, lineHeight: 1.5 }}>
                          <AlertTriangle size={16} color="var(--color-warning, #C96C00)" aria-hidden="true" style={{ flexShrink: 0 }} />
                          이 변경 직전 상태로 복원할까요?
                        </div>
                        <div style={{ margin: '5px 0 10px 24px', color: 'var(--text-secondary, #6B7684)', fontSize: 10, lineHeight: 1.5 }}>
                          지금 상태도 새 복구 지점으로 먼저 저장해요.
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
                          <button type="button" onClick={() => setConfirmId(null)} style={{ minHeight: 36, padding: '7px 12px', border: 0, borderRadius: 9, background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #4E5968)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            취소
                          </button>
                          <button type="button" onClick={restore} style={{ minHeight: 36, padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 9, background: 'var(--brand-primary, #0E7C7B)', color: 'white', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                            <RotateCcw size={13} aria-hidden="true" />
                            안전하게 복원
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PortfolioRecordCenter({ ocrEnabled, onOpenOcr }: Props) {
  const history = usePortfolioStore((state) => state.portfolioImportHistory);
  const syncStatus = usePortfolioStore((state) => state.portfolioSyncStatus);
  const cloudLoadStatus = usePortfolioStore((state) => state.portfolioCloudLoadStatus);
  const [showCsv, setShowCsv] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [guardNotice, setGuardNotice] = useState('');
  const closeCsv = useCallback(() => setShowCsv(false), []);
  const closeHistory = useCallback(() => setShowHistory(false), []);
  const closePreview = useCallback(() => setShowPreview(false), []);

  const openCsv = useCallback(() => {
    if (cloudLoadStatus === 'loading' || cloudLoadStatus === 'error' || syncStatus === 'conflict' || syncStatus === 'storage-error') {
      setExpanded(true);
      setGuardNotice(
        syncStatus === 'conflict'
          ? '다른 탭이나 기기의 최신 기록과 충돌했어요. 이 기기 변경은 보존되어 있으니 아래에서 사용할 기록을 선택해주세요.'
          : syncStatus === 'storage-error'
          ? '이 기기의 안전 저장 공간을 사용할 수 없어 가져오기를 막았어요. 저장 공간과 브라우저 설정을 확인해주세요.'
          : cloudLoadStatus === 'loading'
          ? '클라우드 기록을 불러온 뒤 안전하게 가져올게요. 잠시만 기다려주세요.'
          : '클라우드 기록을 불러오지 못해 변경을 잠시 막았어요. 연결을 확인하고 새로고침해주세요.',
      );
      return;
    }
    setGuardNotice('');
    setShowCsv(true);
    void logApiCall('portfolio_import_opened', undefined, { source: 'csv' });
  }, [cloudLoadStatus, syncStatus]);

  const openHistory = useCallback(() => {
    if (cloudLoadStatus === 'loading' || cloudLoadStatus === 'error' || syncStatus === 'conflict' || syncStatus === 'storage-error') {
      setExpanded(true);
      setGuardNotice(
        syncStatus === 'conflict'
          ? '다른 탭이나 기기의 최신 기록과 충돌해 복원을 멈췄어요. 이 기기 변경은 보존되어 있으니 아래에서 사용할 기록을 선택해주세요.'
          : syncStatus === 'storage-error'
          ? '이 기기의 안전 저장 공간을 사용할 수 없어 복원을 막았어요. 저장 공간과 브라우저 설정을 확인해주세요.'
          : cloudLoadStatus === 'loading'
          ? '클라우드 기록을 불러오는 중이에요. 완료되면 변경 기록을 열 수 있어요.'
          : '클라우드 기록을 불러오지 못했어요. 연결을 확인하고 새로고침해주세요.',
      );
      return;
    }
    setGuardNotice('');
    setShowHistory(true);
    void logApiCall('portfolio_history_opened', undefined, { hasHistory: history.length > 0 });
    if (history.length > 0) logFeatureFirstUse('import-history');
  }, [cloudLoadStatus, history.length, syncStatus]);

  const openOcr = useCallback(() => {
    if (cloudLoadStatus === 'loading' || cloudLoadStatus === 'error' || syncStatus === 'conflict' || syncStatus === 'storage-error') {
      setExpanded(true);
      setGuardNotice(
        syncStatus === 'conflict'
          ? '다른 기기의 최신 기록과 충돌해 사진 반영을 멈췄어요. 이 기기 변경은 보존되어 있으니 아래에서 사용할 기록을 선택해주세요.'
          : syncStatus === 'storage-error'
          ? '이 기기의 안전 저장 공간을 사용할 수 없어 사진 반영을 막았어요.'
          : cloudLoadStatus === 'loading'
          ? '클라우드 기록을 불러온 뒤 사진과 안전하게 비교할게요.'
          : '클라우드 기록을 불러오지 못해 사진 반영을 잠시 막았어요.',
      );
      return;
    }
    setGuardNotice('');
    onOpenOcr();
  }, [cloudLoadStatus, onOpenOcr, syncStatus]);

  const openPreview = useCallback((source = 'record-center') => {
    setShowPreview(true);
    logFeatureFirstUse('record-preview');
    void logTourEvent('record_preview_started', { source });
  }, []);

  useEffect(() => {
    const handleImport = () => openCsv();
    const handleHistory = () => openHistory();
    const handlePreview = () => openPreview('event');
    window.addEventListener('open-record-import', handleImport);
    window.addEventListener('open-record-history', handleHistory);
    window.addEventListener('open-record-preview', handlePreview);
    return () => {
      window.removeEventListener('open-record-import', handleImport);
      window.removeEventListener('open-record-history', handleHistory);
      window.removeEventListener('open-record-preview', handlePreview);
    };
  }, [openCsv, openHistory, openPreview]);

  useEffect(() => {
    const handleStorageWarning = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{
        kind?: 'history-pruned' | 'snapshots-pruned' | 'failed';
      }>;
      setExpanded(true);
      setGuardNotice(
        event.detail?.kind === 'history-pruned'
          ? '이 기기 저장 공간이 부족해 오래된 복구 지점 일부를 정리했어요. 클라우드 동기화 상태를 확인하고 기록 JSON도 보관해주세요.'
          : event.detail?.kind === 'snapshots-pruned'
          ? '이 기기 저장 공간이 부족해 오래된 일일 기록 일부를 정리했어요. 클라우드 동기화 상태를 확인하고 기록 JSON도 보관해주세요.'
          : '이 기기 저장 공간이 가득 차 기록을 안전하게 저장하지 못했어요. 창을 닫지 말고 저장 공간을 확보해주세요.',
      );
    };
    window.addEventListener('solb-local-record-storage-warning', handleStorageWarning);
    return () => {
      window.removeEventListener('solb-local-record-storage-warning', handleStorageWarning);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('recordPreview') !== '1') return;
    params.delete('recordPreview');
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
    const frame = requestAnimationFrame(() => openPreview('landing'));
    return () => cancelAnimationFrame(frame);
  }, [openPreview]);

  const latestImport = useMemo(
    () => history.find((entry) => entry.kind === 'import') ?? null,
    [history],
  );
  const omitted = latestImport ? skippedCount(latestImport) : 0;
  const visibleGuardNotice = guardNotice || (syncStatus === 'conflict'
    ? '다른 탭이나 기기의 최신 기록도 발견했어요. 이 기기 변경은 별도로 보존했고, 선택하기 전에는 어느 쪽도 덮어쓰지 않아요.'
    : cloudLoadStatus === 'error'
    ? '클라우드 기록을 불러오지 못했어요. 이 상태에서는 가져오기와 복원을 막고 있으니 연결을 확인한 뒤 새로고침해주세요.'
    : syncStatus === 'storage-error'
    ? '이 기기의 안전 저장 공간을 사용할 수 없어요. 클라우드에 즉시 저장을 시도 중이니 완료될 때까지 창을 닫지 말고, 저장 공간과 브라우저 설정을 확인해주세요.'
    : syncStatus === 'error'
    ? '이 기기에는 저장됐지만 클라우드 백업을 다시 시도하고 있어요. 동기화가 끝나기 전에는 창을 닫지 않는 편이 안전해요.'
    : '');
  const syncLabel = syncStatus === 'synced'
    ? '클라우드 동기화 정상'
    : syncStatus === 'saving'
    ? '클라우드 백업 중'
    : syncStatus === 'error'
    ? '클라우드 백업 재시도 중'
    : syncStatus === 'storage-error'
    ? '기기 저장 공간 확인 필요'
    : syncStatus === 'conflict'
    ? '최신 기록 충돌 확인 필요'
    : syncStatus === 'local-only'
    ? '일부 복구 기록은 이 기기에만 보관'
    : cloudLoadStatus === 'guest'
    ? '로그인하면 클라우드에도 보관'
    : '클라우드 연결 확인 중';
  const resolveConflict = useCallback((strategy: 'cloud' | 'local') => {
    const confirmed = window.confirm(
      strategy === 'cloud'
        ? '클라우드의 최신 기록을 불러오면 이 기기의 미동기 변경은 버려져요. 계속할까요?'
        : '이 기기의 미동기 변경을 최신 기록으로 저장할까요? 저장 직전에 클라우드 상태를 한 번 더 확인해요.',
    );
    if (!confirmed) return;
    window.dispatchEvent(new CustomEvent('solb-portfolio-resolve-conflict', {
      detail: { strategy },
    }));
  }, []);

  return (
    <>
      <section
        data-tour="record-center"
        aria-labelledby="record-center-title"
        style={{
          marginBottom: 16,
          overflow: 'hidden',
          border: '1px solid var(--border-light, #E5E8EB)',
          borderRadius: 14,
          background: 'var(--surface, #FFFFFF)',
        }}
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="portfolio-record-tools"
          onClick={() => setExpanded((value) => !value)}
          style={{
            width: '100%',
            minHeight: 64,
            padding: '11px 13px',
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            border: 0,
            background: 'transparent',
            color: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 11, background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #4E5968)' }}>
            <ShieldCheck size={18} aria-hidden="true" />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span id="record-center-title" style={{ display: 'block', color: 'var(--text-primary, #191F28)', fontSize: 13, fontWeight: 750, lineHeight: 1.4 }}>
              기록·가져오기·복구
            </span>
            <span style={{ display: 'block', marginTop: 2, overflow: 'hidden', color: 'var(--text-tertiary, #8B95A1)', fontSize: 10, lineHeight: 1.45, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {latestImport
                ? `최근 ${latestImport.source} · 복구 지점 ${history.length}개`
                : '필요할 때 펼쳐서 기록 도구를 쓸 수 있어요'}
            </span>
          </span>
          <span
            aria-live="polite"
            style={{
              flexShrink: 0,
              maxWidth: 112,
              overflow: 'hidden',
              color: syncStatus === 'error' || syncStatus === 'storage-error' || syncStatus === 'conflict'
                ? 'var(--color-warning, #C96C00)'
                : 'var(--text-tertiary, #8B95A1)',
              fontSize: 9,
              fontWeight: 700,
              lineHeight: 1.35,
              textAlign: 'right',
              textOverflow: 'ellipsis',
            }}
          >
            {syncLabel}
          </span>
          <ChevronDown
            size={17}
            aria-hidden="true"
            style={{
              flexShrink: 0,
              color: 'var(--text-tertiary, #8B95A1)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 160ms ease',
            }}
          />
        </button>

        {visibleGuardNotice && (
          <div style={{ margin: '0 12px 11px', padding: '9px 10px', borderRadius: 10, background: 'rgba(255,149,0,0.08)', color: 'var(--color-warning, #C96C00)', fontSize: 10, lineHeight: 1.55 }}>
            <div role="status">{visibleGuardNotice}</div>
            {syncStatus === 'conflict' && (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                <button
                  type="button"
                  onClick={() => resolveConflict('cloud')}
                  style={{ minHeight: 40, padding: '8px 9px', border: '1px solid rgba(201,108,0,0.25)', borderRadius: 9, background: 'var(--surface, #FFFFFF)', color: 'var(--text-secondary, #4E5968)', fontSize: 10, fontWeight: 750, cursor: 'pointer' }}
                >
                  클라우드 최신 불러오기
                </button>
                <button
                  type="button"
                  onClick={() => resolveConflict('local')}
                  style={{ minHeight: 40, padding: '8px 9px', border: 0, borderRadius: 9, background: 'var(--text-primary, #191F28)', color: 'var(--text-inverse, #FFFFFF)', fontSize: 10, fontWeight: 750, cursor: 'pointer' }}
                >
                  이 기기 변경 저장
                </button>
              </div>
            )}
          </div>
        )}

        <div
          id="portfolio-record-tools"
          hidden={!expanded}
          style={{ padding: '13px 13px 12px', borderTop: '1px solid var(--border-light, #F2F4F6)' }}
        >
          {latestImport ? (
            <div style={{ color: 'var(--text-secondary, #5B6674)', fontSize: 11, lineHeight: 1.55 }}>
              최근 {latestImport.source} · 신규 {latestImport.summary.added} · 변경 {latestImport.summary.updated}
              {omitted > 0 ? ` · 자동 제외 ${omitted}` : ''}
              <span style={{ display: 'block', color: 'var(--text-tertiary, #8B95A1)' }}>
                {formatTimestamp(latestImport.createdAt)} · 반영 전 상태를 복구 지점으로 보관
              </span>
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-secondary, #5B6674)', fontSize: 11, lineHeight: 1.55 }}>
              파일을 기존 보유 기록과 비교하고, 선택한 변경만 반영해요. 반영 전 상태는 자동 보관돼요.
            </p>
          )}

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: ocrEnabled ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          <button
            type="button"
            onClick={openCsv}
            style={{ minHeight: 44, padding: '9px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 0, borderRadius: 11, background: 'var(--brand-primary, #0E7C7B)', color: 'white', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
          >
            <FileSpreadsheet size={15} aria-hidden="true" />
            CSV 확인
          </button>
          {ocrEnabled && (
            <button
              type="button"
              onClick={openOcr}
              style={{ minHeight: 44, padding: '9px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid rgba(14,124,123,0.22)', borderRadius: 11, background: 'var(--surface, #FFFFFF)', color: 'var(--brand-primary, #0E7C7B)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
            >
              <Camera size={15} aria-hidden="true" />
              사진 확인
            </button>
          )}
          <button
            type="button"
            onClick={openHistory}
            style={{ minHeight: 44, padding: '9px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 11, background: 'var(--surface, #FFFFFF)', color: 'var(--text-secondary, #4E5968)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
          >
            <History size={15} aria-hidden="true" />
            기록 {history.length > 0 ? history.length : ''}
            <ChevronRight size={13} aria-hidden="true" />
          </button>
          </div>

          <button
            type="button"
            onClick={() => openPreview('record-center')}
            style={{ width: '100%', minHeight: 40, marginTop: 8, padding: '8px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 0, borderRadius: 10, background: 'transparent', color: 'var(--brand-primary, #0E7C7B)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
          >
            <PlayCircle size={15} aria-hidden="true" />
            파일 없이 안전 흐름 미리보기
          </button>
        </div>
      </section>

      {showCsv && <CsvImportModal onClose={closeCsv} />}
      {showHistory && <HistoryDialog onClose={closeHistory} />}
      {showPreview && <RecordSafetyPreviewDialog onClose={closePreview} />}
    </>
  );
}
