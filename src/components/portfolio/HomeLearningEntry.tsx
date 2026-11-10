'use client';

import { useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import ContextExploration from '@/components/explore/ContextExploration';
import { explorationTopic, type ExplorationId } from '@/lib/contextExploration';
import styles from './HomeLearningEntry.module.css';

const SUBJECTS = [
  { id: 'currency', label: '환율과 내 수익', title: '주가는 그대로인데, 내 수익은 왜 달라질까요?', image: '/illustrations/home/currency-handdrawn-v2.png' },
  { id: 'rates', label: '금리와 주가', title: '금리가 바뀌면 주식은 어떻게 될까요?', image: '/illustrations/home/rates-handdrawn-v2.png' },
  { id: 'compare', label: '기업을 보는 눈', title: '비슷한 회사, 무엇을 비교하면 좋을까요?', image: '/illustrations/home/companies-handdrawn-v2.png' },
] as const;

export default function HomeLearningEntry() {
  const [selected, setSelected] = useState<ExplorationId | null>(null);
  const root = useRef<HTMLElement>(null);
  const triggers = useRef<Partial<Record<ExplorationId, HTMLButtonElement | null>>>({});

  return <section ref={root} className={styles.learning} aria-label="내 투자 이해하기">
    {selected ? <ContextExploration
      key={selected}
      context="내 투자 이해하기"
      topics={SUBJECTS.map(subject => subject.id)}
      initialReadingState={{ trail: [{ topic: selected }], expanded: true, catalogDismissed: false }}
      onReadingChange={reading => {
        if (reading.trail.length) return;
        setSelected(null);
        requestAnimationFrame(() => triggers.current[selected]?.focus({ preventScroll: true }));
      }}
    /> : <>
      <div className={styles.heading}><h2>투자하다 궁금할 때</h2><span>알아두면 다르게 보이는 이야기</span></div>
      <div className={styles.subjects}>{SUBJECTS.map(subject => <button
        key={subject.id}
        type="button"
        className={subject.id === 'currency' ? styles.featured : undefined}
        ref={button => { triggers.current[subject.id] = button; }}
        aria-label={explorationTopic(subject.id).title}
        onClick={() => {
          setSelected(subject.id);
          requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true }));
        }}
      >
        <span className={styles.artwork} aria-hidden="true">
          <Image src={subject.image} alt="" fill sizes="(max-width:700px) 120px, 360px" loading="eager" />
        </span>
        <span className={styles.label}>{subject.label}</span>
        <strong>{subject.title}</strong>
        <span className={styles.read}>이야기 읽기 <ArrowUpRight size={16} aria-hidden="true" /></span>
      </button>)}</div>
    </>}
  </section>;
}
