'use client';

import { useId, useRef, useState } from 'react';
import { explorationCompany, explorationTopic, type ExplorationId } from '@/lib/contextExploration';
import styles from './ContextExploration.module.css';

type Step = { topic: ExplorationId } | { company: string };
interface Props { topics: ExplorationId[]; context: string; compact?: boolean }

/** Local, session-only reading trail. No AI call, portfolio write, or tracking of reading content. */
export default function ContextExploration({ topics, context, compact = false }: Props) {
  const [trail, setTrail] = useState<Step[]>([]);
  const [expanded, setExpanded] = useState(!compact);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const step = trail.at(-1);
  const topic = step && 'topic' in step ? explorationTopic(step.topic) : undefined;
  const company = step && 'company' in step ? explorationCompany(step.company) : undefined;
  const choices = topic?.related ?? topics;
  const navigate = (next: Step[]) => {
    setTrail(next);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'nearest' });
    });
  };
  if (!topics.length) return null;
  return <section className={styles.explore} aria-label={`${context} 이어서 알아보기`} data-context-exploration>
    {compact && <button type="button" className={styles.toggle} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>이 소식의 배경 알아보기 <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>}
    {expanded && <div id={id}>
      <p className={styles.eyebrow}>{context} · 이어서 알아보기</p>
      {compact && <p className={styles.note}>제목과 관련된 배경 설명이에요. 기사 본문 요약이나 이번 주가 변동의 원인 분석은 아니에요.</p>}
      {step && <nav className={styles.history} aria-label="설명 탐색 경로">
        <button type="button" onClick={() => navigate(trail.slice(0, -1))}>← 이전 설명</button>
        <button type="button" onClick={() => navigate([])}>처음 질문</button>
        <span>{trail.length}번째 설명</span>
      </nav>}
      <h3 ref={heading} tabIndex={-1}>{topic?.title ?? (company ? `${company.name}는 어떤 역할을 하나요?` : '다음으로 무엇이 궁금하세요?')}</h3>
      {topic && <>
        <p className={styles.summary}>{topic.summary}</p>
        <ol className={styles.steps}>{topic.steps.map(item => <li key={item.title}><strong>{item.title}</strong><p>{item.body}</p></li>)}</ol>
        <div className={styles.watch}><strong>다음에 확인할 것</strong><p>{topic.watch}</p></div>
        <p className={styles.note}>{topic.condition}</p>
        {topic.companies.length > 0 && <div className={styles.companies}><h4>역할을 함께 살펴볼 기업</h4><p className={styles.note}>공식 사업 자료를 바탕으로 고른 예시예요. 표시 순서는 순위가 아니에요.</p>{topic.companies.map(symbol => <button type="button" key={symbol} onClick={() => navigate([...trail, { company: symbol }])}>{explorationCompany(symbol)!.name}<span aria-hidden="true"> →</span></button>)}</div>}
        <details className={styles.sources}><summary>설명의 근거 보기</summary>{topic.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗<span className="sr-only"> (새 창)</span></a>)}</details>
      </>}
      {company && step && 'company' in step && <>
        <p className={styles.summary}>{company.business}</p>
        <a className={styles.stock} href={`/?stock=${encodeURIComponent(step.company)}`} target="_blank" rel="noopener noreferrer">{company.name} 시세·뉴스·분석 열기 ↗ <small>(새 탭)</small></a>
        <p className={styles.note}>이 설명을 남겨두고 종목을 살펴볼 수 있어요. 돌아오면 이어서 읽을 수 있어요.</p>
        <a className={styles.source} href={company.source.url} target="_blank" rel="noopener noreferrer">{company.source.label} ↗<span className="sr-only"> (새 창)</span></a>
      </>}
      <div className={styles.questions} aria-label="연결된 질문">{choices.map(next => <button type="button" key={next} onClick={() => navigate([...trail, { topic: next }])}>{explorationTopic(next).title}<span aria-hidden="true"> →</span></button>)}</div>
    </div>}
  </section>;
}
