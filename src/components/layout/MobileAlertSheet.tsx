'use client';

import { useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';
import { X } from 'lucide-react';
import BottomSheet from '@/components/common/BottomSheet';

const ALERT_STYLE: Record<Alert['type'], { icon: string; label: string; bg: string; border: string; color: string }> = {
  urgent: { icon: '🚨', label: '긴급', bg: 'rgba(239,68,82,0.04)', border: '1px solid rgba(239,68,82,0.08)', color: '#EF4452' },
  risk: { icon: '⚠️', label: '리스크', bg: 'rgba(255,149,0,0.04)', border: '1px solid rgba(255,149,0,0.08)', color: '#FF9500' },
  opportunity: { icon: '💡', label: '주목', bg: 'rgba(0,198,190,0.04)', border: '1px solid rgba(0,198,190,0.08)', color: '#00C6BE' },
  insight: { icon: '✨', label: '인사이트', bg: 'rgba(49,130,246,0.04)', border: '1px solid rgba(49,130,246,0.08)', color: '#3182F6' },
  celebrate: { icon: '🎉', label: '달성', bg: 'rgba(175,82,222,0.04)', border: '1px solid rgba(175,82,222,0.08)', color: '#AF52DE' },
};

type AlertFilter = 'all' | 'risk' | 'opportunity' | 'insight';

const TABS: { id: AlertFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'risk', label: '리스크' },
  { id: 'opportunity', label: '주목' },
  { id: 'insight', label: '인사이트' },
];

function getRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

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
  const { alerts, dismissedAlerts, dismissAlert, dismissAllAlerts, setAnalysisSymbol } = usePortfolioStore();
  const [filter, setFilter] = useState<AlertFilter>('all');

  const visibleAlerts = alerts
    .filter(a => !dismissedAlerts.includes(a.id))
    .sort((a, b) => a.severity - b.severity);

  const filteredAlerts = filterAlerts(visibleAlerts, filter);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="75vh">
      <div style={{ padding: '0 20px' }}>
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
                onClick={dismissAllAlerts}
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
          <div className="flex scrollbar-hide" style={{ gap: 4, marginBottom: 14, overflowX: 'auto' }}>
            {TABS.map(tab => {
              const isActive = filter === tab.id;
              const count = filterAlerts(visibleAlerts, tab.id).length;
              return (
                <button
                  key={tab.id}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredAlerts.map(alert => {
              const style = ALERT_STYLE[alert.type];
              const kr = alert.symbol && alert.symbol !== 'PORTFOLIO' ? (STOCK_KR[alert.symbol] || alert.symbol) : null;

              return (
                <div
                  key={alert.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: style.bg,
                    border: style.border,
                    position: 'relative',
                  }}
                >
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="cursor-pointer"
                    style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', padding: 10, color: 'var(--text-tertiary, #B0B8C1)' }}
                  >
                    <X size={12} />
                  </button>

                  <div className="flex items-center" style={{ gap: 6, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: style.color,
                      background: style.bg, padding: '1px 6px', borderRadius: 4, border: style.border,
                    }}>
                      {style.icon} {style.label}
                    </span>
                    {kr && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)' }}>{kr}</span>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginLeft: 'auto', paddingRight: 16 }}>
                      {getRelativeTime(alert.timestamp)}
                    </span>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)', lineHeight: 1.5, marginBottom: 2 }}>
                    {alert.message}
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>
                    {alert.detail}
                  </div>

                  {alert.symbol && alert.symbol !== 'PORTFOLIO' && (
                    <div
                      onClick={() => { setAnalysisSymbol(alert.symbol); onClose(); }}
                      className="cursor-pointer"
                      style={{ fontSize: 12, fontWeight: 600, marginTop: 8, color: style.color }}
                    >
                      분석 보기 ›
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
  );
}
