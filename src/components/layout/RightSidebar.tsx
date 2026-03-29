'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { QuoteData } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';
import { Plus } from 'lucide-react';

const ALERT_STYLE: Record<Alert['type'], { icon: string; label: string; bg: string; border: string; color: string }> = {
  urgent: {
    icon: '🚨',
    label: '긴급 알림',
    bg: 'rgba(239,68,82,0.04)',
    border: '1px solid rgba(239,68,82,0.08)',
    color: '#EF4452',
  },
  risk: {
    icon: '⚠️',
    label: '리스크 알림',
    bg: 'rgba(255,149,0,0.04)',
    border: '1px solid rgba(255,149,0,0.08)',
    color: '#FF9500',
  },
  opportunity: {
    icon: '💡',
    label: '매수 기회',
    bg: 'rgba(0,198,190,0.04)',
    border: '1px solid rgba(0,198,190,0.08)',
    color: '#00C6BE',
  },
  insight: {
    icon: '✨',
    label: 'AI 인사이트',
    bg: 'rgba(49,130,246,0.04)',
    border: '1px solid rgba(49,130,246,0.08)',
    color: '#3182F6',
  },
  celebrate: {
    icon: '🎉',
    label: '목표 달성',
    bg: 'rgba(175,82,222,0.04)',
    border: '1px solid rgba(175,82,222,0.08)',
    color: '#AF52DE',
  },
};

export default function RightSidebar() {
  const { stocks, macroData, setAnalysisSymbol, alerts, dismissedAlerts } = usePortfolioStore();

  const watchingStocks = stocks.watching || [];

  // Filter out dismissed alerts and take top 3
  const visibleAlerts = alerts
    .filter(a => !dismissedAlerts.includes(a.id))
    .slice(0, 3);

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
        style={{ marginTop: '20px', padding: '12px 0' }}
      >
        <Plus className="w-3.5 h-3.5" />
        관심 종목 추가
      </button>

      {/* SOLB AI section — Smart Alerts */}
      <div style={{ marginTop: '40px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>SOLB AI</h3>
          {alerts.length > 0 && (
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
              {alerts.filter(a => !dismissedAlerts.includes(a.id)).length}
            </span>
          )}
        </div>

        {visibleAlerts.length > 0 ? (
          visibleAlerts.map((alert) => {
            const style = ALERT_STYLE[alert.type];
            return (
              <div
                key={alert.id}
                style={{
                  marginTop: '16px',
                  padding: '24px',
                  borderRadius: '16px',
                  background: style.bg,
                  border: style.border,
                }}
              >
                <div className="flex items-center gap-1.5" style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px' }}>{style.icon}</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: style.color,
                    }}
                  >
                    {style.label}
                  </span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #191F28)', lineHeight: 1.5, marginBottom: '4px' }}>
                  {alert.message}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6 }}>
                  {alert.detail}
                </div>
                {alert.symbol && alert.symbol !== 'PORTFOLIO' && (
                  <div
                    onClick={() => setAnalysisSymbol(alert.symbol)}
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      marginTop: '10px',
                      cursor: 'pointer',
                      color: style.color,
                    }}
                  >
                    자세히 보기 ›
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div
            style={{
              marginTop: '16px',
              padding: '24px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(49,130,246,0.04), rgba(175,82,222,0.04))',
              border: '1px solid rgba(49,130,246,0.08)',
            }}
          >
            <div className="flex items-center gap-1.5" style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '14px' }}>✨</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#3182F6' }}>
                AI 포트폴리오 인사이트
              </span>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6 }}>
              현재 포트폴리오에 특별한 알림이 없어요. 안정적인 상태예요.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
