import { CheckCircle2, Clock3, Minus } from 'lucide-react';
import { STOCK_KR, type EventCacheEntry, type PresetEvent } from '@/config/constants';
import { formatNativeAmount } from '@/utils/koreanNumber';
import { getStockCurrency, type StockCurrency } from '@/utils/stockCurrency';
import { quoteTimestamp } from '@/utils/quotePresentation';
import { changeColor, roundedChange, signedChange } from '@/utils/stockTrendPresentation';
import styles from './EventStockImpactCard.module.css';

interface Props {
  symbol: string;
  name?: string;
  currency?: StockCurrency;
  entry: EventCacheEntry;
  event: PresetEvent;
  currentPrice?: number;
  quoteTime?: number;
  avgCost?: number;
}

/** Keep the comparison's native currency and historical window explicit. */
export default function EventStockImpactCard({ symbol, name, currency, entry, event, currentPrice, quoteTime, avgCost }: Props) {
  const companyName = STOCK_KR[symbol] || name || symbol;
  const nativeCurrency = getStockCurrency(symbol, currency);
  const price = (value: number) => formatNativeAmount(value, nativeCurrency);
  const ongoing = !event.endDate;
  const hasCurrentPrice = typeof currentPrice === 'number' && Number.isFinite(currentPrice) && currentPrice > 0;
  const hasHistory = entry.dataSource === 'fetched';
  const currentChange = ongoing
    ? hasCurrentPrice && entry.basePrice > 0 ? (currentPrice - entry.basePrice) / entry.basePrice * 100 : null
    : entry.dataSource === 'fetched' && Number.isFinite(entry.currentChange) ? entry.currentChange : null;
  const endPrice = !ongoing && currentChange !== null ? entry.basePrice * (1 + currentChange / 100) : null;
  const low = hasHistory ? entry.maxDropPrice ?? (entry.basePrice > 0 ? entry.basePrice * (1 + entry.maxDrop / 100) : null) : null;
  const personalChange = ongoing && avgCost && avgCost > 0 && hasCurrentPrice ? (currentPrice - avgCost) / avgCost * 100 : null;
  const asOf = quoteTimestamp(quoteTime);
  const drop = roundedChange(entry.maxDrop, 1);

  return <article className={styles.card} aria-label={`${companyName} 과거 가격 비교`}>
    <header className={styles.header}>
      <span className={styles.avatar} aria-hidden="true">{companyName.charAt(0)}</span>
      <div><h3>{companyName}</h3><span>{symbol}</span></div>
    </header>
    {hasHistory && <div className={styles.range}>
      <span>시작가 대비 최대 하락</span><strong style={{ color: changeColor(drop) }}>{signedChange(drop)}%</strong>
      {low !== null && <p>확인된 최저 종가 {price(low)}{entry.maxDropDate ? ` · ${entry.maxDropDate}` : ''}</p>}
    </div>}
    <dl className={styles.prices}>
      <div><dt>이벤트 기준가</dt><dd>{price(entry.basePrice)}</dd><small>비교 기준일 {event.baseDate}</small></div>
      <div><dt>{ongoing ? '마지막 시세' : '비교 종료 시점가'}</dt>
        <dd>{ongoing ? hasCurrentPrice ? price(currentPrice) : '미확인' : endPrice !== null ? price(endPrice) : '미확인'}</dd>
        {currentChange !== null && <small style={{ color: changeColor(currentChange) }}>{signedChange(currentChange)}% · 기준가 대비</small>}
      </div>
    </dl>
    <p className={styles.timestamp}>{ongoing ? asOf ? `${asOf} 시세 기준 · 한국시간 · 지연 가능` : '시세 기준 시각 미확인 · 지연 가능'
      : `${event.endDate}까지의 비교 구간`}</p>
    {hasHistory ? <p className={styles.recovery}>
      {entry.recovered ? <CheckCircle2 size={15} aria-hidden="true" /> : ongoing ? <Clock3 size={15} aria-hidden="true" /> : <Minus size={15} aria-hidden="true" />}
      {drop === 0 ? '조회한 종가에서 기준가보다 낮은 가격은 없었어요.' : entry.recovered ? `기준가 회복${entry.recoveryDays != null ? `까지 ${entry.recoveryDays}${entry.dataSource === 'fetched' ? '거래일' : '일'}` : ' 확인'}`
        : ongoing ? '조회한 구간에서 기준가 회복 미확인' : '비교 구간 안에서 기준가 회복 미확인'}
    </p> : <p className={styles.timestamp}>구간 전체의 가격 자료가 없어 최대 하락과 회복 기간은 확인하지 못했어요.</p>}
    {personalChange !== null && <p className={styles.personal}>
      내 평균 매수가 {price(avgCost!)} 대비 <strong style={{ color: changeColor(personalChange) }}>{signedChange(personalChange)}%</strong>
    </p>}
    <p className={styles.note}>{entry.dataSource === 'fetched' ? '조회한 종가로 비교했어요.' : '저장된 기준 가격 자료로 비교했어요.'} 이 사건만으로 가격이 움직였다는 뜻은 아니에요.</p>
  </article>;
}
