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
    stocks, macroData, alerts, dismissedAlerts,
    setAnalysisSymbol, currency, setCurrency, networkError, setNetworkError,
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
    let totalCostKrw = 0;
    let totalValueKrw = 0;
    let hasFxData = false;
    let hasPortfolioStocks = false;

    investing.forEach(s => {
      if (s.avgCost > 0 && s.shares > 0) hasPortfolioStocks = true;
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
    const totalPLWon = hasFxData ? totalValueKrw - totalCostKrw : totalPL * usdKrw;
    const totalPLPct = hasFxData && totalCostKrw > 0 ? (totalPLWon / totalCostKrw) * 100 : totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    const prevValue = totalValue - todayChange;
    const todayPctRaw = prevValue > 0 ? (todayChange / prevValue) * 100 : 0;
    const todayPct = Math.max(-999, Math.min(999, todayPctRaw));

    return {
      totalPL, totalPLPct, totalValue, totalCost, holdingCount,
      todayChange, todayPct,
      totalPLWon,
      totalValueWon: totalValue * usdKrw,
      totalCostWon: hasFxData ? totalCostKrw : totalCost * usdKrw,
      todayChangeWon: todayChange * usdKrw,
      usdKrw,
      bestSymbol, bestDp, worstSymbol, worstDp,
      hasInvestment: hasPortfolioStocks,
      quotesLoaded: totalCost > 0,
      sp: macroData['S&P 500'] as MacroEntry | undefined,
      nasdaq: macroData['NASDAQ'] as MacroEntry | undefined,
    };
  }, [stocks, macroData]);

  const isGain = data.totalPL >= 0;
  const todayGain = data.todayChange >= 0;
  const significantLoss = data.totalPLPct < -5;

  const [greetData, setGreetData] = useState(() => getGreeting(false));
  const greetInitialized = useRef(false);
  useEffect(() => {
    if (!greetInitialized.current && data.hasInvestment) {
      greetInitialized.current = true;
      setGreetData(getGreeting(!isGain));
    }
  }, [data.hasInvestment, isGain]);

  const [dailyTerm] = useState(() => getDailyTerm());

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

  return (
    <div className="card-enter overflow-hidden" style={{ borderRadius: 24, background: 'var(--surface, white)', border: '1px solid var(--border-light, #F2F4F6)', marginBottom: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
      {/* 네트워크 에러 배너 */}
      {networkError && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px', fontSize: 12, fontWeight: 500,
          background: 'rgba(255,149,0,0.08)', color: '#FF9500',
          borderBottom: '1px solid rgba(255,149,0,0.12)',
        }}>
          <span>⚠️ {networkError}</span>
          <button
            onClick={() => setNetworkError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#FF9500', padding: '0 4px' }}
          >✕</button>
        </div>
      )}

      {/* Hero Visual Section */}
      <div style={{
        position: 'relative',
        padding: '32px 24px 24px',
        background: isGain
          ? 'linear-gradient(135deg, #F0F7FF 0%, #F5F3FF 100%)'
          : 'linear-gradient(135deg, #FFF5F5 0%, #FFF9F0 100%)',
        overflow: 'hidden'
      }}>
        {/* Decorative Circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'white', opacity: 0.3, filter: 'blur(30px)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: '20%', width: 80, height: 80, borderRadius: '50%', background: isGain ? '#3182F6' : '#EF4452', opacity: 0.05, filter: 'blur(20px)' }} />

        {/* Hero Content */}
        <div className="flex items-start justify-between">
          <div style={{ flex: 1, zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: isGain ? '#3182F6' : '#EF4452', background: 'white', padding: '4px 12px', borderRadius: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                {isGain ? '✨ 순항 중' : '☁️ 잠시 흐림'}
              </span>
              {streak > 0 && !significantLoss && (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#FF9500', background: 'rgba(255,149,0,0.1)', padding: '4px 10px', borderRadius: 20 }}>
                  🔥 {streak}일째 함께해요
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 'clamp(18px, 5vw, 24px)', fontWeight: 800, color: 'var(--text-primary, #191F28)', lineHeight: 1.4, margin: 0 }}>
              {greetData.text}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', marginTop: 8, maxWidth: '80%' }}>
              주비가 당신의 포트폴리오를 든든하게 지켜보고 있어요.
            </p>
          </div>

          {/* Icon/Illustration Area */}
          <div style={{ width: 100, height: 100, display: 'flex', alignItems: 'center', justifySelf: 'flex-end', opacity: 0.9 }}>
            {/* '주비' 캐릭터 아이콘 — 스마트 비서의 상징 */}
            <div style={{ 
              position: 'relative',
              width: 80,
              height: 80,
              background: 'linear-gradient(135deg, #3182F6 0%, #1B64DA 100%)',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(49, 130, 246, 0.2)',
              transform: 'rotate(-5deg)'
            }}>
              <svg viewBox="0 0 100 100" style={{ width: '60%', height: '60%' }}>
                <polyline points="10,80 28,54 48,62 68,34 86,20" stroke="#FF4444" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="86" cy="20" r="8" fill="#FF4444" />
              </svg>
              {!isGain && (
                <div style={{ 
                  position: 'absolute', 
                  top: -5, 
                  right: -5, 
                  fontSize: 24,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}>
                  ☁️
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Currency Switch — Floating */}
        <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', background: 'white', borderRadius: 8, padding: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 2 }}>
          <button onClick={() => setCurrency('KRW')} style={{ padding: '6px 12px', fontSize: 11, fontWeight: currency === 'KRW' ? 700 : 400, color: currency === 'KRW' ? 'white' : '#8B95A1', background: currency === 'KRW' ? '#191F28' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer' }}>₩</button>
          <button onClick={() => setCurrency('USD')} style={{ padding: '6px 12px', fontSize: 11, fontWeight: currency === 'USD' ? 700 : 400, color: currency === 'USD' ? 'white' : '#8B95A1', background: currency === 'USD' ? '#191F28' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer' }}>$</button>
        </div>
      </div>

      {/* Main Stats Section — [S2] 수치 가독성 및 정돈 */}
      <div style={{ padding: '24px' }}>
        {data.hasInvestment ? (
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-8">
            {/* P&L Display */}
            <div style={{ paddingRight: 24, borderRight: '1px solid var(--border-light, #F2F4F6)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 4, fontWeight: 500 }}>전체 수익 현황</div>
              {!data.quotesLoaded ? (
                <div>
                  <div className="skeleton-shimmer" style={{ width: 180, height: 36, borderRadius: 8, marginBottom: 8 }} />
                  <div className="skeleton-shimmer" style={{ width: 100, height: 20, borderRadius: 6 }} />
                </div>
              ) : (
              <div className="flex items-baseline gap-2">
                <span className="tabular-nums" style={{ fontSize: 'clamp(28px, 6vw, 36px)', fontWeight: 800, color: isGain ? '#EF4452' : '#3182F6', letterSpacing: '-0.02em' }}>
                  {currency === 'KRW'
                    ? `${isGain ? '+' : '-'}${formatKRW(Math.abs(data.totalPLWon), { suffix: '원', prefix: false })}`
                    : `${isGain ? '+' : '-'}$${Math.abs(data.totalPL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  }
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: isGain ? '#EF4452' : '#3182F6' }}>
                  ({isGain ? '+' : '-'}{Math.abs(data.totalPLPct).toFixed(2)}%)
                </span>
              </div>
              )}
              {data.quotesLoaded && (
                <div className="flex items-center gap-2 mt-4">
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                    color: todayGain ? '#EF4452' : '#3182F6',
                    background: todayGain ? 'rgba(239,68,82,0.06)' : 'rgba(49,130,246,0.06)',
                  }}>
                    오늘 {todayGain ? '▲' : '▼'} {currency === 'KRW' ? formatKRW(Math.round(data.todayChangeWon)) : `$${data.todayChange.toFixed(2)}`} ({todayGain ? '+' : ''}{data.todayPct.toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>

            {/* Sub Stats List */}
            <div className="flex flex-col justify-center gap-3">
              {!data.quotesLoaded ? (
                [0,1,2].map(i => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="skeleton-shimmer" style={{ width: 48, height: 14, borderRadius: 4 }} />
                    <div className="skeleton-shimmer" style={{ width: 80, height: 14, borderRadius: 4 }} />
                  </div>
                ))
              ) : [
                { label: '총 평가', value: currency === 'KRW' ? formatKRW(Math.round(data.totalValueWon), { suffix: '원', prefix: false }) : `$${data.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                { label: '총 투자', value: currency === 'KRW' ? formatKRW(Math.round(data.totalCostWon), { suffix: '원', prefix: false }) : `$${data.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                { label: '보유 종목', value: `${data.holdingCount}개` },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>{item.label}</span>
                  <strong style={{ color: 'var(--text-primary, #191F28)', fontWeight: 600 }}>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-tertiary, #B0B8C1)', fontSize: 13 }}>
            종목을 추가하면 수익 현황이 여기에 표시돼요.
          </div>
        )}

        {/* Market Context — [S3] 하단 정보 요약 */}
        {data.bestSymbol && (
          <div style={{
            marginTop: 20,
            padding: '12px 16px',
            borderRadius: 12,
            background: 'var(--bg-subtle, #F8F9FA)',
            fontSize: 12,
            color: 'var(--text-secondary, #4E5968)',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <span style={{ color: 'var(--text-tertiary, #B0B8C1)', fontWeight: 600 }}>시장 현황</span>
            <strong style={{ color: avgMarket >= 0 ? '#EF4452' : '#3182F6' }}>{marketLabel}</strong>
            <span style={{ width: 1, height: 10, background: '#E5E8EB', margin: '0 4px' }} />
            <span>상승 1위: <span onClick={() => setAnalysisSymbol(data.bestSymbol)} style={{ color: '#EF4452', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{bestKr}</span></span>
            <span>하락 1위: <span onClick={() => setAnalysisSymbol(data.worstSymbol)} style={{ color: '#3182F6', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{worstKr}</span></span>
          </div>
        )}

        {/* Term Tip — 접이식 오늘의 지식 */}
        <TermTip term={dailyTerm} />
      </div>
    </div>
  );
}

function TermTip({ term }: { term: { term: string; simple: string; analogy: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 0',
          background: 'none',
          border: 'none',
          fontSize: 11,
          color: 'var(--text-tertiary, #B0B8C1)',
          cursor: 'pointer',
          borderTop: '1px solid var(--border-light, #F2F4F6)',
          marginTop: 8,
          textAlign: 'left'
        }}
      >
        <span>💡 주비의 쉬운 지식 가이드: <strong>{term.term}</strong></span>
        <span style={{ marginLeft: 'auto', fontSize: 10 }}>{open ? '간략히 보기 ▲' : '자세히 보기 ▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, padding: '12px', borderRadius: 12, background: '#FAFBFF', border: '1px solid rgba(49,130,246,0.08)', animation: 'slideDown 0.3s ease' }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary, #191F28)', fontWeight: 700, marginBottom: 4 }}>
            {term.term} — {term.simple}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6 }}>
            {term.analogy}
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
