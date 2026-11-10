'use client';

import { useMemo, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import styles from './Dashboard.module.css';
import appUI from '../ui/AppUI.module.css';
import readingUI from '../ui/ReadingUI.module.css';
import { usePortfolioStore } from '@/store/portfolioStore';
import { SlidersHorizontal } from 'lucide-react';
import { STOCK_KR } from '@/config/constants';
import { formatKrw, formatUsd, resolveUsdKrwState } from '@/utils/koreanNumber';
import type { QuoteData, MacroEntry } from '@/config/constants';
import { getDailyTerm } from '@/config/dailyTerms';
import { quoteDirection } from '@/utils/quotePresentation';
import { calcHealthScore } from '@/utils/portfolioHealth';
import { getMarketStatus, getMarketLabel } from '@/utils/marketHours';
import { getKrMarketLabel } from '@/utils/krMarketLabel';
import { INVESTOR_TYPES } from '@/config/investorTypes';
import { useActiveAlerts } from '@/hooks/useActiveAlerts';
import { useNow } from '@/hooks/useNow';
import UsMarketClockNotice from './UsMarketClockNotice';
import PortfolioTools from './PortfolioTools';
import { holdingPrice, holdingTotals, isRegisteredHolding } from '@/utils/mergedHoldings';
import {
  convertStockAmount,
  getStockCurrency,
} from '@/utils/stockCurrency';

export default function Dashboard() {
  const {
    stocks, macroData,
    setAnalysisSymbol, currency, setCurrency, networkError, setNetworkError,
    rawCandles, recordDailySnapshot,
    investorType, investorTypeSetAt, setCurrentSection,
  } = usePortfolioStore(useShallow(state => ({
    stocks: state.stocks, macroData: state.macroData,
    setAnalysisSymbol: state.setAnalysisSymbol, currency: state.currency,
    setCurrency: state.setCurrency, networkError: state.networkError,
    setNetworkError: state.setNetworkError, rawCandles: state.rawCandles,
    recordDailySnapshot: state.recordDailySnapshot,
    investorType: state.investorType, investorTypeSetAt: state.investorTypeSetAt, setCurrentSection: state.setCurrentSection,
  })));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const typeMeta = INVESTOR_TYPES[investorType];
  const currentTime = useNow();

  // 최근 알림 미리보기용 — top severity 1~2 (정책 §8)
  const topAlerts = useActiveAlerts({ maxSeverity: 2 });

  // Keep incomplete holdings out of the permanent daily total as well as the visible total.
  useEffect(() => {
    const totals = holdingTotals(stocks.investing || [], macroData);
    if (totals.value !== null && totals.cost !== null) {
      recordDailySnapshot();
    }
  }, [stocks.investing, macroData, recordDailySnapshot]);

  // 공유 시계로 두 시장을 같은 시점에 갱신. SSR에서는 시각을 추측하지 않는다.
  const marketCountdowns = currentTime ? [
    getKrMarketLabel(new Date(currentTime)),
    getMarketLabel(getMarketStatus(new Date(currentTime))),
  ] : [];

  const data = useMemo(() => {
    const registered = (stocks.investing || []).filter(isRegisteredHolding);
    const isSample = registered.length === 0 && (stocks.investing || []).some(stock => stock.demo && stock.shares > 0);
    const investing = isSample ? stocks.investing.filter(stock => stock.demo).map(stock => ({ ...stock, demo: false })).filter(isRegisteredHolding) : registered;
    const fx = resolveUsdKrwState(macroData);
    const usdKrw = fx.rate;
    let bestSymbol = '', bestDp = -Infinity;
    let worstSymbol = '', worstDp = Infinity;
    investing.forEach(stock => {
      const quote = macroData[stock.symbol] as QuoteData | undefined;
      if (!quote?.c) return;
      if (quoteDirection(quote.dp) === 'up' && quote.dp > bestDp) { bestDp = quote.dp; bestSymbol = stock.symbol; }
      if (quoteDirection(quote.dp) === 'down' && quote.dp < worstDp) { worstDp = quote.dp; worstSymbol = stock.symbol; }
    });
    const krw = holdingTotals(investing, macroData, 'KRW');
    const usd = holdingTotals(investing, macroData, 'USD');

    return {
      totalPL: usd.pnl ?? 0,
      totalPLWon: krw.pnl ?? 0,
      totalPLPctUsd: usd.pnlPct ?? 0,
      totalPLPctKrw: krw.pnlPct ?? 0,
      totalValue: usd.value ?? 0,
      totalCost: usd.cost ?? 0,
      totalValueWon: krw.value ?? 0,
      totalCostWon: krw.cost ?? 0,
      holdingCount: krw.count,
      krw, usd, usdKrw, isSample,
      bestSymbol, bestDp, worstSymbol, worstDp,
      hasInvestment: investing.length > 0,
      sp: macroData['S&P 500'] as MacroEntry | undefined,
      nasdaq: macroData['NASDAQ'] as MacroEntry | undefined,
    };
  }, [stocks, macroData]);

  const displayTotals = currency === 'KRW' ? data.krw : data.usd;
  const valueAvailable = displayTotals.value !== null;
  const pnlAvailable = displayTotals.pnl !== null;
  const missingMessage = displayTotals.missingPrices ? '시세를 확인하지 못한 종목이 있어 전체 금액과 손익을 아직 계산할 수 없어요.'
    : displayTotals.missingFx ? '현재 환율을 확인하지 못해 이 통화로 전체 금액을 합칠 수 없어요.'
    : displayTotals.missingCosts ? '매수가가 비어 있어요. 입력하면 전체 손익을 계산할 수 있어요.'
    : displayTotals.missingPurchaseRates ? '미국 주식을 살 때의 환율이 비어 있어 원화 손익을 계산할 수 없어요. 달러로 바꾸면 주가로만 본 손익을 볼 수 있어요.'
    : '계산에 필요한 정보를 확인해 주세요.';
  const displayTotalPL = currency === 'KRW' ? data.totalPLWon : data.totalPL;
  const displayTotalPLPct = currency === 'KRW' ? data.totalPLPctKrw : data.totalPLPctUsd;
  const isGain = displayTotalPL >= 0;

  const investingStocks = stocks.investing ?? [];
  const registeredStocks = [...investingStocks, ...(stocks.watching ?? [])];
  const overviewNote = registeredStocks.length === 0
    ? '종목을 추가하면 시세와 소식을 함께 볼 수 있어요.'
    : registeredStocks.every(stock => stock.demo)
      ? '샘플 종목으로 시세와 손익을 살펴보세요.'
      : investingStocks.some(isRegisteredHolding)
        ? '보유 종목의 시세와 손익을 함께 볼 수 있어요.'
        : '관심 종목의 시세와 소식을 함께 볼 수 있어요.';

  const [dailyTerm] = useState(() => getDailyTerm());

  const bestKr = STOCK_KR[data.bestSymbol] || data.bestSymbol;
  const worstKr = STOCK_KR[data.worstSymbol] || data.worstSymbol;

  // 기간별 포트폴리오 비교 (retrospective: 현재 보유 수량 × N일 전 종가)
  // 주의: 과거 매매 이력 반영 안 함 (근사치), 실제 스냅샷 저장 전까지는 참고용
  const periodCompare = useMemo(() => {
    if (!data.hasInvestment || currentTime === 0) return null;
    if (displayTotals.missingFx) return null;
    const investing = (stocks.investing || []).filter(stock => data.isSample ? stock.demo : !stock.demo);

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
      const eligible = investing.filter(s => Number.isFinite(s.shares) && s.shares > 0);
      if (eligible.length === 0) return null;

      let pastKrw = 0;
      let nowKrw = 0;
      let covered = 0;

      for (const s of eligible) {
        const pastPrice = priceAtDaysAgo(s.symbol, days);
        const nowPrice = holdingPrice(s.symbol, macroData);
        // 과거·현재 둘 다 있어야 한 종목으로 센다 — 한쪽만 있으면 비교 자체가 성립하지 않는다.
        if (pastPrice == null || !Number.isFinite(pastPrice) || pastPrice <= 0 || nowPrice === null) continue;
        const unit = currency === 'KRW' ? 'krw' : 'usd';
        pastKrw += convertStockAmount(s.symbol, pastPrice, data.usdKrw, s.currency)[unit] * s.shares;
        nowKrw += convertStockAmount(s.symbol, nowPrice, data.usdKrw, s.currency)[unit] * s.shares;
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
      return { delta: deltaKrw, pct, partial: pair.partial };
    };

    return {
      today: displayTotals.dayChange !== null && displayTotals.dayPct !== null ? { delta: displayTotals.dayChange, pct: displayTotals.dayPct, partial: false } : null,
      week: fmt(computePair(7)),
      month: fmt(computePair(31)),
    };
  }, [
    data.hasInvestment,
    data.isSample,
    displayTotals.dayChange,
    displayTotals.dayPct,
    displayTotals.missingFx,
    currency,
    data.usdKrw,
    currentTime,
    stocks.investing,
    rawCandles,
    macroData,
  ]);

  // 포트폴리오 건강 점수
  const health = useMemo(() => {
    if (!data.hasInvestment || data.krw.value === null) return null;
    const investingStocks = (stocks.investing || []).filter(stock => data.isSample ? stock.demo && stock.shares > 0 : isRegisteredHolding(stock)).map(s => {
      return {
        symbol: s.symbol,
        avgCost: s.avgCost,
        shares: s.shares,
        targetReturn: s.targetReturn,
        currentPrice: holdingPrice(s.symbol, macroData) ?? 0,
        value: convertStockAmount(
          s.symbol,
          holdingPrice(s.symbol, macroData) ?? 0,
          data.usdKrw,
          s.currency,
        ).krw * s.shares,
      };
    });
    const result = calcHealthScore(investingStocks);
    return result.available ? result : null;
  }, [data.hasInvestment, data.isSample, data.usdKrw, data.krw.value, stocks.investing, macroData]);

  return (
    <div className={`dashboard-summary ${styles.summary}${detailsOpen ? ' dashboard-details-open' : ''}`}>
      <h1 className="sr-only">내 투자 현황</h1>
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

      <div className={`dashboard-summary-header ${styles.hero}`}>
        <div className={styles.toolbar}>
          <h2 className={styles.title}>내 투자</h2>
          <PortfolioTools />
        </div>
        {!data.hasInvestment && <p className={styles.greeting}>{overviewNote}</p>}
        {data.hasInvestment && <div className={styles.valuation}>
          <div className={styles.asset}>
            <span className={styles.assetLabel}>{data.isSample ? '샘플 주식 평가금액' : '내 주식 평가금액'}</span>
            {valueAvailable ? <strong className={styles.assetValue}>{currency === 'KRW'
              ? formatKrw(Math.round(data.totalValueWon), { suffix: '원', prefix: false })
              : formatUsd(data.totalValue, 0)}</strong>
              : <p role="status" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{missingMessage}</p>}
          </div>
          <div className={`${appUI.segments} ${styles.currency}`} role="group" aria-label="통화 단위 전환">
            <button type="button" className={appUI.segment} onClick={() => setCurrency('KRW')} aria-label="원화로 보기" aria-pressed={currency === 'KRW'}>₩</button>
            <button type="button" className={appUI.segment} onClick={() => setCurrency('USD')} aria-label="달러로 보기" aria-pressed={currency === 'USD'}>$</button>
          </div>
        </div>}
      </div>

      {/* Main Stats Section — [S2] 수치 가독성 및 정돈 */}
      <div className={`dashboard-summary-body ${styles.body}`}>
        {data.hasInvestment ? (
          <div className="dashboard-stats grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(200px,auto)] gap-8">
            {/* P&L Display */}
            <div className="profit-block" style={{ paddingRight: 24, borderRight: '1px solid var(--border-light, #F2F4F6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--text-tertiary, #B0B8C1)', fontWeight: 500 }}>평가손익</span>
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
              {!pnlAvailable ? (
                <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)', margin: '8px 0' }}>{valueAvailable ? missingMessage : '전체 손익도 필요한 정보를 확인한 뒤 표시해요.'}</p>
              ) : (
              <div className="profit-total">
                <span className="tabular-nums" style={{ fontSize: 'clamp(18px, 6cqi, 30px)', fontWeight: 800, color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                  {currency === 'KRW'
                    ? `${isGain ? '+' : '-'}${formatKrw(Math.abs(data.totalPLWon), { suffix: '원', prefix: false })}`
                    : `${isGain ? '+' : '-'}${formatUsd(Math.abs(data.totalPL))}`
                  }
                </span>
                <span className="profit-percent" style={{ fontSize: 14, fontWeight: 700, color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)', whiteSpace: 'nowrap' }}>
                  <span>(</span><span>{isGain ? '+' : '-'}{Math.abs(displayTotalPLPct).toFixed(2)}%</span><span>)</span>
                </span>
              </div>
              )}
              {valueAvailable && periodCompare && (
                <div
                  className="profit-periods mt-4"
                  style={{ rowGap: 6 }}
                  aria-label="기간별 수익 비교"
                >
                  {([
                    { key: 'today', label: '오늘', data: periodCompare.today },
                    { key: 'week',  label: '최근 7일', data: periodCompare.week },
                    { key: 'month', label: '최근 31일', data: periodCompare.month },
                  ] as const).map(({ key, label, data: d }) => {
                    const isPrimary = key === 'today';
                    // 부모 subgrid가 가장 긴 수익률의 실제 너비를 전체/기간 행에 공유한다.
                    // '오늘' 강조는 배경 칩 대신 좌측 accent 바 + 굵기 (정렬을 깨지 않음).
                    const rowStyle: React.CSSProperties = {
                      display: 'grid', gridTemplateColumns: 'subgrid', alignItems: 'baseline', columnGap: 8,
                      fontSize: 14,
                      paddingLeft: 8,
                    };
                    if (!d) {
                      return (
                        <div key={key} data-period={key} style={{ ...rowStyle, borderLeft: '2px solid transparent' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary, #4E5968)' }}>{label}</span>
                          <span className="tabular-nums" style={{ textAlign: 'right', color: 'var(--text-tertiary, #B0B8C1)' }}>—</span>
                          <span />
                        </div>
                      );
                    }
                    const isUp = d.pct >= 0;
                    const delta = d.delta;
                    const accentColor = isUp ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)';
                    return (
                      <div key={key} data-period={key} style={{ ...rowStyle, borderLeft: `2px solid ${isPrimary ? accentColor : 'transparent'}` }}>
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
                            ? formatKrw(Math.round(Math.abs(delta)))
                            : `$${Math.abs(delta).toFixed(Math.abs(delta) < 100 ? 2 : 0)}`}
                        </span>
                        {/* 3열 — 퍼센트 (right, 고정폭) */}
                        <span className="profit-percent tabular-nums" style={{
                          minWidth: 0, textAlign: 'right', whiteSpace: 'nowrap',
                          color: accentColor, opacity: 0.85, fontWeight: isPrimary ? 700 : 600,
                        }}><span>(</span><span>{isUp ? '+' : ''}{d.pct.toFixed(2)}%</span><span>)</span></span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sub Stats List */}
            <div className="dashboard-asset-details flex flex-col justify-center gap-3">
              {[
                { label: '투자 원금', value: displayTotals.cost === null ? '매수가·환율 확인 필요' : currency === 'KRW' ? formatKrw(Math.round(data.totalCostWon), { suffix: '원', prefix: false }) : formatUsd(data.totalCost, 0) },
                { label: '보유 종목', value: `${data.holdingCount}개` },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between" style={{ fontSize: 13, gap: 12 }}>
                  <span style={{ color: 'var(--text-secondary, #8B95A1)', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.label}</span>
                  <strong className="tabular-nums" style={{ color: 'var(--text-primary, #191F28)', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-tertiary, #B0B8C1)', fontSize: 13 }}>
            종목을 추가하면 수익 현황이 여기에 표시돼요.
          </div>
        )}
        {data.hasInvestment && <>
          <details style={{ marginTop: 12, fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <summary className={readingUI.disclosure}>금액과 손익은 어떻게 계산하나요?</summary>
            <p>평가금액은 입력한 수량에 확인된 주가를 곱한 금액이에요. 손익은 지금 팔았다고 가정한 이익이나 손해예요. 입력한 매수가와 비교하며, 원화로 볼 때는 미국 주식의 매수 환율도 반영해요. 수수료와 세금, 계좌에 남은 현금은 포함하지 않아요.</p>
            <p>기간별 변화는 지금 가진 수량을 계속 보유했다고 가정해 비교해요. 최근 7일·31일은 해당 날짜 이전의 마지막 종가와 비교해요. 과거에 사고판 기록과 환율 변동은 반영하지 않아 실제 그 기간의 수익과 다를 수 있어요.</p>
          </details>
          {currency === 'USD' && (stocks.investing || []).some(stock => isRegisteredHolding(stock) && getStockCurrency(stock.symbol, stock.currency) === 'USD') && <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)', marginTop: 12 }}>미국 주식의 달러 손익에는 환율 변동을 반영하지 않았어요.</p>}
          <button
            className="dashboard-detail-toggle md:hidden"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen(open => !open)}
          >{detailsOpen ? '자산·기간별 수익 접기' : '자산·기간별 수익 자세히'} <span aria-hidden="true">{detailsOpen ? '⌃' : '⌄'}</span></button>
        </>}

        <div className={styles.status}>
          {marketCountdowns.map((market, index) => <span key={index} className={styles.market}>
            {market.accent === 'live' && <span className={styles.live} aria-hidden="true" />}{market.text}
          </span>)}
          {investorTypeSetAt && <button type="button" className={`${appUI.textButton} ${styles.investorType}`}
            aria-label={`내 투자 유형: ${typeMeta.nameKr} · 주비 리포트로 이동`}
            onClick={() => setCurrentSection('insights')}>내 투자 유형 · {typeMeta.nameKr} →</button>}
        </div>
        <UsMarketClockNotice now={currentTime} home />

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
        {(health || data.bestSymbol || data.worstSymbol) && (
          <div className="health-summary-frame">
          <div className="health-summary"
            role="group"
            aria-label="포트폴리오 요약"
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'nowrap',
              rowGap: 6,
              columnGap: 8,
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--bg-subtle, #F8F9FA)',
              minHeight: 44,
            }}
          >
            {health && <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>내 투자 구성</span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--text-body)', lineHeight: 1.6, wordBreak: 'keep-all' }}>{health.concentration.detail.replace(/ — .*/, '')}</span>
            </div>}

            {/* 상승/하락 1위 — 위험 메시지와 시각 분리 (좁은 카드에서는 설명을 접고 종목명을 말줄임) */}
            {(data.bestSymbol || data.worstSymbol) && (
              <div className="health-summary-movers" style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', minWidth: 0 }}>
                {health && (
                  <span aria-hidden style={{ width: 1, height: 14, background: 'var(--border-strong, #E5E8EB)' }} />
                )}
                {data.bestSymbol && <button
                  onClick={() => setAnalysisSymbol(data.bestSymbol)}
                  title={bestKr}
                  aria-label={`상승 1위 ${bestKr} 분석`}
                  style={{ background: 'none', border: 'none', padding: '2px 5px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--color-gain, #EF4452)', minHeight: 44 }}
                >
                  ↑{bestKr}
                </button>}
                {data.worstSymbol && <button
                  onClick={() => setAnalysisSymbol(data.worstSymbol)}
                  title={worstKr}
                  aria-label={`하락 1위 ${worstKr} 분석`}
                  style={{ background: 'none', border: 'none', padding: '2px 5px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--color-loss, #3182F6)', minHeight: 44 }}
                >
                  ↓{worstKr}
                </button>}
              </div>
            )}

            {/* 분석 탭 이동 화살표 */}
            {health && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('solb-goto-analysis'))}
                aria-label="내 투자 구성 자세히 보기"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', minHeight: 44, minWidth: 44, fontSize: 16, color: 'var(--text-tertiary, #B0B8C1)', flexShrink: 0 }}
              >
                ›
              </button>
            )}
          </div>
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
