'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { AnalysisLoadingFact } from '@/utils/analysisLoadingFacts';
import styles from './StockAnswerLoading.module.css';

interface StockAnswerLoadingProps {
  onCancel: () => void;
  stockName: string;
  phase: 'preparing' | 'waiting';
  facts: readonly AnalysisLoadingFact[];
}

const EMPTY_FACTS: readonly AnalysisLoadingFact[] = [
  { id: 'price', label: '가격', value: null },
  { id: 'volume', label: '거래량', value: null },
  { id: 'earnings', label: '기업 지표', value: null },
];

const STAGES = [
  { id: 'prepare', label: '자료 준비' },
  { id: 'request', label: '답변 요청' },
  { id: 'answer', label: '답변 도착' },
] as const;

export default function StockAnswerLoading({ onCancel, stockName, phase, facts }: StockAnswerLoadingProps) {
  const [delayed, setDelayed] = useState(false);
  const displayedFacts = facts.length ? facts : EMPTY_FACTS;

  useEffect(() => {
    const timer = setTimeout(() => setDelayed(true), 20_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.loading} data-stock-answer-loading data-analysis-phase={phase}>
      <div className={styles.header}>
        <div className={styles.signature} aria-hidden="true">
          <svg viewBox="0 0 40 40" fill="none" focusable="false">
            <path className={styles.signatureGuide} d="M7 31 L15 20 L22 24 L33 10" />
            <path className={styles.signatureLine} d="M7 31 L15 20 L22 24 L33 10" pathLength="1" data-loading-motion />
            <circle className={styles.signal} cx="33" cy="10" r="3.2" data-loading-motion />
            <circle className={styles.tip} cx="33" cy="10" r="3.2" />
          </svg>
        </div>
        <div className={styles.message} role="status" aria-live="polite" aria-atomic="true">
          <div className={styles.heading}>주비가 답변을 준비해요</div>
          <p className={styles.description}>
            {delayed
              ? '답변이 평소보다 늦어지고 있어요. 기다리거나 요청을 취소할 수 있어요.'
              : phase === 'preparing'
                ? '답변에 필요한 자료를 모으고 있어요.'
                : '공개 자료로 답변을 요청하고 있어요.'}
          </p>
        </div>
      </div>

      <ol className={styles.stages} aria-label="답변 준비 상태">
        {STAGES.map(stage => {
          const done = stage.id === 'prepare' && phase === 'waiting';
          const current = phase === 'preparing' ? stage.id === 'prepare' : stage.id === 'request';
          return (
            <li key={stage.id} className={styles.stage} data-loading-stage={stage.id}
              data-stage-state={done ? 'done' : current ? 'current' : 'upcoming'}
              aria-current={current ? 'step' : undefined}>
              <span className={styles.stageMark} aria-hidden="true">
                {done ? <Check size={11} strokeWidth={2.5} /> : <span />}
              </span>
              <span>{stage.label}</span>
            </li>
          );
        })}
      </ol>

      <div className={styles.factHeading}>
        <span>{phase === 'waiting' ? '답변 요청에 담은 자료' : '답변에 사용할 자료'}</span>
        <span className={styles.stockName} title={stockName}>{stockName}</span>
      </div>
      <dl className={styles.facts}>
        {displayedFacts.map(fact => (
          <div key={`${phase}-${fact.id}`} className={styles.fact} data-analysis-fact={fact.id} data-loading-motion>
            <dt>{fact.label}</dt>
            <dd className={fact.value === null ? styles.missing : undefined}>
              {fact.value ?? (phase === 'preparing' ? '준비 중' : '자료 없음')}
            </dd>
            <span className={styles.scan} aria-hidden="true" data-loading-motion />
          </div>
        ))}
      </dl>

      <div className={styles.footer}>
        <div className={styles.draft} aria-hidden="true">
          <div className={styles.activity}>
            {[0, 1, 2, 3, 4].map(bar => <span key={bar} className={styles.activityBar} data-loading-motion />)}
          </div>
          <div className={styles.placeholders}>
            <span className={styles.placeholder} data-loading-placeholder data-loading-motion />
            <span className={styles.placeholder} data-loading-placeholder data-loading-motion />
            <span className={styles.placeholder} data-loading-placeholder data-loading-motion />
          </div>
        </div>
        <button type="button" className={styles.cancel} onClick={onCancel}>요청 취소</button>
      </div>
    </div>
  );
}
