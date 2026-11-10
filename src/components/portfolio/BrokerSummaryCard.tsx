'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePortfolioStore } from '@/store/portfolioStore';
import { BROKER_LABELS, BROKER_ORDER, BROKER_DISCOVERY_THRESHOLD, type Broker } from '@/config/constants';
import { holdingTotals, isRegisteredHolding } from '@/utils/mergedHoldings';
import { formatKrw } from '@/utils/koreanNumber';
import readingUI from '../ui/ReadingUI.module.css';
import styles from './HoldingsOverview.module.css';

interface Props {
  active?: Broker | 'unspecified' | null;
  onSelect?: (broker: Broker | 'unspecified' | null) => void;
}

const won = (value: number) => formatKrw(value, { prefix: false, suffix: '원', short: false });
const direction = (value: number | null) => value === null || value === 0 ? styles.neutral : value > 0 ? styles.gain : styles.loss;

function SummaryAmount({ total }: { total: ReturnType<typeof holdingTotals> }) {
  const reason = total.missingPrices ? '시세 확인 필요' : total.missingFx ? '현재 환율 확인 필요'
    : total.missingCosts ? '매수가 입력 필요' : total.missingPurchaseRates ? '매수 환율 입력 필요' : '계산 정보 확인 필요';
  return <span className={styles.amount}>
    <strong>{total.value === null ? reason : won(total.value)}</strong>
    <span className={direction(total.pnlPct)}>{total.pnlPct === null ? `손익 · ${reason}` : `손익 ${total.pnlPct > 0 ? '+' : ''}${total.pnlPct.toFixed(1)}%`}</span>
  </span>;
}

export default function BrokerSummaryCard({ active = null, onSelect }: Props = {}) {
  const { stocks, macroData } = usePortfolioStore(useShallow(state => ({ stocks: state.stocks, macroData: state.macroData })));
  const { stats, total } = useMemo(() => {
    const holdings = (stocks.investing || []).filter(isRegisteredHolding);
    const keys = [...new Set(holdings.map(stock => stock.broker || 'unspecified'))];
    const stats = keys.filter(key => key !== 'unspecified').length < BROKER_DISCOVERY_THRESHOLD ? [] : keys
      .sort((a, b) => a === 'unspecified' ? 1 : b === 'unspecified' ? -1 : BROKER_ORDER.indexOf(a as Broker) - BROKER_ORDER.indexOf(b as Broker))
      .map(broker => ({ broker: broker as Broker | 'unspecified', label: broker === 'unspecified' ? '증권사 미지정' : BROKER_LABELS[broker as Broker],
        total: holdingTotals(holdings.filter(stock => (stock.broker || 'unspecified') === broker), macroData) }));
    return { stats, total: holdingTotals(holdings, macroData) };
  }, [stocks.investing, macroData]);
  if (!stats.length) return null;

  return <section className={styles.panel} aria-label="증권사별 보유 현황">
    <h3 className={styles.title}>증권사별 보유 현황</h3>
    <p className={styles.intro}>등록한 주식만 합쳤어요. 계좌에 남은 현금은 포함하지 않아요.</p>
    <div className={styles.total}><span>전체 평가금액</span><SummaryAmount total={total} /></div>
    <div className={styles.rows}>
      {stats.map(stat => {
        const content = <><span className={styles.identity}><strong>{stat.label}</strong><span>{stat.total.count}종목{onSelect ? ' · 목록 보기' : ''}</span></span><SummaryAmount total={stat.total} /></>;
        return onSelect ? <button key={stat.broker} type="button" className={styles.brokerRow}
          aria-pressed={active === stat.broker} onClick={() => onSelect(active === stat.broker ? null : stat.broker)}>{content}</button>
          : <div key={stat.broker} className={styles.brokerRow}>{content}</div>;
      })}
    </div>
    {active !== null && onSelect && <button type="button" className={styles.textButton} onClick={() => onSelect(null)}>전체 종목 목록 보기 →</button>}
    <details className={styles.explanation}><summary className={readingUI.disclosure}>어떤 금액인가요?</summary>
      <p>입력한 수량에 확인된 주가를 곱한 금액이에요. 미국 주식은 현재 환율로 원화로 바꿔요. 손익은 지금 팔았다고 가정한 이익이나 손해예요. 입력한 매수가와 비교하고, 미국 주식을 살 때의 환율도 반영해요. 빠진 정보가 있으면 해당 합계나 손익을 표시하지 않아요.</p>
      <p>수수료와 세금은 계산에 넣지 않았어요. 직접 등록한 정보로 계산하므로 증권사에 보이는 금액과 다를 수 있어요.</p>
    </details>
  </section>;
}
