'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePortfolioStore } from '@/store/portfolioStore';
import { BROKER_LABELS, STOCK_KR } from '@/config/constants';
import { holdingPrice, mergeHoldings } from '@/utils/mergedHoldings';
import StockExplorationLink from '@/components/explore/StockExplorationLink';
import type { StockCurrency } from '@/utils/stockCurrency';
import { formatKrw, formatUsd } from '@/utils/koreanNumber';
import readingUI from '../ui/ReadingUI.module.css';
import styles from './HoldingsOverview.module.css';

const shares = (value: number) => `${value.toLocaleString('ko-KR', { maximumFractionDigits: 6 })}주`;
const money = (value: number, currency: StockCurrency) => currency === 'KRW'
  ? formatKrw(value, { prefix: false, suffix: '원', short: false }) : formatUsd(value);
const percent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

export default function MergedHoldingsCard() {
  const { stocks, macroData } = usePortfolioStore(useShallow(state => ({ stocks: state.stocks, macroData: state.macroData })));
  const merged = useMemo(() => mergeHoldings(stocks.investing || []).filter(holding => holding.lots.length > 1), [stocks.investing]);
  if (!merged.length) return null;

  return <section className={styles.panel} aria-label="같은 종목 합쳐 보기">
    <h3 className={styles.title}>같은 종목 합쳐 보기</h3>
    <p className={styles.intro}>여러 번 등록한 종목의 수량과 평균 매수가를 한곳에서 봐요.</p>
    {merged.map(holding => {
      const price = holdingPrice(holding.symbol, macroData);
      const avg = holding.mergedAvgCost;
      const pnl = price !== null && avg !== null && avg > 0 ? (price - avg) / avg * 100 : null;
      const name = holding.lots.find(lot => lot.name)?.name || STOCK_KR[holding.symbol] || holding.symbol;
      const brokers = [...holding.brokers.map(broker => BROKER_LABELS[broker]), ...(holding.hasUnspecifiedBroker ? ['증권사 미지정'] : [])];
      return <details key={holding.id} className={styles.holding}>
        {/* Composite summary: stock identity, quantity and the disclosure action have distinct roles. */}
        <summary className={styles.holdingSummary} data-ui-disclosure="composite">
          <span className={styles.identity}><strong>{name}</strong><span>{holding.symbol} · {holding.lots.length}건 등록</span></span>
          <span className={styles.quantity}><strong>{shares(holding.totalShares)}</strong><span>증권사별 내역 <span className={styles.chevron} aria-hidden="true">⌄</span></span></span>
        </summary>
        <div className={styles.holdingBody}>
          <p className={styles.brokers}>{brokers.join(' · ')}</p>
          <dl className={styles.metrics}>
            <div><dt>전체 평균 매수가</dt><dd>{avg === null ? '매수가 입력 필요' : money(avg, holding.currency)}</dd></div>
            <div><dt>평가금액{holding.currency === 'USD' ? ' · 달러' : ''}</dt><dd>{price === null ? '시세 확인 필요' : money(price * holding.totalShares, holding.currency)}</dd></div>
            <div><dt>주가로만 본 손익률</dt><dd className={pnl === null || pnl === 0 ? styles.neutral : pnl > 0 ? styles.gain : styles.loss}>{pnl === null ? price === null ? '시세 확인 필요' : '매수가 입력 필요' : percent(pnl)}</dd></div>
          </dl>
          <p className={styles.note}>현재 주가와 평균 매수가를 비교했어요. 환율 변동, 수수료, 세금은 계산에 넣지 않았어요.</p>
          <ul className={styles.lots} aria-label={`${name} 등록 내역`}>
            {holding.lots.map((lot, index) => <li key={`${lot.broker || 'none'}-${index}`}>
              <span className={styles.identity}><strong>{lot.broker ? BROKER_LABELS[lot.broker] : '증권사 미지정'}</strong><span>{shares(lot.shares)}</span></span>
              <span className={styles.lotCost}>평균 매수가<br /><strong>{Number.isFinite(lot.avgCost) && lot.avgCost > 0 ? money(lot.avgCost, holding.currency) : '입력 필요'}</strong></span>
            </li>)}
          </ul>
          <StockExplorationLink symbol={holding.symbol}>{name} 설명 읽기</StockExplorationLink>
        </div>
      </details>;
    })}
    <details className={styles.explanation}><summary className={readingUI.disclosure}>평균 매수가는 어떻게 합치나요?</summary>
      <p>예를 들어 10달러에 1주, 20달러에 3주를 샀다면 총 70달러를 쓴 거예요. 4주로 나누면 한 주에 평균 17.5달러예요.</p>
      <p>한 건이라도 매수가가 비어 있으면 전체 평균은 계산하지 않아요. 증권사에 등록된 원래 내역은 그대로 두고, 이 화면에서만 합쳐 보여줘요.</p>
    </details>
  </section>;
}
