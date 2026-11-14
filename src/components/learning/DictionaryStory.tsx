import readingUI from '@/components/ui/ReadingUI.module.css';
import styles from './DictionaryStory.module.css';

/** Edited historical context, never generated during a dictionary lookup. */
export default function DictionaryStory({ termId }: { termId: string }) {
  if (termId !== 'stock') return null;
  return <details className={styles.story}>
    <summary className={readingUI.disclosure}>주식은 왜 생겼을까요?</summary>
    <p>멀리 항해할 배를 준비하려면 큰돈이 필요했어요. 1602년 네덜란드 동인도회사(VOC)는 아시아 무역에 쓸 자금을 여러 투자자에게서 모았어요. 투자자들이 받은 회사의 지분은 다른 사람에게 팔 수도 있었고요.</p>
    <p>회사는 사업에 필요한 돈을 모으고, 투자자는 회사의 일부를 소유하는 방식이에요. 오늘날 주식시장의 출발점을 설명할 때 자주 나오는 사례입니다.</p>
    <p className={styles.note}>지분 투자 자체가 이때 처음 생긴 것은 아니에요. 많은 사람이 참여하고 지분을 다시 거래하는 시장이 발달했다는 점에서 중요한 사례예요.</p>
    <a href="https://www.euronext.com/en/about/media/bell-ceremony-archive/gong-marks-exchange-anniversary-and-exchange-history-website" target="_blank" rel="noopener noreferrer">유로넥스트 거래소 역사<span className="sr-only"> (새 창)</span></a>
    <a href="https://www.cambridge.org/core/books/abs/financial-innovation-regulation-and-crises-in-history/contract-enforcement-on-the-worlds-first-stock-exchange/AC3C03FAAE26690185A5DB64B2EA2D2E" target="_blank" rel="noopener noreferrer">주식시장 역사 연구<span className="sr-only"> (새 창)</span></a>
  </details>;
}
