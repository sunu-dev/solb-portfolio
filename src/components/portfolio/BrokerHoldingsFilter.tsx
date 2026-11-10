'use client';

import { BROKER_LABELS, BROKER_ORDER, type StockItem, type Broker } from '@/config/constants';
import styles from './BrokerHoldingsFilter.module.css';

export function brokerHoldingChoices(items: StockItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.broker || 'unspecified';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => {
    if (a === 'unspecified') return 1;
    if (b === 'unspecified') return -1;
    return BROKER_ORDER.indexOf(a as Broker) - BROKER_ORDER.indexOf(b as Broker);
  }).map(([id, count]) => ({ id, count, label: id === 'unspecified' ? '증권사 미지정' : BROKER_LABELS[id as Broker] || id }));
}

export default function BrokerHoldingsFilter({ items, active, onSelect }: {
  items: StockItem[]; active: string | null; onSelect: (broker: string | null) => void;
}) {
  if (!items.length) return null;
  const choices = [{ id: null, label: '전체', count: items.length }, ...brokerHoldingChoices(items)];
  return <fieldset className={styles.filter}>
    <legend>증권사별로 보기</legend>
    <div className={styles.options}>
      {choices.map(choice => <button key={choice.id ?? 'all'} type="button" className={styles.option}
        aria-pressed={active === choice.id} onClick={() => onSelect(choice.id)}>
        <span>{choice.label}</span><span className={styles.count}>{choice.count}</span>
      </button>)}
    </div>
    {active !== null && <p className={styles.scope}>이 목록만 선택한 증권사로 바뀌어요. 위쪽 자산 요약은 전체 증권사 기준이에요.</p>}
    <p className="sr-only" role="status">{choices.find(choice => choice.id === active)?.label ?? '전체'} · {choices.find(choice => choice.id === active)?.count ?? items.length}개 등록 종목</p>
  </fieldset>;
}
