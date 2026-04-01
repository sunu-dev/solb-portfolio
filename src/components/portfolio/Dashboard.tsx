'use client';

import { useMemo, useEffect, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';
import type { QuoteData, MacroEntry } from '@/config/constants';
import { getGreeting } from '@/config/greetings';
import { getDailyTerm } from '@/config/dailyTerms';

export default function Dashboard() {
  const {
    stocks, macroData, alerts, dismissedAlerts, dismissAlert,
    setAnalysisSymbol, currency, setCurrency,
  } = usePortfolioStore();

  // 출석 데이터
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('solb_streak');
      if (raw) setStreak(JSON.parse(raw).count || 0);
    } catch { /* ignore */ }
  }, []);

  const data = useMemo(() => {
    const investing = stocks.investing || [];
    const usdKrw = (macroData['USD/KRW'] as MacroEntry | undefined)?.value || 1400;

    let totalValue = 0, totalCost = 0, holdingCount = 0;
    let todayChange = 0;
    let bestSymbol = '', bestDp = -Infinity;
    let worstSymbol = '', worstDp = Infinity;

    investing.forEach(s => {
      const q = macroData[s.symbol] as QuoteData | undefined;
      if (!q?.c) return;
      const dp = q.dp || 0;
      if (dp > bestDp) { bestDp = dp; bestSymbol = s.symbol; }
      if (dp < worstDp) { worstDp = dp; worstSymbol = s.symbol; }
      if (s.avgCost > 0 && s.shares > 0) {
        totalValue += q.c * s.shares;
        totalCost += s.avgCost * s.shares;
        holdingCount++;
        todayChange += (q.d || 0) * s.shares;
      }
    });

    const totalPL = totalValue - totalCost;
    const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    const todayPct = totalValue > 0 ? (todayChange / (totalValue - todayChange)) * 100 : 0;

    return {
      totalPL, totalPLPct, totalValue, totalCost, holdingCount,
      todayChange, todayPct,
      totalPLWon: totalPL * usdKrw,
      totalValueWon: totalValue * usdKrw,
      totalCostWon: totalCost * usdKrw,
      todayChangeWon: todayChange * usdKrw,
      usdKrw,
      bestSymbol, bestDp, worstSymbol, worstDp,
      hasInvestment: totalCost > 0,
      sp: macroData['S&P 500'] as MacroEntry | undefined,
      nasdaq: macroData['NASDAQ'] as MacroEntry | undefined,
    };
  }, [stocks, macroData]);

  const urgentAlerts = alerts.filter(a => a.severity <= 2 && !dismissedAlerts.includes(a.id)).slice(0, 3);
  const isGain = data.totalPL >= 0;
  const todayGain = data.todayChange >= 0;

  // 감성 인사 시스템
  const greetData = getGreeting(data.totalPL < 0);
  const dailyTerm = getDailyTerm();

  // 시장 요약
  const spCp = data.sp?.changePercent || 0;
  const nasdaqCp = data.nasdaq?.changePercent || 0;
  const avgMarket = (spCp + nasdaqCp) / 2;
  let marketLabel = '보합';
  if (avgMarket > 1) marketLabel = '상승';
  else if (avgMarket > 0.3) marketLabel = '소폭 상승';
  else if (avgMarket < -1) marketLabel = '하락';
  else if (avgMarket < -0.3) marketLabel = '소폭 하락';

  const bestKr = STOCK_KR[data.bestSymbol] || data.bestSymbol;
  const worstKr = STOCK_KR[data.worstSymbol] || data.worstSymbol;

  if (!data.hasInvestment && !data.bestSymbol) return null;

  return (
    <div
      className="card-enter dashboard-card"
      style={{
        padding: '24px',
        borderRadius: 16,
        background: 'linear-gradient(180deg, var(--bg-subtle, #FAFBFF) 0%, var(--surface, white) 100%)',
        border: '1px solid var(--border-light, #F2F4F6)',
        marginBottom: 16,
      }}
    >
      {/* Row 1: 감성 인사 (크게) */}
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
          {greetData.emoji} {greetData.text}
        </span>
      </div>

      {/* Row 2: 출석 + 통화 토글 (작게) */}
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div className="flex items-center" style={{ gap: 6 }}>
          {streak > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', background: 'var(--bg-subtle, #F2F4F6)', padding: '2px 8px', borderRadius: 10 }}>
              🔥 {streak}일 연속
            </span>
          )}
        </div>
        <div className="flex items-center">
          <button
            onClick={() => setCurrency('KRW')}
            style={{
              padding: '5px 10px', fontSize: 11, fontWeight: currency === 'KRW' ? 700 : 400,
              color: currency === 'KRW' ? '#fff' : 'var(--text-tertiary, #8B95A1)',
              background: currency === 'KRW' ? 'var(--text-primary, #191F28)' : 'transparent',
              border: '1px solid var(--border-light, #E5E8EB)', borderRadius: '6px 0 0 6px', cursor: 'pointer',
            }}
          >₩</button>
          <button
            onClick={() => setCurrency('USD')}
            style={{
              padding: '5px 10px', fontSize: 11, fontWeight: currency === 'USD' ? 700 : 400,
              color: currency === 'USD' ? '#fff' : 'var(--text-tertiary, #8B95A1)',
              background: currency === 'USD' ? 'var(--text-primary, #191F28)' : 'transparent',
              border: '1px solid var(--border-light, #E5E8EB)', borderLeft: 'none', borderRadius: '0 6px 6px 0', cursor: 'pointer',
            }}
          >$</button>
        </div>
      </div>

      {/* Row 2: 큰 수익률 숫자 */}
      {data.hasInvestment ? (
        <>
          <div className="flex items-baseline flex-wrap" style={{ gap: 8 }}>
            <span
              className="tabular-nums"
              style={{ fontSize: 'clamp(24px, 7vw, 32px)', fontWeight: 800, lineHeight: 1.1, color: isGain ? '#EF4452' : '#3182F6' }}
            >
              {currency === 'KRW'
                ? `${isGain ? '+' : '-'}${formatKRW(Math.abs(data.totalPLWon), { suffix: '원', prefix: false })}`
                : `${isGain ? '+' : '-'}$${Math.abs(data.totalPL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
            </span>
            <span style={{ fontSize: 'clamp(13px, 3.5vw, 16px)', fontWeight: 600, color: isGain ? '#EF4452' : '#3182F6' }}>
              ({isGain ? '+' : ''}{data.totalPLPct.toFixed(2)}%)
            </span>
          </div>

          {/* 오늘 변동 */}
          <div className="flex flex-wrap items-center" style={{ marginTop: 8, gap: 8 }}>
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
              color: todayGain ? '#EF4452' : '#3182F6',
              background: todayGain ? 'rgba(239,68,82,0.06)' : 'rgba(49,130,246,0.06)',
            }}>
              오늘 {todayGain ? '▲' : '▼'} {currency === 'KRW' ? formatKRW(Math.round(data.todayChangeWon)) : `$${data.todayChange.toFixed(2)}`} ({todayGain ? '+' : ''}{data.todayPct.toFixed(2)}%)
            </span>
          </div>

          {/* 총 평가/투자/종목 */}
          <div className="flex items-center flex-wrap" style={{ gap: 12, marginTop: 10, fontSize: 13, color: 'var(--text-secondary, #8B95A1)' }}>
            <span>총 평가 <strong style={{ color: 'var(--text-primary, #191F28)' }}>{currency === 'KRW' ? formatKRW(Math.round(data.totalValueWon), { suffix: '원', prefix: false }) : `$${data.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</strong></span>
            <span style={{ width: 1, height: 14, background: 'var(--text-tertiary, #B0B8C1)', opacity: 0.4 }} />
            <span>총 투자 <strong style={{ color: 'var(--text-primary, #191F28)' }}>{currency === 'KRW' ? formatKRW(Math.round(data.totalCostWon), { suffix: '원', prefix: false }) : `$${data.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</strong></span>
            <span style={{ width: 1, height: 14, background: 'var(--text-tertiary, #B0B8C1)', opacity: 0.4 }} />
            <span>종목 <strong style={{ color: 'var(--text-primary, #191F28)' }}>{data.holdingCount}개</strong></span>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div className="skeleton-shimmer" style={{ width: 200, height: 36, borderRadius: 8, margin: '0 auto 8px' }} />
          <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)' }}>시세 데이터를 불러오는 중...</div>
        </div>
      )}

      {/* Row 3: 알림 + 시장 요약 (한 줄씩) */}
      {(urgentAlerts.length > 0 || data.bestSymbol) && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
          {/* 긴급 알림 */}
          {urgentAlerts.map(a => (
            <div key={a.id} className="flex items-start" style={{ gap: 6, fontSize: 12, color: 'var(--text-secondary, #4E5968)', marginBottom: 4, lineHeight: 1.5 }}>
              <span style={{ flexShrink: 0 }}>{a.type === 'urgent' ? '🚨' : '⚠️'}</span>
              <span style={{ flex: 1 }}>{a.message}</span>
              <button onClick={() => dismissAlert(a.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary, #B0B8C1)', cursor: 'pointer', padding: 2, fontSize: 10 }}>✕</button>
            </div>
          ))}

          {/* 시장 + Best/Worst 한 줄 */}
          {data.bestSymbol && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary, #8B95A1)', marginTop: urgentAlerts.length > 0 ? 6 : 0 }}>
              어제 시장 <strong style={{ color: avgMarket >= 0 ? '#EF4452' : '#3182F6' }}>{marketLabel}</strong>
              {' · '}
              <span onClick={() => setAnalysisSymbol(data.bestSymbol)} style={{ cursor: 'pointer', color: '#EF4452', fontWeight: 600 }}>
                {bestKr} {data.bestDp >= 0 ? '+' : ''}{data.bestDp.toFixed(1)}%
              </span>
              {' · '}
              <span onClick={() => setAnalysisSymbol(data.worstSymbol)} style={{ cursor: 'pointer', color: '#3182F6', fontWeight: 600 }}>
                {worstKr} {data.worstDp >= 0 ? '+' : ''}{data.worstDp.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* 오늘의 경제 상식 */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 4 }}>💡 모르는 게 당연해요 — 오늘의 경제 상식</div>
        <div style={{ fontSize: 12, color: 'var(--text-primary, #191F28)', fontWeight: 600, marginBottom: 2 }}>
          {dailyTerm.term} — {dailyTerm.simple}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6 }}>
          {dailyTerm.analogy}
        </div>
      </div>
    </div>
  );
}
