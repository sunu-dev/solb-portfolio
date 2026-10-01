'use client';

import { useState } from 'react';
import type { EconomicKind } from '@/lib/economicEvents';
import { ECON_EDUCATION, RATE_STORIES } from '@/lib/economicEducation';
import styles from './EconomicCalendar.module.css';

export function EventDefinition({ kind, compact = false }: { kind: EconomicKind; compact?: boolean }) {
  const content = ECON_EDUCATION[kind];
  return <div className={compact ? styles.definitionCompact : styles.explain}>
    {compact ? <strong>{content.term}</strong> : <h3>먼저, 이게 뭔가요? · {content.term}</h3>}
    <p>{content.definition}</p>
  </div>;
}

export function ImpactPath({ kind }: { kind: EconomicKind }) {
  const [scenario, setScenario] = useState<keyof typeof RATE_STORIES>('up');
  const content = ECON_EDUCATION[kind];
  const story = kind === 'fomc' ? RATE_STORIES[scenario] : content.story;
  return <section className={styles.learning} aria-label="내 주식까지 영향이 이어지는 과정">
    <h3>내 주식까지 어떻게 이어질까요?</h3>
    <p className={styles.muted}>이해를 돕는 예시예요. 실제로 일어난 결과와는 구분해서 봐주세요.</p>
    {kind === 'fomc' && <div className={styles.toolbar} aria-label="금리 결정별 예시 선택">
      {([['up', '금리를 올리면'], ['down', '금리를 내리면'], ['hold', '그대로 두면']] as const).map(([value, label]) =>
        <button key={value} className={styles.button} aria-pressed={scenario === value} onClick={() => setScenario(value)}>{label}</button>)}
    </div>}
    <div aria-live="polite" aria-atomic="true">
      <ol className={styles.impactSteps}>
        {story.steps.map(([title, explanation], i) => <li key={title}>
          <span className={styles.stepNumber} aria-hidden="true">{i + 1}</span>
          <div><strong>{title}</strong><p>{explanation}</p></div>
        </li>)}
      </ol>
      <div className={styles.explain}><h3>생활 속 예로 보면</h3><p>{story.example}</p></div>
      <div className={styles.explain}><h3>이 연결이 달라질 때도 있어요</h3><p>{story.exception}</p></div>
    </div>
    <a className={styles.link} href={content.source} target="_blank" rel="noreferrer">용어·원리의 공식 설명 ↗</a>
  </section>;
}
