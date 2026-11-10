'use client';

import { useId } from 'react';
import type { buildStockCheckup } from '@/utils/stockCheckup';
import readingUI from '../ui/ReadingUI.module.css';
import styles from './StockCheckup.module.css';

interface Props {
  checkup: ReturnType<typeof buildStockCheckup>;
}

export default function StockCheckup({ checkup }: Props) {
  const headingId = useId();

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <p className={styles.kicker}>투자 점검</p>
      <h3 id={headingId} className={styles.heading}>가격과 거래량</h3>
      <p className={styles.intro}>{checkup.summary}</p>

      <div className={styles.facts}>
        {checkup.items.map(item => (
          <article key={item.id} className={styles.fact}>
            <p className={styles.label}>{item.title}</p>
            <p className={item.available ? styles.value : styles.unavailable}>{item.value}</p>
            <p className={styles.meaning}>{item.meaning}</p>
            <details className={styles.nextCheck}>
              <summary className={readingUI.disclosure}>함께 확인할 점</summary>
              <p>{item.nextCheck}</p>
            </details>
          </article>
        ))}
      </div>
      <details className={styles.sources}>
        <summary className={readingUI.disclosure}>자료와 해석 기준</summary>
        <p>제공된 일별 시세로 가격과 거래량을 비교해요. 장중 거래량은 집계 중일 수 있으며, 가격 흐름만으로 기업의 실적이나 적정 가치를 판단할 수는 없어요.</p>
      </details>
    </section>
  );
}
