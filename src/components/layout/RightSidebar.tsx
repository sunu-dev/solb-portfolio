'use client';

import { useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { QuoteData } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';
import { Plus, X } from 'lucide-react';

const ALERT_STYLE: Record<Alert['type'], { icon: string; label: string; bg: string; border: string; color: string }> = {
  urgent: {
    icon: '🚨',
    label: '긴급',
    bg: 'rgba(239,68,82,0.04)',
    border: '1px solid rgba(239,68,82,0.08)',
    color: '#EF4452',
  },
  risk: {
    icon: '⚠️',
    label: '리스크',
    bg: 'rgba(255,149,0,0.04)',
    border: '1px solid rgba(255,149,0,0.08)',
    color: '#FF9500',
  },
  opportunity: {
    icon: '💡',
    label: '주목',
    bg: 'rgba(0,198,190,0.04)',
    border: '1px solid rgba(0,198,190,0.08)',
    color: '#00C6BE',
  },
  insight: {
    icon: '✨',
    label: '인사이트',
    bg: 'rgba(49,130,246,0.04)',
    border: '1px solid rgba(49,130,246,0.08)',
    color: '#3182F6',
  },
  celebrate: {
    icon: '🎉',
    label: '달성',
    bg: 'rgba(175,82,222,0.04)',
    border: '1px solid rgba(175,82,222,0.08)',
    color: '#AF52DE',
  },
};

type AlertFilter = 'all' | 'risk' | 'opportunity' | 'insight';

const ALERT_TABS: { id: AlertFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'risk', label: '리스크' },
  { id: 'opportunity', label: '기회' },
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

export default function RightSidebar() {
  const { stocks, macroData, setAnalysisSymbol, alerts, dismissedAlerts, dismissAlert, dismissAllAlerts } = usePortfolioStore();
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');

  const watchingStocks = stocks.watching || [];

  const visibleAlerts = alerts
    .filter(a => !dismissedAlerts.includes(a.id))
    .sort((a, b) => a.severity - b.severity);

  const filteredAlerts = filterAlerts(visibleAlerts, alertFilter);

  return (
    <div>
      {/* 관심 종목 header */}
      <div className="flex items-center gap-1.5">
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>관심 종목</h3>
        <span className="text-[13px] text-[#B0B8C1] font-normal">{watchingStocks.length}</span>
      </div>

      {/* Watching stock list */}
      <div className="mt-6">
        {watchingStocks.map((stock, idx) => {
          const q = macroData[stock.symbol] as QuoteData | undefined;
          const price = q?.c || 0;
          const dp = q?.dp || 0;
          const isGain = dp >= 0;
          const kr = STOCK_KR[stock.symbol] || stock.symbol;
          const avatarColor = getAvatarColor(stock.symbol);

          return (
            <button
              key={stock.symbol}
              onClick={() => setAnalysisSymbol(stock.symbol)}
              className={`w-full flex items-center cursor-pointer hover:bg-[#F9FAFB] dark:hover:bg-[var(--surface-hover)] transition-colors text-left rounded-xl ${
                idx > 0 ? 'border-t border-[#F7F8FA] dark:border-[var(--border-light)]' : ''
              }`}
              style={{ gap: '14px', padding: '14px 4px' }}
            >
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: '44px', height: '44px', backgroundColor: avatarColor }}
              >
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                  {stock.symbol.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[#191F28] dark:text-[var(--text-primary)] truncate">{kr}</div>
                <div className="text-[11px] text-[#B0B8C1]">
                  {stock.symbol}
                  {stock.buyBelow ? ` · 목표 $${stock.buyBelow}` : ''}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13px] font-semibold text-[#191F28] dark:text-[var(--text-primary)] tabular-nums">
                  {price ? `$${price.toFixed(2)}` : '--'}
                </div>
                <div className={`text-[11px] font-medium tabular-nums ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                  {price ? `${isGain ? '▲' : '▼'} ${isGain ? '+' : ''}${dp.toFixed(2)}%` : '--'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Add button */}
      <button
        onClick={() => {
          const searchBtn = document.querySelector('[data-slot="search-trigger"]') as HTMLElement;
          if (searchBtn) searchBtn.click();
        }}
        className="w-full flex items-center justify-center gap-1.5 border-[1.5px] border-dashed border-[#D5DAE0] dark:border-[var(--border-light)] rounded-[12px] text-[13px] text-[#8B95A1] cursor-pointer hover:bg-[#F9FAFB] dark:hover:bg-[var(--surface-hover)] transition-colors"
        style={{ marginTop: '20px', padding: '14px 0', minHeight: '44px' }}
      >
        <Plus className="w-3.5 h-3.5" />
        관심 종목 추가
      </button>

      {/* ============================================
          SOLB AI 알림센터
          ============================================ */}
      <div id="solb-alert-center" style={{ marginTop: '40px' }}>
        {/* Header + badge */}
        <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>SOLB AI</h3>
            {visibleAlerts.length > 0 && (
              <button
                onClick={dismissAllAlerts}
                className="cursor-pointer"
                style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', background: 'none', border: 'none', padding: '2px 6px' }}
              >
                전체 읽음
              </button>
            )}
          </div>
          {visibleAlerts.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#fff',
                background: '#EF4452',
                borderRadius: '10px',
                padding: '2px 8px',
                minWidth: '20px',
                textAlign: 'center',
              }}
            >
              {visibleAlerts.length}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        {visibleAlerts.length > 0 && (
          <div className="flex scrollbar-hide" style={{ gap: 4, marginBottom: 12, overflowX: 'auto' }}>
            {ALERT_TABS.map(tab => {
              const isActive = alertFilter === tab.id;
              const count = filterAlerts(visibleAlerts, tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setAlertFilter(tab.id)}
                  className="cursor-pointer transition-colors"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 20,
                    fontSize: 12,
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
            {filteredAlerts.map((alert) => {
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
                  {/* Dismiss button */}
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="cursor-pointer"
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: 'none',
                      border: 'none',
                      padding: 10,
                      color: 'var(--text-tertiary, #B0B8C1)',
                    }}
                  >
                    <X size={12} />
                  </button>

                  {/* Header: type badge + time */}
                  <div className="flex items-center" style={{ gap: 6, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: style.color,
                      background: style.bg,
                      padding: '1px 6px',
                      borderRadius: 4,
                      border: style.border,
                    }}>
                      {style.icon} {style.label}
                    </span>
                    {kr && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)' }}>
                        {kr}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginLeft: 'auto', paddingRight: 16 }}>
                      {getRelativeTime(alert.timestamp)}
                    </span>
                  </div>

                  {/* Message */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)', lineHeight: 1.5, marginBottom: 2 }}>
                    {alert.message}
                  </div>

                  {/* Detail */}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>
                    {alert.detail}
                  </div>

                  {/* Action link */}
                  {alert.symbol && alert.symbol !== 'PORTFOLIO' && (
                    <div
                      onClick={() => setAnalysisSymbol(alert.symbol)}
                      className="cursor-pointer"
                      style={{ fontSize: 11, fontWeight: 600, marginTop: 8, color: style.color }}
                    >
                      분석 보기 ›
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: '24px 16px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(49,130,246,0.04), rgba(175,82,222,0.04))',
              border: '1px solid rgba(49,130,246,0.08)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#3182F6', marginBottom: 4 }}>
              알림이 없어요
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>
              포트폴리오에 특별한 상황이 없어요.{'\n'}안정적인 상태예요.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
