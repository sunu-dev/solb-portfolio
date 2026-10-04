'use client';

import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import JoobiLockup from '@/components/brand/JoobiLockup';
import type { buildStockCheckup } from '@/utils/stockCheckup';
import styles from './StockCheckup.module.css';

interface Props {
  checkup: ReturnType<typeof buildStockCheckup>;
}

export default function StockCheckup({ checkup }: Props) {
  const headingId = useId();

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.brand}><JoobiLockup variant="modal" /><span>종목 노트</span></div>
      <h3 id={headingId} className={styles.heading}>이 종목, 무엇부터 볼까요?</h3>
      <p className={styles.intro}>{checkup.summary}</p>

      <div className={styles.facts}>
        {checkup.items.map((item, index) => (
          <details key={item.id} className={styles.fact}>
            <summary className={styles.summary}>
              <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.factCopy}>
                <span className={styles.label}>{item.title}</span>
                <span className={item.available ? styles.value : styles.unavailable}>{item.value}</span>
              </span>
              <span className={styles.expand}><span>뜻 보기</span><ChevronDown size={16} aria-hidden="true" /></span>
            </summary>
            <div className={styles.explanation}>
              <p>{item.meaning}</p>
              <div className={styles.nextCheck}><strong>함께 확인할 점</strong><p>{item.nextCheck}</p></div>
            </div>
          </details>
        ))}
      </div>
      <details className={styles.sources}>
        <summary>자료와 해석 기준</summary>
        <p>가격·거래량은 제공된 일별 시세, 기업 지표는 Yahoo Finance 조회값으로 정리해요. 장중 거래량은 집계 중일 수 있어요. 기업 지표의 기준일은 제공되지 않아 최근 공시를 함께 확인해야 해요.</p>
        <a href="https://www.investor.gov/introduction-investing/investing-basics/glossary/price-earnings-pe-ratio" target="_blank" rel="noopener noreferrer">PER 뜻 · 미국 SEC 투자자 안내</a>
        <a href="https://www.finra.org/investors/investing/investment-products/stocks/evaluating-stocks" target="_blank" rel="noopener noreferrer">기업 지표를 비교하는 법 · FINRA</a>
      </details>
    </section>
  );
}
