'use client';

import { useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';
import type { QuoteData } from '@/config/constants';

export default function MorningBriefing() {
  const { stocks, macroData, alerts, dismissedAlerts, setAnalysisSymbol } = usePortfolioStore();

  const briefing = useMemo(() => {
    const investing = stocks.investing || [];
    if (investing.length === 0) return null;

    // 시장 요약
    const sp = macroData['S&P 500'] as { value?: number; changePercent?: number } | undefined;
    const nasdaq = macroData['NASDAQ'] as { value?: number; changePercent?: number } | undefined;
    const spCp = sp?.changePercent || 0;
    const nasdaqCp = nasdaq?.changePercent || 0;

    let marketSentiment = '보합';
    const avg = (spCp + nasdaqCp) / 2;
    if (avg > 1) marketSentiment = '상승';
    else if (avg > 0.3) marketSentiment = '소폭 상승';
    else if (avg < -1) marketSentiment = '하락';
    else if (avg < -0.3) marketSentiment = '소폭 하락';

    // 내 종목 중 가장 많이 오른/내린 종목
    let bestSymbol = '', bestDp = -Infinity;
    let worstSymbol = '', worstDp = Infinity;
    let totalPL = 0;
    const usdKrw = (macroData['USD/KRW'] as { value?: number })?.value || 1400;

    investing.forEach(s => {
      const q = macroData[s.symbol] as QuoteData | undefined;
      if (!q?.c) return;
      const dp = q.dp || 0;
      if (dp > bestDp) { bestDp = dp; bestSymbol = s.symbol; }
      if (dp < worstDp) { worstDp = dp; worstSymbol = s.symbol; }
      if (s.avgCost > 0 && s.shares > 0) {
        totalPL += (q.c - s.avgCost) * s.shares;
      }
    });

    // 주목할 알림
    const activeAlerts = alerts.filter(a => !dismissedAlerts.includes(a.id)).slice(0, 2);

    return {
      marketSentiment,
      spCp,
      nasdaqCp,
      bestSymbol,
      bestDp,
      worstSymbol,
      worstDp,
      totalPL,
      totalPLWon: totalPL * usdKrw,
      stockCount: investing.length,
      activeAlerts,
    };
  }, [stocks, macroData, alerts, dismissedAlerts]);

  if (!briefing) return null;
  if (!briefing.bestSymbol) return null; // 시세 아직 안 옴

  const bestKr = STOCK_KR[briefing.bestSymbol] || briefing.bestSymbol;
  const worstKr = STOCK_KR[briefing.worstSymbol] || briefing.worstSymbol;
  const isProfit = briefing.totalPL >= 0;

  // 시간대별 인사
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '오늘도 수고하셨어요' : '오늘 하루 정리해볼게요';

  return (
    <div
      className="card-enter"
      style={{
        padding: '16px 20px',
        borderRadius: 16,
        background: 'var(--surface, white)',
        border: '1px solid var(--border-light, #F2F4F6)',
        marginBottom: 16,
      }}
    >
      {/* 인사 */}
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 12 }}>
        {greeting} 👋
      </div>

      {/* 시장 + 내 포트폴리오 한 줄 요약 */}
      <div style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.7, marginBottom: 12 }}>
        어제 미국 시장은{' '}
        <strong style={{ color: briefing.spCp >= 0 ? '#EF4452' : '#3182F6' }}>
          {briefing.marketSentiment}
        </strong>
        이었어요.{' '}
        {briefing.stockCount}개 투자 종목 중{' '}
        <span
          onClick={() => briefing.bestSymbol && setAnalysisSymbol(briefing.bestSymbol)}
          style={{ fontWeight: 600, color: '#EF4452', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
        >
          {bestKr}({briefing.bestDp >= 0 ? '+' : ''}{briefing.bestDp.toFixed(1)}%)
        </span>
        이 가장 좋았고,{' '}
        <span
          onClick={() => briefing.worstSymbol && setAnalysisSymbol(briefing.worstSymbol)}
          style={{ fontWeight: 600, color: '#3182F6', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
        >
          {worstKr}({briefing.worstDp >= 0 ? '+' : ''}{briefing.worstDp.toFixed(1)}%)
        </span>
        이 가장 약했어요.
      </div>

      {/* 전체 손익 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 10,
        background: isProfit ? 'rgba(239,68,82,0.04)' : 'rgba(49,130,246,0.04)',
        marginBottom: briefing.activeAlerts.length > 0 ? 10 : 0,
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)' }}>전체 손익</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 14,
          fontWeight: 700,
          color: isProfit ? '#EF4452' : '#3182F6',
        }}>
          {briefing.totalPL >= 0 ? '+' : ''}{formatKRW(Math.round(briefing.totalPLWon))}
        </span>
      </div>

      {/* 주목할 알림 (최대 2개) */}
      {briefing.activeAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {briefing.activeAlerts.map(a => (
            <div
              key={a.id}
              style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', display: 'flex', gap: 6, alignItems: 'center' }}
            >
              <span style={{ fontSize: 10 }}>
                {a.type === 'urgent' ? '🚨' : a.type === 'risk' ? '⚠️' : a.type === 'insight' ? '✨' : '💡'}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
