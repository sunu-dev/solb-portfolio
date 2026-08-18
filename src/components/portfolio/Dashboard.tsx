'use client';

import { useMemo, useEffect, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { SlidersHorizontal } from 'lucide-react';
import { STOCK_KR } from '@/config/constants';
import { DEFAULT_USD_KRW, formatKrw, formatUsd, resolveUsdKrwState } from '@/utils/koreanNumber';
import type { QuoteData, MacroEntry } from '@/config/constants';
import { getGreeting } from '@/config/greetings';
import { getDailyTerm } from '@/config/dailyTerms';
import { calcHealthScore, getHealthLabel, getHealthColor } from '@/utils/portfolioHealth';
import { getMarketStatus, getMarketLabel } from '@/utils/marketHours';
import { INVESTOR_TYPES } from '@/config/investorTypes';
import { useActiveAlerts } from '@/hooks/useActiveAlerts';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { useNow } from '@/hooks/useNow';
import InvestorTypeIcon from '@/components/insights/InvestorTypeIcon';
import {
  convertStockAmount,
  isKoreanStockSymbol,
  summarizePortfolioCurrency,
} from '@/utils/stockCurrency';

export default function Dashboard() {
  const {
    stocks, macroData,
    setAnalysisSymbol, currency, setCurrency, networkError, setNetworkError,
    rawCandles, recordDailySnapshot,
    investorType, investorTypeSetAt, setCurrentSection,
  } = usePortfolioStore();
  const typeMeta = INVESTOR_TYPES[investorType];
  const hasTypeSet = !!investorTypeSetAt;
  const currentTime = useNow();
  const hasHydrated = useHasHydrated();

  // 최근 알림 미리보기용 — top severity 1~2 (정책 §8)
  const topAlerts = useActiveAlerts({ maxSeverity: 2 });

  // 일일 스냅샷 자동 기록 — 시세 로드 후 1회 (하루 1번 내부 체크)
  useEffect(() => {
    if (Object.keys(macroData).length > 3) {
      recordDailySnapshot();
    }
  }, [macroData, recordDailySnapshot]);

  // 출석 데이터
  const streak = useMemo(() => {
    if (!hasHydrated) return 0;
    try {
      const raw = localStorage.getItem('solb_streak');
      return raw ? JSON.parse(raw).count || 0 : 0;
    } catch { /* ignore */ }
    return 0;
  }, [hasHydrated]);

  // 미장 개장/마감 상태 — 1분마다 업데이트
  const [marketState, setMarketState] = useState(() => getMarketStatus());
  useEffect(() => {
    const id = setInterval(() => setMarketState(getMarketStatus()), 60_000);
    return () => clearInterval(id);
  }, []);
  const marketCountdown = getMarketLabel(marketState);

  const data = useMemo(() => {
    const investing = stocks.investing || [];
    const { rate: usdKrw, stale: usdKrwStale } = resolveUsdKrwState(macroData);
    // 환율 미확인이 실제로 문제가 되는 건 'USD 종목을 원화로 환산해 보여줄 때'뿐이다.
    // 한국 종목만 있거나 달러로 보고 있으면 환산 자체가 없으므로 경고하지 않는다.
    const hasUsdHolding = investing.some(s => s.avgCost > 0 && s.shares > 0 && !isKoreanStockSymbol(s.symbol));

    let bestSymbol = '', bestDp = -Infinity;
    let worstSymbol = '', worstDp = Infinity;
    let hasPortfolioStocks = false;

    investing.forEach(s => {
      if (s.avgCost > 0 && s.shares > 0) hasPortfolioStocks = true;
      const q = macroData[s.symbol] as QuoteData | undefined;
      if (!q?.c) return;
      const dp = q.dp || 0;
      if (dp > bestDp) { bestDp = dp; bestSymbol = s.symbol; }
      if (dp < worstDp) { worstDp = dp; worstSymbol = s.symbol; }
    });

    const summary = summarizePortfolioCurrency(
      investing.map((stock) => {
        const quote = macroData[stock.symbol] as QuoteData | undefined;
        return {
          symbol: stock.symbol,
          currency: stock.currency,
          avgCost: stock.avgCost,
          shares: stock.shares,
          currentPrice: quote?.c || 0,
          dayChange: quote?.d || 0,
          purchaseRate: stock.purchaseRate,
        };
      }),
      usdKrw,
    );

    return {
      totalPL: summary.totalPnlUsd,
      totalPLWon: summary.totalPnlKrw,
      totalPLPctUsd: summary.totalPnlPctUsd,
      totalPLPctKrw: summary.totalPnlPctKrw,
      totalValue: summary.totalValueUsd,
      totalCost: summary.totalCostUsd,
      totalValueWon: summary.totalValueKrw,
      totalCostWon: summary.totalCostKrw,
      todayChange: summary.todayChangeUsd,
      todayChangeWon: summary.todayChangeKrw,
      todayPctUsd: Math.max(-999, Math.min(999, summary.todayChangePctUsd)),
      todayPctKrw: Math.max(-999, Math.min(999, summary.todayChangePctKrw)),
      holdingCount: summary.holdingCount,
      usdKrw,
      usdKrwStale,
      hasUsdHolding,
      bestSymbol, bestDp, worstSymbol, worstDp,
      hasInvestment: hasPortfolioStocks,
      quotesLoaded: summary.holdingCount > 0,
      sp: macroData['S&P 500'] as MacroEntry | undefined,
      nasdaq: macroData['NASDAQ'] as MacroEntry | undefined,
    };
  }, [stocks, macroData]);

  const displayTotalPL = currency === 'KRW' ? data.totalPLWon : data.totalPL;
  const displayTotalPLPct = currency === 'KRW' ? data.totalPLPctKrw : data.totalPLPctUsd;
  const isGain = displayTotalPL >= 0;
  const significantLoss = displayTotalPLPct < -5;

  const greetData = useMemo(
    () => hasHydrated
      ? getGreeting(data.hasInvestment && !isGain)
      : { text: '오늘도 주비와 함께해요', emoji: '✨' },
    [data.hasInvestment, hasHydrated, isGain],
  );

  const [dailyTerm] = useState(() => getDailyTerm());

  const bestKr = STOCK_KR[data.bestSymbol] || data.bestSymbol;
  const worstKr = STOCK_KR[data.worstSymbol] || data.worstSymbol;

  // 기간별 포트폴리오 비교 (retrospective: 현재 보유 수량 × N일 전 종가)
  // 주의: 과거 매매 이력 반영 안 함 (근사치), 실제 스냅샷 저장 전까지는 참고용
  const periodCompare = useMemo(() => {
    if (!data.hasInvestment || currentTime === 0) return null;
    const investing = stocks.investing || [];

    const priceAtDaysAgo = (symbol: string, days: number): number | null => {
      const c = rawCandles[symbol];
      if (!c?.t?.length || !c?.c?.length) return null;
      const targetTs = currentTime / 1000 - days * 86400;
      for (let i = c.t.length - 1; i >= 0; i--) {
        if (c.t[i] <= targetTs) return c.c[i] || null;
      }
      return null;
    };

    /**
     * 기간 비교는 **같은 종목 집합**의 과거·현재를 짝지어 계산한다.
     *
     * 예전에는 과거 합계를 '캔들이 있는 종목'만으로 구하고, 비교 상대로는 전 종목 현재
     * 평가액(data.totalValueWon)을 썼다. 커버리지가 100%가 아니면
     * (전체 현재 − 일부 과거) / 일부 과거 가 되어 실제와 무관한 수치가 확정 숫자로 렌더됐다
     * (예: 5종목 중 3종목만 캔들 보유 → '이번주 +66.7%').
     */
    const computePair = (days: number): { pastKrw: number; nowKrw: number; partial: boolean } | null => {
      const eligible = investing.filter(s => s.avgCost > 0 && s.shares > 0);
      if (eligible.length === 0) return null;

      let pastKrw = 0;
      let nowKrw = 0;
      let covered = 0;

      for (const s of eligible) {
        const pastPrice = priceAtDaysAgo(s.symbol, days);
        const nowPrice = (macroData[s.symbol] as QuoteData | undefined)?.c;
        // 과거·현재 둘 다 있어야 한 종목으로 센다 — 한쪽만 있으면 비교 자체가 성립하지 않는다.
        if (pastPrice == null || !nowPrice) continue;
        pastKrw += convertStockAmount(s.symbol, pastPrice, data.usdKrw, s.currency).krw * s.shares;
        nowKrw += convertStockAmount(s.symbol, nowPrice, data.usdKrw, s.currency).krw * s.shares;
        covered++;
      }

      // 커버리지가 50% 미만이면 신뢰 불가
      if (covered / eligible.length < 0.5) return null;
      return { pastKrw, nowKrw, partial: covered < eligible.length };
    };

    const fmt = (pair: { pastKrw: number; nowKrw: number; partial: boolean } | null) => {
      if (pair == null || pair.pastKrw === 0) return null;
      const deltaKrw = pair.nowKrw - pair.pastKrw;
      const pct = (deltaKrw / pair.pastKrw) * 100;
      return { deltaKrw, pct, partial: pair.partial };
    };

    return {
      today: { deltaKrw: data.todayChangeWon, pct: data.todayPctKrw, partial: false },
      week: fmt(computePair(7)),
      month: fmt(computePair(31)),
    };
  }, [
    data.hasInvestment,
    data.todayChangeWon,
    data.todayPctKrw,
    data.totalValueWon,
    data.usdKrw,
    currentTime,
    stocks.investing,
    rawCandles,
    macroData,
  ]);

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
        value: convertStockAmount(
          s.symbol,
          q?.c || 0,
          data.usdKrw,
          s.currency,
        ).krw * s.shares,
      };
    });
    return calcHealthScore(investingStocks);
  }, [data.hasInvestment, data.usdKrw, stocks.investing, macroData]);

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
                {hasTypeSet && (
                  <button
                    onClick={() => setCurrentSection('insights')}
                    aria-label={`내 투자 유형: ${typeMeta.nameKr} · AI 인사이트로 이동`}
                    className="cursor-pointer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700,
                      color: typeMeta.accentColor,
                      background: 'var(--surface, rgba(255,255,255,0.85))',
                      padding: '3px 10px', borderRadius: 20,
                      border: `1px solid ${typeMeta.accentColor}33`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}
                  >
                    <InvestorTypeIcon type={typeMeta.id} size={14} color={typeMeta.accentColor} />
                    <span>{typeMeta.nameKr}</span>
                  </button>
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
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(200px,auto)] gap-8">
            {/* P&L Display */}
            <div style={{ paddingRight: 24, borderRight: '1px solid var(--border-light, #F2F4F6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--text-tertiary, #B0B8C1)', fontWeight: 500 }}>전체 수익 현황</span>
                <button
                  data-tour="customize-home-edit"
                  onClick={() => window.dispatchEvent(new CustomEvent('solb-open-home-edit'))}
                  aria-label="홈 화면 편집"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', minHeight: 28, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary, #B0B8C1)', fontSize: 11, fontWeight: 600 }}
                >
                  <SlidersHorizontal size={13} />
                  <span className="hidden md:inline">편집</span>
                </button>
              </div>
              {!data.quotesLoaded ? (
                <div>
                  <div className="skeleton-shimmer" style={{ width: 180, height: 36, borderRadius: 8, marginBottom: 8 }} />
                  <div className="skeleton-shimmer" style={{ width: 100, height: 20, borderRadius: 6 }} />
                </div>
              ) : (
              <div className="flex items-baseline gap-2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span className="tabular-nums" style={{ fontSize: 'clamp(24px, 5.5vw, 34px)', fontWeight: 800, color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                  {currency === 'KRW'
                    ? `${isGain ? '+' : '-'}${formatKrw(Math.abs(data.totalPLWon), { suffix: '원', prefix: false })}`
                    : `${isGain ? '+' : '-'}${formatUsd(Math.abs(data.totalPL))}`
                  }
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)', whiteSpace: 'nowrap' }}>
                  ({isGain ? '+' : '-'}{Math.abs(displayTotalPLPct).toFixed(2)}%)
                </span>
              </div>
              )}
              {data.quotesLoaded && periodCompare && (
                <div
                  className="flex flex-col mt-4"
                  style={{ rowGap: 6 }}
                  aria-label="기간별 수익 비교"
                >
                  {([
                    { key: 'today', label: '오늘', data: periodCompare.today },
                    { key: 'week',  label: '이번주', data: periodCompare.week },
                    { key: 'month', label: '이번달', data: periodCompare.month },
                  ] as const).map(({ key, label, data: d }) => {
                    const isPrimary = key === 'today';
                    // 정렬 일관: 모든 행 같은 grid(라벨 left / 금액 right / % 우측 고정폭) + tabular-nums.
                    // '오늘' 강조는 배경 칩 대신 좌측 accent 바 + 굵기 (정렬을 깨지 않음).
                    const rowStyle: React.CSSProperties = {
                      display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'baseline', columnGap: 10,
                      fontSize: isPrimary ? 14 : 13,
                      paddingLeft: 8,
                    };
                    if (!d) {
                      return (
                        <div key={key} style={{ ...rowStyle, borderLeft: '2px solid transparent' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary, #4E5968)' }}>{label}</span>
                          <span className="tabular-nums" style={{ textAlign: 'right', color: 'var(--text-tertiary, #B0B8C1)' }}>—</span>
                          <span style={{ minWidth: 56 }} />
                        </div>
                      );
                    }
                    const isUp = d.pct >= 0;
                    const krwDelta = d.deltaKrw;
                    const dollarDelta = data.usdKrw > 0 ? krwDelta / data.usdKrw : 0;
                    const accentColor = isUp ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)';
                    return (
                      <div key={key} style={{ ...rowStyle, borderLeft: `2px solid ${isPrimary ? accentColor : 'transparent'}` }}>
                        {/* 1열 — 라벨 (left) */}
                        <span style={{
                          fontWeight: isPrimary ? 700 : 600,
                          color: isPrimary ? 'var(--text-primary, #191F28)' : 'var(--text-secondary, #8B95A1)',
                          whiteSpace: 'nowrap',
                        }}>
                          {label}
                          {/* 과거 시세가 없는 종목이 섞여 있으면 일부만 비교했다고 밝힌다. */}
                          {d.partial && (
                            <span
                              title="과거 시세를 받지 못한 종목이 있어 일부 종목만 비교했어요"
                              style={{ marginLeft: 4, fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary, #B0B8C1)' }}
                            >일부</span>
                          )}
                        </span>
                        {/* 2열 — 금액 (right, tabular-nums) */}
                        <span className="tabular-nums" style={{
                          textAlign: 'right', whiteSpace: 'nowrap',
                          fontWeight: isPrimary ? 700 : 600, color: accentColor,
                        }}>
                          <span style={{ display: 'inline-block', width: '1em', textAlign: 'center' }}>{isUp ? '▲' : '▼'}</span>
                          {currency === 'KRW'
                            ? formatKrw(Math.round(Math.abs(krwDelta)))
                            : `$${Math.abs(dollarDelta).toFixed(dollarDelta < 100 ? 2 : 0)}`}
                        </span>
                        {/* 3열 — 퍼센트 (right, 고정폭) */}
                        <span className="tabular-nums" style={{
                          minWidth: 56, textAlign: 'right', whiteSpace: 'nowrap',
                          color: accentColor, opacity: 0.85, fontWeight: isPrimary ? 700 : 600,
                        }}>({isUp ? '+' : ''}{d.pct.toFixed(2)}%)</span>
                      </div>
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
                { label: '총 평가', value: currency === 'KRW' ? formatKrw(Math.round(data.totalValueWon), { suffix: '원', prefix: false }) : formatUsd(data.totalValue, 0) },
                { label: '총 투자', value: currency === 'KRW' ? formatKrw(Math.round(data.totalCostWon), { suffix: '원', prefix: false }) : formatUsd(data.totalCost, 0) },
                { label: '보유 종목', value: `${data.holdingCount}개` },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between" style={{ fontSize: 13, gap: 12 }}>
                  <span style={{ color: 'var(--text-secondary, #8B95A1)', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.label}</span>
                  <strong className="tabular-nums" style={{ color: 'var(--text-primary, #191F28)', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.value}</strong>
                </div>
              ))}
              {/* 환율을 못 받았는데 원화 환산을 보여주는 중이면 밝힌다.
                  숫자를 감추면 화면이 비어 더 불안하므로, 계산은 유지하고 '임시 기준'임을 알린다. */}
              {data.quotesLoaded && data.usdKrwStale && data.hasUsdHolding && currency === 'KRW' && (
                <div
                  role="note"
                  style={{
                    marginTop: 4, fontSize: 11, lineHeight: 1.5,
                    color: 'var(--text-tertiary, #B0B8C1)', wordBreak: 'keep-all',
                  }}
                >
                  환율을 아직 못 받아 임시 기준({formatKrw(DEFAULT_USD_KRW, { prefix: false, suffix: '원', short: false })})으로 환산했어요. 달러로 보면 정확해요.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-tertiary, #B0B8C1)', fontSize: 13 }}>
            종목을 추가하면 수익 현황이 여기에 표시돼요.
          </div>
        )}

        {/* 최근 알림 미리보기 — Status ≠ Alert이지만 진입점만 추가 (정책 §8) */}
        {topAlerts.length > 0 && (() => {
          const top = topAlerts[0];
          const ALERT_COLOR: Record<string, string> = {
            urgent: '#EF4452', risk: '#FF9500', opportunity: '#00C6BE',
            insight: '#3182F6', celebrate: '#AF52DE',
          };
          const ALERT_ICON: Record<string, string> = {
            urgent: '🚨', risk: '⚠️', opportunity: '💡', insight: '✨', celebrate: '🎉',
          };
          const accent = ALERT_COLOR[top.type] || '#3182F6';
          return (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-alerts'))}
              aria-label={`최근 알림: ${top.message} (전체 알림 보기)`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                marginTop: 12, padding: '10px 14px', borderRadius: 12,
                background: `${accent}0d`, border: `1px solid ${accent}24`,
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>{ALERT_ICON[top.type]}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: accent, flexShrink: 0 }}>최근 알림</span>
              <span style={{
                fontSize: 12, color: 'var(--text-primary, #191F28)',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {top.message}
              </span>
              {topAlerts.length > 1 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: accent, flexShrink: 0 }}>
                  +{topAlerts.length - 1}건 더
                </span>
              )}
              <span style={{ fontSize: 14, color: accent, flexShrink: 0 }}>›</span>
            </button>
          );
        })()}

        {/* 건강점수 + 시장 현황 통합 1줄 */}
        {(health || data.bestSymbol) && (
          <div
            role="group"
            aria-label="포트폴리오 요약"
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              rowGap: 6,
              columnGap: 8,
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--bg-subtle, #F8F9FA)',
              minHeight: 44,
            }}
          >
            {/* 건강점수 */}
            {health && (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, color: getHealthColor(health.total), fontWeight: 800, flexShrink: 0 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{health.total}</span>
                  <span style={{ fontSize: 10, opacity: 0.8 }}>/100</span>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                  color: getHealthColor(health.total),
                  background: health.total >= 80 ? 'var(--color-success-bg)' : health.total >= 60 ? 'var(--color-info-bg)' : health.total >= 40 ? 'var(--color-warning-bg)' : 'var(--color-danger-bg)',
                }}>
                  {getHealthLabel(health.total)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', flex: '1 1 140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {(() => {
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
              </>
            )}

            {/* 상승/하락 1위 — 위험 메시지와 시각 분리 (모바일에서는 wrap 시 다음 줄로 함께 이동) */}
            {data.bestSymbol && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
                {health && (
                  <span aria-hidden style={{ width: 1, height: 14, background: 'var(--border-strong, #E5E8EB)' }} />
                )}
                <button
                  onClick={() => setAnalysisSymbol(data.bestSymbol)}
                  aria-label={`상승 1위 ${bestKr} 분석`}
                  style={{ background: 'none', border: 'none', padding: '2px 5px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--color-gain, #EF4452)', minHeight: 28 }}
                >
                  ↑{bestKr}
                </button>
                <button
                  onClick={() => setAnalysisSymbol(data.worstSymbol)}
                  aria-label={`하락 1위 ${worstKr} 분석`}
                  style={{ background: 'none', border: 'none', padding: '2px 5px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--color-loss, #3182F6)', minHeight: 28 }}
                >
                  ↓{worstKr}
                </button>
              </div>
            )}

            {/* 분석 탭 이동 화살표 */}
            {health && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('solb-goto-analysis'))}
                aria-label="분석 탭으로 이동"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: 16, color: 'var(--text-tertiary, #B0B8C1)', flexShrink: 0 }}
              >
                ›
              </button>
            )}
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
