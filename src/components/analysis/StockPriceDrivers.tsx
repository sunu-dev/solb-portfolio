import readingUI from '../ui/ReadingUI.module.css';
import styles from './StockPriceDrivers.module.css';

/** Optional reading guide. No invented company results, forecasts or price moves. */
export default function StockPriceDrivers() {
  return <details className={styles.section} data-company-reading-guide>
    <summary className={readingUI.disclosure}>실적 자료는 어떻게 읽나요?</summary>
    <p className={styles.help}>아래는 자료를 비교하는 기준이에요. 이 종목의 실적 평가나 등락 이유를 뜻하지 않아요.</p>
    <dl className={styles.criteria}>
      <div><dt>이전 실적과 비교하기</dt><dd>같은 기간의 매출과 이익을 비교해요. 매출은 판매한 금액, 이익은 비용을 빼고 남은 금액이에요.</dd></div>
      <div><dt>발표 전 예상과 비교하기</dt><dd>시장의 예상은 실적 발표 전에 애널리스트들이 추정한 값이에요. 회사가 발표한 전망과는 달라요. 예상치를 만든 곳과 기준일, 실제 결과의 기간·회계 기준이 맞아야 비교할 수 있어요.</dd></div>
      <div><dt>주가가 움직인 배경 확인하기</dt><dd>예상과 실제 실적의 차이만으로 주가가 움직인 이유를 확정할 수는 없어요. 회사의 다음 전망, 공식 발표와 발표 전후 시세도 함께 확인해요.</dd></div>
    </dl>
    <a className={styles.source} href="https://www.investor.gov/introduction-investing/investing-basics/glossary/earnings-share" target="_blank" rel="noopener noreferrer">SEC Investor.gov · 주당이익의 뜻<span className="sr-only"> (새 창)</span></a>
  </details>;
}
