'use client';

import { companyStory } from '@/lib/companyStories';
import { explorationCompany } from '@/lib/contextExploration';
import styles from './ContextExploration.module.css';

/** The summary belongs beside the company heading; this section answers follow-up curiosity. */
export default function CompanyBusinessExplanation({ symbol }: { symbol: string }) {
  const story = companyStory(symbol);
  const reviewed = explorationCompany(symbol);
  if (!story) return reviewed ? <details className={styles.sources} data-company-business={symbol}>
    <summary>사업 설명의 근거 보기</summary>
    <a href={reviewed.source.url} target="_blank" rel="noopener noreferrer">{reviewed.source.label} ↗<span className="sr-only"> (새 창)</span></a>
  </details> : null;

  return <div data-company-business={symbol}>
    <div className={styles.businessExample}><h4>이럴 때 쓰여요</h4><p>{story.example}</p><small>이해를 돕기 위한 가상 상황이에요.</small></div>
    <dl className={styles.businessFacts}>
      <div><dt>누가, 왜 쓰나요?</dt><dd>{story.customers}</dd></div>
      <div><dt>어떻게 돈을 버나요?</dt><dd>{story.revenue}</dd></div>
    </dl>
    <div className={styles.sectionHeading}><h4>{story.name}, 여기서 더 궁금하다면</h4></div>
    <div className={styles.businessQuestions}>{story.questions.map(item => <details key={item.id}>
      <summary>{item.question}</summary><p>{item.answer}</p>
    </details>)}</div>
    <details className={styles.businessWatch}><summary>내 투자에서는 무엇을 확인하면 좋을까요?</summary><p>{story.watch}</p></details>
    <details className={styles.sources}><summary>사업 설명의 근거 보기</summary>
      {story.sources.map(item => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer">{item.label} · {item.reviewedAt} 확인 ↗<span className="sr-only"> (새 창)</span></a>)}
    </details>
  </div>;
}
