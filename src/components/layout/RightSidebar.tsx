'use client';

import { useState, useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import { CHOK_KR_MAP } from '@/config/chokUniverse';
import type { QuoteData } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';
import { Plus, X } from 'lucide-react';

interface ChokPick {
  symbol: string;
  krName: string;
  reason: string;
  keyMetric: string;
}

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

export default function RightSidebar() {
  const { stocks, macroData, setAnalysisSymbol, alerts, dismissedAlerts, dismissAlert, dismissAllAlerts, getAllSymbols, addStock } = usePortfolioStore();
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');
  // ai-chok은 AiChokSection에서만 fetch — 중복 Gemini 호출 방지
  const [chokPick] = useState<ChokPick | null>(null);

  const watchingSet = new Set(stocks.watching.map(s => s.symbol));

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
          const price = q?.c ?? 0;
          const dp = q?.dp ?? 0;
          const isGain = dp >= 0;
          const isKR = stock.symbol.endsWith('.KS') || stock.symbol.endsWith('.KQ');
          const kr = STOCK_KR[stock.symbol] || stock.symbol;
          const avatarColor = getAvatarColor(stock.symbol);
          const hasData = price > 0;

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
                {hasData ? (
                  <>
                    <div className="text-[13px] font-semibold text-[#191F28] dark:text-[var(--text-primary)] tabular-nums">
                      {isKR ? `${Math.round(price).toLocaleString()}원` : `$${price.toFixed(2)}`}
                    </div>
                    <div className={`text-[11px] font-medium tabular-nums ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                      {isGain ? '▲' : '▼'} {isGain ? '+' : ''}{dp.toFixed(2)}%
                    </div>
                  </>
                ) : (
                  <>
                    <div className="skeleton-shimmer" style={{ width: 56, height: 14, marginBottom: 4, marginLeft: 'auto' }} />
                    <div className="skeleton-shimmer" style={{ width: 40, height: 11, marginLeft: 'auto' }} />
                  </>
                )}
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
          주비 AI 알림센터
          ============================================ */}
      <div id="solb-alert-center" style={{ marginTop: '40px' }}>
        {/* Header + badge */}
        <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>주비 AI</h3>
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

      {/* ============================================
          AI 촉 티저 (사이드바 1개 미리보기)
          ============================================ */}
      {chokPick && (
        <div style={{ marginTop: 40 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <div className="flex items-center" style={{ gap: 6 }}>
              <span style={{ fontSize: 14 }}>🎯</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>AI 촉</h3>
            </div>
          </div>

          <div
            style={{
              borderRadius: 14,
              border: '1px solid var(--border-light, #F2F4F6)',
              padding: '14px 16px',
              background: 'var(--surface, #fff)',
            }}
          >
            {/* Pick header */}
            <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
              <div
                className="rounded-full shrink-0 flex items-center justify-center"
                style={{ width: 34, height: 34, background: getAvatarColor(chokPick.symbol) }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {chokPick.symbol.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                  {chokPick.symbol}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
                  {STOCK_KR[chokPick.symbol] || CHOK_KR_MAP[chokPick.symbol] || chokPick.krName}
                </div>
              </div>
            </div>

            {/* Reason */}
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.55, marginBottom: 8 }}>
              {chokPick.reason}
            </div>

            {/* Key metric */}
            <div
              className="inline-block"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#3182F6',
                background: 'rgba(49,130,246,0.08)',
                padding: '3px 8px',
                borderRadius: 6,
                marginBottom: 12,
              }}
            >
              {chokPick.keyMetric}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setAnalysisSymbol(chokPick.symbol)}
                className="cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'var(--text-primary, #191F28)',
                  color: '#fff',
                  border: 'none',
                }}
              >
                분석 보기
              </button>
              <button
                onClick={() => {
                  if (!watchingSet.has(chokPick.symbol)) {
                    addStock('watching', { symbol: chokPick.symbol, avgCost: 0, shares: 0, targetReturn: 0, buyBelow: 0 });
                  }
                }}
                disabled={watchingSet.has(chokPick.symbol)}
                className="cursor-pointer transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-60"
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  background: watchingSet.has(chokPick.symbol) ? 'var(--bg-subtle, #F2F4F6)' : 'rgba(49,130,246,0.08)',
                  color: watchingSet.has(chokPick.symbol) ? 'var(--text-tertiary, #B0B8C1)' : '#3182F6',
                  border: 'none',
                }}
              >
                {watchingSet.has(chokPick.symbol) ? '✓ 관심' : '+ 관심'}
              </button>
            </div>
          </div>

          <p style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 6, lineHeight: 1.5 }}>
            AI의 발견이에요 · 투자 판단은 본인이
          </p>
        </div>
      )}
    </div>
  );
}
