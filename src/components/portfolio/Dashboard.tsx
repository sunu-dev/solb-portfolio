'use client';

import { useMemo, useEffect, useState, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';
import type { QuoteData, MacroEntry } from '@/config/constants';
import { getGreeting } from '@/config/greetings';
import { getDailyTerm } from '@/config/dailyTerms';
import { calcHealthScore, getHealthLabel, getHealthColor } from '@/utils/portfolioHealth';
import { getMarketStatus, getMarketLabel } from '@/utils/marketHours';

export default function Dashboard() {
  const {
    stocks, macroData, alerts, dismissedAlerts,
    setAnalysisSymbol, currency, setCurrency, networkError, setNetworkError,
    rawCandles,
  } = usePortfolioStore();

  // 출석 데이터
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('solb_streak');
      if (raw) setStreak(JSON.parse(raw).count || 0);
    } catch { /* ignore */ }
  }, []);

  // 미장 개장/마감 상태 — 1분마다 업데이트
  const [marketState, setMarketState] = useState(() => getMarketStatus());
  useEffect(() => {
    const id = setInterval(() => setMarketState(getMarketStatus()), 60_000);
    return () => clearInterval(id);
  }, []);
  const marketCountdown = getMarketLabel(marketState);

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

  // 기간별 포트폴리오 비교 (retrospective: 현재 보유 수량 × N일 전 종가)
  // 주의: 과거 매매 이력 반영 안 함 (근사치), 실제 스냅샷 저장 전까지는 참고용
  const periodCompare = useMemo(() => {
    if (!data.hasInvestment) return null;
    const investing = stocks.investing || [];

    const priceAtDaysAgo = (symbol: string, days: number): number | null => {
      const c = rawCandles[symbol];
      if (!c?.t?.length || !c?.c?.length) return null;
      const targetTs = Date.now() / 1000 - days * 86400;
      for (let i = c.t.length - 1; i >= 0; i--) {
        if (c.t[i] <= targetTs) return c.c[i] || null;
      }
      return null;
    };

    const computePastTotal = (days: number): number | null => {
      let total = 0;
      let coverage = 0;
      for (const s of investing) {
        if (s.avgCost <= 0 || s.shares <= 0) continue;
        const price = priceAtDaysAgo(s.symbol, days);
        if (price != null) {
          total += price * s.shares;
          coverage++;
        }
      }
      // 커버리지가 50% 미만이면 신뢰 불가
      const totalStocks = investing.filter(s => s.avgCost > 0 && s.shares > 0).length;
      if (totalStocks === 0 || coverage / totalStocks < 0.5) return null;
      return total;
    };

    const current = data.totalValue;
    const pastWeek  = computePastTotal(7);
    const pastMonth = computePastTotal(31);

    const fmt = (curr: number, past: number | null) => {
      if (past == null || past === 0) return null;
      const delta = curr - past;
      const pct = (delta / past) * 100;
      return { delta, pct };
    };

    return {
      today: { delta: data.todayChange, pct: data.todayPct, deltaKrw: data.todayChangeWon },
      week:  fmt(current, pastWeek),
      month: fmt(current, pastMonth),
    };
  }, [data.hasInvestment, data.totalValue, data.todayChange, data.todayPct, data.todayChangeWon, stocks.investing, rawCandles]);

  // 포트폴리오 건강 점수
  const health = useMemo(() => {
    if (!data.hasInvestment) return null;
    const investingStocks = (stocks.investing || []).map(s => {
      const q = macroData[s.symbol] as QuoteData | undefined;
      return {
        symbol: s.symbol,
        avgCost: s.avgCost,
        shares: s.shares,
        targetReturn: s.targetReturn,
        currentPrice: q?.c || 0,
        value: (q?.c || 0) * s.shares,
      };
    });
    return calcHealthScore(investingStocks);
  }, [data.hasInvestment, stocks.investing, macroData]);

  return (
    <div className="card-enter overflow-hidden" style={{ borderRadius: 24, background: 'var(--surface, white)', border: '1px solid var(--border-light, #F2F4F6)', marginBottom: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
      {/* 네트워크 에러 배너 */}
      {networkError && (
        <div role="alert" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px', fontSize: 12, fontWeight: 500,
          background: 'var(--color-warning-bg, rgba(255,149,0,0.08))', color: 'var(--color-warning, #FF9500)',
          borderBottom: '1px solid rgba(255,149,0,0.12)',
        }}>
          <span>⚠️ {networkError}</span>
          <button
            onClick={() => setNetworkError(null)}
            aria-label="오류 메시지 닫기"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-warning, #FF9500)', padding: '0 8px', minHeight: 24 }}
          >✕</button>
        </div>
      )}

      {/* Hero Visual Section */}
      <div style={{
        position: 'relative',
        padding: '32px 24px 24px',
        background: isGain
          ? 'var(--dashboard-hero-gain)'
          : 'var(--dashboard-hero-loss)',
        overflow: 'hidden'
      }}>
        {/* Decorative Circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'var(--surface, white)', opacity: 0.3, filter: 'blur(30px)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: '20%', width: 80, height: 80, borderRadius: '50%', background: isGain ? 'var(--color-loss, #3182F6)' : 'var(--color-gain, #EF4452)', opacity: 0.05, filter: 'blur(20px)' }} />

        {/* Hero Content */}
        <div className="flex items-start justify-between">
          <div style={{ flex: 1, zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: isGain ? 'var(--color-loss, #3182F6)' : 'var(--color-gain, #EF4452)', background: 'var(--surface, white)', padding: '4px 12px', borderRadius: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  {isGain ? '✨ 순항 중' : '☁️ 잠시 흐림'}
                </span>
                {streak > 0 && !significantLoss && (
                  <span aria-label={`연속 출석 ${streak}일차`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-warning, #FF9500)', background: 'var(--color-warning-bg, rgba(255,149,0,0.1))', padding: '4px 10px', borderRadius: 20 }}>
                    🔥 {streak}일째
                  </span>
                )}
              </div>
              {/* Currency Switch — 배지와 같은 행 오른쪽 */}
              <div role="group" aria-label="통화 단위 전환" style={{ display: 'flex', background: 'var(--surface, white)', borderRadius: 8, padding: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', flexShrink: 0 }}>
                <button
                  onClick={() => setCurrency('KRW')}
                  aria-label="원화로 보기"
                  aria-pressed={currency === 'KRW'}
                  style={{ padding: '6px 12px', minHeight: 32, fontSize: 11, fontWeight: currency === 'KRW' ? 700 : 400, color: currency === 'KRW' ? 'var(--text-inverse, white)' : 'var(--text-secondary, #8B95A1)', background: currency === 'KRW' ? 'var(--text-primary, #191F28)' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >₩</button>
                <button
                  onClick={() => setCurrency('USD')}
                  aria-label="달러로 보기"
                  aria-pressed={currency === 'USD'}
                  style={{ padding: '6px 12px', minHeight: 32, fontSize: 11, fontWeight: currency === 'USD' ? 700 : 400, color: currency === 'USD' ? 'var(--text-inverse, white)' : 'var(--text-secondary, #8B95A1)', background: currency === 'USD' ? 'var(--text-primary, #191F28)' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >$</button>
              </div>
            </div>
            <h1 style={{ fontSize: 'clamp(16px, 4.5vw, 22px)', fontWeight: 800, color: 'var(--text-primary, #191F28)', lineHeight: 1.4, margin: 0, wordBreak: 'keep-all' }}>
              {greetData.text}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', marginTop: 8, wordBreak: 'keep-all' }}>
              주비도 함께 지켜보고 있어요 🐘
            </p>

            {/* 미장 개장/마감 카운트다운 pill */}
            <div
              aria-label={marketCountdown.text}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                marginTop: 10,
                padding: '5px 12px', borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: marketCountdown.accent === 'live'
                  ? 'var(--color-success-bg, rgba(0,198,190,0.10))'
                  : marketCountdown.accent === 'soon'
                    ? 'var(--color-warning-bg, rgba(255,149,0,0.08))'
                    : 'var(--surface, rgba(255,255,255,0.6))',
                color: marketCountdown.accent === 'live'
                  ? 'var(--color-success, #00C6BE)'
                  : marketCountdown.accent === 'soon'
                    ? 'var(--color-warning, #FF9500)'
                    : 'var(--text-secondary, #4E5968)',
                border: marketCountdown.accent === 'live'
                  ? '1px solid rgba(0,198,190,0.25)'
                  : marketCountdown.accent === 'soon'
                    ? '1px solid rgba(255,149,0,0.2)'
                    : '1px solid var(--border-light, #F2F4F6)',
              }}
            >
              <span>{marketCountdown.emoji}</span>
              <span>{marketCountdown.text}</span>
              {marketCountdown.accent === 'live' && (
                <span
                  style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--color-success, #00C6BE)',
                    animation: 'pulse-dot 1.5s ease-in-out infinite',
                    marginLeft: 2,
                  }}
                />
              )}
            </div>
            <style>{`
              @keyframes pulse-dot {
                0%, 100% { opacity: 1; transform: scale(1); }
                50%      { opacity: 0.4; transform: scale(1.3); }
              }
            `}</style>
          </div>
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
                <span className="tabular-nums" style={{ fontSize: 'clamp(28px, 6vw, 36px)', fontWeight: 800, color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)', letterSpacing: '-0.02em' }}>
                  {currency === 'KRW'
                    ? `${isGain ? '+' : '-'}${formatKRW(Math.abs(data.totalPLWon), { suffix: '원', prefix: false })}`
                    : `${isGain ? '+' : '-'}$${Math.abs(data.totalPL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  }
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)' }}>
                  ({isGain ? '+' : '-'}{Math.abs(data.totalPLPct).toFixed(2)}%)
                </span>
              </div>
              )}
              {data.quotesLoaded && periodCompare && (
                <div
                  className="flex items-center mt-4 scrollbar-hide"
                  style={{ gap: 6, overflowX: 'auto', paddingBottom: 2 }}
                  aria-label="기간별 수익 비교"
                >
                  {([
                    { key: 'today', label: '오늘', data: periodCompare.today },
                    { key: 'week',  label: '이번주', data: periodCompare.week },
                    { key: 'month', label: '이번달', data: periodCompare.month },
                  ] as const).map(({ key, label, data: d }) => {
                    if (!d) {
                      return (
                        <span key={key} style={{
                          fontSize: 11, fontWeight: 500, padding: '4px 9px', borderRadius: 8,
                          color: 'var(--text-tertiary, #B0B8C1)',
                          background: 'var(--bg-subtle, #F2F4F6)',
                          whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                          {label} —
                        </span>
                      );
                    }
                    const isUp = d.pct >= 0;
                    // week/month는 delta (USD) 계산값, today는 deltaKrw 포함
                    const dollarDelta = 'deltaKrw' in d ? d.delta : d.delta;
                    const krwDelta = 'deltaKrw' in d ? d.deltaKrw : d.delta * data.usdKrw;
                    return (
                      <span key={key} style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                        color: isUp ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
                        background: isUp ? 'var(--color-gain-bg, rgba(239,68,82,0.06))' : 'var(--color-loss-bg, rgba(49,130,246,0.06))',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        <span style={{ fontWeight: 500, opacity: 0.8, marginRight: 4 }}>{label}</span>
                        {isUp ? '▲' : '▼'}{' '}
                        {currency === 'KRW'
                          ? formatKRW(Math.round(Math.abs(krwDelta)))
                          : `$${Math.abs(dollarDelta).toFixed(dollarDelta < 100 ? 2 : 0)}`}
                        <span style={{ marginLeft: 4, opacity: 0.85 }}>({isUp ? '+' : ''}{d.pct.toFixed(2)}%)</span>
                      </span>
                    );
                  })}
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
            <strong style={{ color: avgMarket >= 0 ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)' }}>{marketLabel}</strong>
            <span style={{ width: 1, height: 10, background: 'var(--border-strong, #E5E8EB)', margin: '0 4px' }} />
            <span>상승 1위: <span onClick={() => setAnalysisSymbol(data.bestSymbol)} style={{ color: 'var(--color-gain, #EF4452)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{bestKr}</span></span>
            <span>하락 1위: <span onClick={() => setAnalysisSymbol(data.worstSymbol)} style={{ color: 'var(--color-loss, #3182F6)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{worstKr}</span></span>
          </div>
        )}

        {/* 건강점수 미니 — 투자 중 종목 있을 때만 */}
        {health && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('solb-goto-analysis'))}
            aria-label={`포트폴리오 건강점수 ${health.total}점 (${getHealthLabel(health.total)}) · 분석 탭으로 이동`}
            className="cursor-pointer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'var(--bg-subtle, #F8F9FA)',
              border: 'none',
              textAlign: 'left',
              transition: 'background 0.15s',
              minHeight: 44,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover, #F2F4F6)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle, #F8F9FA)')}
          >
            {/* 점수 숫자 */}
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 2,
              color: getHealthColor(health.total),
              fontWeight: 800,
            }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{health.total}</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>/100</span>
            </div>

            {/* 라벨 뱃지 */}
            <span style={{
              fontSize: 11, fontWeight: 700,
              padding: '3px 8px', borderRadius: 20,
              color: getHealthColor(health.total),
              background: health.total >= 80 ? 'var(--color-success-bg)'
                : health.total >= 60 ? 'var(--color-info-bg)'
                : health.total >= 40 ? 'var(--color-warning-bg)'
                : 'var(--color-danger-bg)',
            }}>
              {getHealthLabel(health.total)}
            </span>

            {/* 약점 1개 요약 */}
            <span style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(() => {
                // 가장 낮은 점수 메트릭 1개 선택
                const metrics = [
                  { key: '집중도', ratio: health.concentration.score / 30 },
                  { key: '섹터 분산', ratio: health.diversification.score / 25 },
                  { key: '목표 설정', ratio: health.goalSetting.score / 25 },
                  { key: '손익 밸런스', ratio: health.profitBalance.score / 20 },
                ].sort((a, b) => a.ratio - b.ratio);
                const weakest = metrics[0];
                if (weakest.ratio < 0.5) return `${weakest.key} 보완 필요`;
                if (health.total >= 80) return '전체 균형이 좋아요';
                return '자세히 보기';
              })()}
            </span>

            {/* 화살표 */}
            <span style={{ fontSize: 14, color: 'var(--text-tertiary, #B0B8C1)', flexShrink: 0 }}>›</span>
          </button>
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
        <div style={{ marginTop: 8, padding: '12px', borderRadius: 12, background: 'var(--color-info-bg, rgba(49,130,246,0.04))', border: '1px solid rgba(49,130,246,0.08)', animation: 'slideDown 0.3s ease' }}>
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
