'use client';
import type { OfficialPolicyFeed } from '@/lib/marketCause/officialTypes';
import readingUI from '../ui/ReadingUI.module.css';
import styles from './OfficialPolicyBriefing.module.css';
const date = (at: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(at));

export default function OfficialPolicyBriefing({ feed, market }: { feed?: OfficialPolicyFeed; market?: 'kr' | 'us' }) {
  if (!feed) return null;
  const cards = feed.cards.filter(card => !market || card.market === market);
  if (!cards.length && !feed.warnings.length) return null;
  return <div className={styles.root} data-official-policy>
    {cards.map(card => <article key={card.id} className={styles.release}>
      <p className={styles.meta}>최근 기준금리 발표 · {date(card.publishedAt)} (한국시간){card.corrected ? ' · 원문 변경 반영' : ''}</p>
      <h3>{card.title}</h3>
      <p className={styles.summary}>{card.summary}</p>
      <details className={styles.details}>
        <summary className={readingUI.disclosure}>내 투자와 어떻게 이어지나요?</summary>
        <section><h4>먼저 알아둘 뜻</h4><p>{card.meaning}</p></section>
        <section><h4>영향이 전달되는 과정</h4><ol>{card.path.map(step => <li key={step}>{step}</li>)}</ol><p>{card.condition}</p></section>
        <section><h4>다음에 함께 볼 것</h4><p>{card.watch}</p></section>
        <p className={styles.meta}>원문 확인 {date(card.checkedAt)} (한국시간). 발표 원문은 하루 한 번 확인해요.</p>
        <a href={card.sourceUrl} target="_blank" rel="noopener noreferrer">{card.authority === 'fed' ? '연준' : '한국은행'} 발표 원문 보기</a>
      </details>
    </article>)}
    {feed.warnings.map(warning => <p key={warning} className={styles.meta} role="status">{warning}</p>)}
  </div>;
}
