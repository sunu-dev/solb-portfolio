import { CheckCircle2, Clock3, Minus } from 'lucide-react';
import { STOCK_KR, type EventCacheEntry, type PresetEvent } from '@/config/constants';
import { formatNativeAmount } from '@/utils/koreanNumber';
import { getStockCurrency, type StockCurrency } from '@/utils/stockCurrency';
import { changeColor, roundedChange, signedChange } from '@/utils/stockTrendPresentation';
import styles from './EventStockImpactCard.module.css';

interface Props {
  symbol: string;
  name?: string;
  currency?: StockCurrency;
  entry: EventCacheEntry;
  event: PresetEvent;
  avgCost?: number;
}

/** Keep the comparison's native currency and historical window explicit. */
export default function EventStockImpactCard({ symbol, name, currency, entry, event, avgCost }: Props) {
  const companyName = STOCK_KR[symbol] || name || symbol;
  const nativeCurrency = getStockCurrency(symbol, currency);
  const price = (value: number) => formatNativeAmount(value, nativeCurrency);
  const ongoing = !event.endDate;
  const hasHistory = entry.dataSource === 'fetched';
  // Both ends belong to the fetched daily history. Never pair a live quote with an older date.
  const endPrice = hasHistory && entry.lastDate && typeof entry.lastPrice === 'number'
    && Number.isFinite(entry.lastPrice) && entry.lastPrice > 0 ? entry.lastPrice : null;
  const currentChange = endPrice !== null && entry.basePrice > 0 ? (endPrice / entry.basePrice - 1) * 100 : null;
  const low = hasHistory ? entry.maxDropPrice ?? (entry.basePrice > 0 ? entry.basePrice * (1 + entry.maxDrop / 100) : null) : null;
  const personalChange = ongoing && avgCost && avgCost > 0 && endPrice !== null ? (endPrice / avgCost - 1) * 100 : null;
  const drop = roundedChange(entry.maxDrop, 1);

  return <article className={styles.card} aria-label={`${companyName} 과거 가격 비교`}>
    <header className={styles.header}>
      <span className={styles.avatar} aria-hidden="true">{companyName.charAt(0)}</span>
      <div><h3>{companyName}</h3><span>{symbol}</span></div>
    </header>
    {hasHistory && <div className={styles.range}>
      <span>기준 종가 대비 최대 하락</span><strong style={{ color: changeColor(drop) }}>{signedChange(drop)}%</strong>
      {low !== null && <p>확인된 최저 종가 {price(low)}{entry.maxDropDate ? ` · ${entry.maxDropDate}` : ''}</p>}
    </div>}
    <dl className={styles.prices}>
      <div><dt>이벤트 기준가</dt><dd>{price(entry.basePrice)}</dd><small>비교 기준일 {entry.baseDate || event.baseDate}</small></div>
      <div><dt>{ongoing ? '마지막 확인 종가' : '비교 종료 시점가'}</dt>
        <dd>{endPrice !== null ? price(endPrice) : '미확인'}</dd>
        {currentChange !== null && <small style={{ color: changeColor(currentChange) }}>{signedChange(currentChange)}% · 기준가 대비</small>}
      </div>
    </dl>
    <p className={styles.timestamp}>{entry.lastDate ? `${entry.lastDate} 마지막 확인 종가` : '마지막 종가 날짜 미확인'}{event.endDate ? ` · 비교 종료일 ${event.endDate}` : ' · 장중 시세와 다를 수 있어요.'}</p>
    {hasHistory ? <p className={styles.recovery}>
      {entry.recovered ? <CheckCircle2 size={15} aria-hidden="true" /> : ongoing ? <Clock3 size={15} aria-hidden="true" /> : <Minus size={15} aria-hidden="true" />}
      {drop === 0 ? '조회한 종가에서 기준가보다 낮은 가격은 없었어요.' : entry.recovered ? `기준가 회복 확인${entry.recoveryDate ? ` · ${entry.recoveryDate} 종가` : ''}`
        : ongoing ? '조회한 구간에서 기준가 회복 미확인' : '비교 구간 안에서 기준가 회복 미확인'}
    </p> : <p className={styles.timestamp}>구간 전체의 가격 자료가 없어 최대 하락과 회복 기간은 확인하지 못했어요.</p>}
    {personalChange !== null && <p className={styles.personal}>
      마지막 확인 종가로 본 내 평균 매수가 {price(avgCost!)} 대비 <strong style={{ color: changeColor(personalChange) }}>{signedChange(personalChange)}%</strong>
    </p>}
    <p className={styles.note}>Yahoo Finance의 분할 조정 종가로 비교했어요. 배당을 더한 총수익률은 아니에요. 이 사건만으로 가격이 움직였다는 뜻은 아니에요.</p>
  </article>;
}
