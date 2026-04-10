'use client';

import { useMemo, useEffect, useState, useRef } from 'react';
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
    // 환차익 추적: KRW 기준 실제 매수 비용 (purchaseRate 있는 종목만)
    let totalCostKrw = 0;
    let totalValueKrw = 0;
    let hasFxData = false;

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
        const isKR = s.symbol.endsWith('.KS') || s.symbol.endsWith('.KQ');
        if (!isKR && s.purchaseRate && s.purchaseRate > 0) {
          totalCostKrw += s.avgCost * s.shares * s.purchaseRate;
          totalValueKrw += q.c * s.shares * usdKrw;
          hasFxData = true;
        }
      }
    });

    const totalPL = totalValue - totalCost;
    // 환차익 포함 실제 KRW P&L (purchaseRate 있는 종목들만)
    const totalPLWon = hasFxData
      ? totalValueKrw - totalCostKrw  // 실제 원화 손익
      : totalPL * usdKrw;             // fallback: 현재 환율 단순 환산
    const totalPLPct = hasFxData && totalCostKrw > 0
      ? (totalPLWon / totalCostKrw) * 100
      : totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    const prevValue = totalValue - todayChange;
    const todayPctRaw = prevValue > 0 ? (todayChange / prevValue) * 100 : 0;
    const todayPct = Math.max(-999, Math.min(999, todayPctRaw)); // 극단값 캡

    return {
      totalPL, totalPLPct, totalValue, totalCost, holdingCount,
      todayChange, todayPct,
      totalPLWon,
      totalValueWon: totalValue * usdKrw,
      totalCostWon: hasFxData ? totalCostKrw : totalCost * usdKrw,
      todayChangeWon: todayChange * usdKrw,
      usdKrw,
      bestSymbol, bestDp, worstSymbol, worstDp,
      hasInvestment: totalCost > 0,
      hasFxData,
      sp: macroData['S&P 500'] as MacroEntry | undefined,
      nasdaq: macroData['NASDAQ'] as MacroEntry | undefined,
    };
  }, [stocks, macroData]);

  const urgentAlerts = alerts.filter(a => a.severity <= 2 && !dismissedAlerts.includes(a.id)).slice(0, 2);
  const isGain = data.totalPL >= 0;
  const todayGain = data.todayChange >= 0;
  // 손실 5% 이상이면 significant loss
  const significantLoss = data.totalPLPct < -5;

  // [C1 FIX] 감성 인사 — 데이터 로드 후 손실 상태 반영해 1회 갱신
  const [greetData, setGreetData] = useState(() => getGreeting(false));
  const greetInitialized = useRef(false);
  useEffect(() => {
    if (!greetInitialized.current && data.hasInvestment) {
      greetInitialized.current = true;
      setGreetData(getGreeting(!isGain));
    }
  }, [data.hasInvestment, isGain]);

  const [dailyTerm] = useState(() => getDailyTerm());

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

  // 시세 로딩 전이면 간단 표시 (null 반환 대신)
  if (!data.hasInvestment && !data.bestSymbol) {
    return (
      <div className="card-enter" style={{ padding: '20px', borderRadius: 16, background: 'var(--bg-subtle, #FAFBFF)', border: '1px solid var(--border-light, #F2F4F6)', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>{greetData.emoji} {greetData.text}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)' }}>시세 데이터를 불러오는 중...</div>
      </div>
    );
  }

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
      {/* [H2] 긴급 알림 (severity ≤ 2) */}
      {urgentAlerts.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {urgentAlerts.map(a => (
            <div
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 11, padding: '6px 10px', borderRadius: 8, marginBottom: 4,
                background: a.severity === 1 ? 'rgba(239,68,82,0.07)' : 'rgba(255,149,0,0.07)',
                color: a.severity === 1 ? '#EF4452' : '#FF9500',
              }}
            >
              <span>⚠️ {a.message}</span>
              <button
                onClick={() => dismissAlert(a.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', padding: '0 4px' }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Row 1: 인사 + [C3] 통화 토글 (P&L 행에서 분리) + [H1] 출석 */}
      <div className="flex items-center flex-wrap" style={{ marginBottom: 10, gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', flex: 1, minWidth: 0 }}>
          {greetData.emoji} {greetData.text}
        </span>
        {/* [H1 FIX] 심각한 손실 시 streak 숨김 */}
        {streak > 0 && !significantLoss && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', background: 'var(--bg-subtle, #F2F4F6)', padding: '2px 8px', borderRadius: 10 }}>
            🔥 {streak}일
          </span>
        )}
        {/* [C3 FIX] 통화 토글을 Row 1으로 이동 → P&L 공간 확보 */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => setCurrency('KRW')}
            className="cursor-pointer"
            style={{
              padding: '6px 10px', fontSize: 11, minHeight: 44, fontWeight: currency === 'KRW' ? 700 : 400,
              color: currency === 'KRW' ? 'var(--surface, #fff)' : 'var(--text-tertiary, #8B95A1)',
              background: currency === 'KRW' ? 'var(--text-primary, #191F28)' : 'transparent',
              border: '1px solid var(--border-light, #E5E8EB)', borderRadius: '6px 0 0 6px',
            }}
          >₩</button>
          <button
            onClick={() => setCurrency('USD')}
            className="cursor-pointer"
            style={{
              padding: '6px 10px', fontSize: 11, minHeight: 44, fontWeight: currency === 'USD' ? 700 : 400,
              color: currency === 'USD' ? 'var(--surface, #fff)' : 'var(--text-tertiary, #8B95A1)',
              background: currency === 'USD' ? 'var(--text-primary, #191F28)' : 'transparent',
              border: '1px solid var(--border-light, #E5E8EB)', borderLeft: 'none', borderRadius: '0 6px 6px 0',
            }}
          >$</button>
        </div>
      </div>

      {/* Row 2: 수익률 + 요약 — PC 2컬럼, 모바일 세로 스택 */}
      {data.hasInvestment ? (
        <div className="dashboard-main-grid">
          <style>{`
            .dashboard-main-grid { display: flex; flex-direction: column; gap: 8px; }
            @media (min-width: 768px) {
              .dashboard-main-grid { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: start; }
            }
          `}</style>

          {/* 왼쪽: 큰 숫자 (풀 너비 확보) + 오늘 변동 */}
          <div>
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
            <div className="flex flex-wrap items-center" style={{ marginTop: 8, gap: 8 }}>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
                color: todayGain ? '#EF4452' : '#3182F6',
                background: todayGain ? 'rgba(239,68,82,0.06)' : 'rgba(49,130,246,0.06)',
              }}>
                오늘 {todayGain ? '▲' : '▼'} {currency === 'KRW' ? formatKRW(Math.round(data.todayChangeWon)) : `$${data.todayChange.toFixed(2)}`} ({todayGain ? '+' : ''}{data.todayPct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* 오른쪽: 총 평가/투자/종목 (PC에서만 오른쪽, 모바일은 아래) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary, #8B95A1)' }}>
            <div className="flex items-center justify-between" style={{ gap: 16 }}>
              <span>총 평가</span>
              <strong style={{ color: 'var(--text-primary, #191F28)' }}>
                {currency === 'KRW' ? formatKRW(Math.round(data.totalValueWon), { suffix: '원', prefix: false }) : `$${data.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </strong>
            </div>
            <div className="flex items-center justify-between" style={{ gap: 16 }}>
              <span>총 투자</span>
              <strong style={{ color: 'var(--text-primary, #191F28)' }}>
                {currency === 'KRW' ? formatKRW(Math.round(data.totalCostWon), { suffix: '원', prefix: false }) : `$${data.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </strong>
            </div>
            <div className="flex items-center justify-between" style={{ gap: 16 }}>
              <span>종목</span>
              <strong style={{ color: 'var(--text-primary, #191F28)' }}>{data.holdingCount}개</strong>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div className="skeleton-shimmer" style={{ width: 200, height: 36, borderRadius: 8, margin: '0 auto 8px' }} />
          <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)' }}>시세 데이터를 불러오는 중...</div>
        </div>
      )}

      {/* Row 3: [C2 FIX] "어제 시장" → "시장 현황" + 내 종목 best/worst */}
      {data.bestSymbol && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-light, #F2F4F6)', fontSize: 12, color: 'var(--text-tertiary, #8B95A1)' }}>
          시장 현황 <strong style={{ color: avgMarket >= 0 ? '#EF4452' : '#3182F6' }}>{marketLabel}</strong>
          {' · 내 종목 · '}
          <span onClick={() => setAnalysisSymbol(data.bestSymbol)} style={{ cursor: 'pointer', color: '#EF4452', fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}>
            {bestKr} {data.bestDp >= 0 ? '+' : ''}{data.bestDp.toFixed(1)}%
          </span>
          {' · '}
          <span onClick={() => setAnalysisSymbol(data.worstSymbol)} style={{ cursor: 'pointer', color: '#3182F6', fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}>
            {worstKr} {data.worstDp >= 0 ? '+' : ''}{data.worstDp.toFixed(1)}%
          </span>
        </div>
      )}

      {/* 오늘의 경제 상식 — 접이식 */}
      <TermTip term={dailyTerm} />
    </div>
  );
}

function TermTip({ term }: { term: { term: string; simple: string; analogy: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="cursor-pointer"
        style={{ background: 'none', border: 'none', padding: '6px 0', fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', display: 'flex', alignItems: 'center', gap: 4, width: '100%', minHeight: 44 }}
      >
        <span>💡 모르는 게 당연해요 — 오늘의 경제 상식 (쉬운 설명)</span>
        <span style={{ marginLeft: 'auto', fontSize: 10 }}>{open ? '접기 ▲' : '펼치기 ▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-primary, #191F28)', fontWeight: 600, marginBottom: 2 }}>
            {term.term} — {term.simple}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6 }}>
            {term.analogy}
          </div>
        </div>
      )}
    </div>
  );
}
