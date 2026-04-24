'use client';

import { useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';
import { X } from 'lucide-react';
import BottomSheet from '@/components/common/BottomSheet';
import UndoToast from '@/components/common/UndoToast';
import { isAlertSuppressed } from '@/utils/alertLearning';
import AlertGroup from '@/components/common/AlertGroup';

type AlertFilter = 'all' | 'risk' | 'opportunity' | 'insight';

const TABS: { id: AlertFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'risk', label: '리스크' },
  { id: 'opportunity', label: '주목' },
  { id: 'insight', label: '인사이트' },
];

function filterAlerts(alerts: Alert[], filter: AlertFilter): Alert[] {
  if (filter === 'all') return alerts;
  if (filter === 'risk') return alerts.filter(a => a.type === 'urgent' || a.type === 'risk');
  if (filter === 'opportunity') return alerts.filter(a => a.type === 'opportunity' || a.type === 'celebrate');
  if (filter === 'insight') return alerts.filter(a => a.type === 'insight');
  return alerts;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileAlertSheet({ isOpen, onClose }: Props) {
  const { alerts, dismissedAlerts, dismissAlert, dismissAllAlerts, undoDismissAll, bumpSnoozeTick, setAnalysisSymbol } = usePortfolioStore();
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [undoToast, setUndoToast] = useState<{ count: number } | null>(null);

  const visibleAlerts = alerts
    .filter(a => !dismissedAlerts.includes(a.id))
    .filter(a => a.severity === 1 || !isAlertSuppressed(a.id))
    .sort((a, b) => a.severity - b.severity);

  const filteredAlerts = filterAlerts(visibleAlerts, filter);

  return (
    <>
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="75vh">
      <div
        role="region"
        aria-live="polite"
        aria-label={`주비 AI 알림 ${visibleAlerts.length}개`}
        style={{ padding: '0 20px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>주비 AI 알림</span>
            {visibleAlerts.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#fff', background: '#EF4452',
                borderRadius: 10, padding: '2px 8px', minWidth: 20, textAlign: 'center',
              }}>
                {visibleAlerts.length}
              </span>
            )}
            {visibleAlerts.length > 0 && (
              <button
                onClick={() => {
                  const count = visibleAlerts.length;
                  dismissAllAlerts();
                  setUndoToast({ count });
                }}
                className="cursor-pointer"
                style={{ fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)', background: 'none', border: 'none', padding: '8px 12px', minHeight: 36 }}
              >
                전체 읽음
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer"
            style={{ background: 'none', border: 'none', padding: 8, color: 'var(--text-tertiary, #B0B8C1)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter tabs */}
        {visibleAlerts.length > 0 && (
          <div role="tablist" aria-label="알림 카테고리 필터" className="flex scrollbar-hide" style={{ gap: 4, marginBottom: 14, overflowX: 'auto' }}>
            {TABS.map(tab => {
              const isActive = filter === tab.id;
              const count = filterAlerts(visibleAlerts, tab.id).length;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`${tab.label} 필터${count > 0 ? ` (${count}개)` : ''}`}
                  onClick={() => setFilter(tab.id)}
                  className="cursor-pointer"
                  style={{
                    padding: '10px 16px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: 'nowrap',
                    background: isActive ? 'var(--text-primary, #191F28)' : 'var(--bg-subtle, #F2F4F6)',
                    color: isActive ? '#fff' : 'var(--text-secondary, #8B95A1)',
                    border: 'none',
                  }}
                >
                  {tab.label}{count > 0 ? ` ${count}` : ''}
                </button>
              );
            })}
          </div>
        )}

        {/* Alert list */}
        {filteredAlerts.length > 0 ? (
          <AlertGroup
            alerts={filteredAlerts}
            onDismiss={dismissAlert}
            onSnooze={() => bumpSnoozeTick()}
            onAnalyze={(symbol) => { setAnalysisSymbol(symbol); onClose(); }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>
              알림이 없어요
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)' }}>
              포트폴리오에 특별한 상황이 없어요.
            </div>
          </div>
        )}
      </div>
    </BottomSheet>

    {/* 전체 읽음 Undo 토스트 — 바텀시트 위에 표시 */}
    {undoToast && (
      <UndoToast
        message={`${undoToast.count}개 알림 읽음 처리됨`}
        onUndo={() => {
          undoDismissAll();
          setUndoToast(null);
        }}
        onDismiss={() => setUndoToast(null)}
        bottom={110}
      />
    )}
    </>
  );
}
