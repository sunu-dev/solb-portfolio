'use client';
import { useEffect, useRef, useState } from 'react';
import { type ReviewQuestion } from '@/lib/personalDictionary';
import { hasJongseong } from '@/utils/koreanJosa';
import { usePersonalDictionary } from './PersonalLearningProvider';
import styles from './StockDictionary.module.css';
import theme from './DictionaryTheme.module.css';
export default function DictionaryReview({ questions, onClose }: { questions: ReviewQuestion[]; onClose: () => void }) {
  const { entries, save } = usePersonalDictionary();
  const [index, setIndex] = useState(0), [choice, setChoice] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const current = questions[index];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [index, choice]);
  const correctLabel = current?.options.find(option => option.id === current.answerId)?.label ?? '';
  const correctEnding = hasJongseong(correctLabel) ? '이에요' : '예요';
  if (!current) return <div className={styles.review}><h3 ref={heading} tabIndex={-1}>오늘 고른 용어를 모두 살펴봤어요</h3><p>헷갈린 용어는 사전에서 다시 읽을 수 있어요.</p><button type="button" className={theme.primary} onClick={onClose}>내 주식사전으로</button></div>;
  return <section className={styles.review} aria-label="저장한 용어 복습"><div className={styles.submitRow}><span>{index + 1} / {questions.length}</span><button type="button" className={theme.linkButton} onClick={onClose}>복습 그만하기</button></div><h3 ref={!choice ? heading : undefined} tabIndex={-1}>어떤 용어의 뜻일까요?</h3><p>{current.prompt}</p>
    <div className={styles.options}>{current.options.map(option => <button type="button" key={option.id} className={theme.button} disabled={choice !== null} onClick={async () => {
      setChoice(option.id);
      setSaving(true);
      const entry = entries.find(item => item.id === current.entryId);
      if (entry && !await save({ ...entry, reviewedAt: new Date().toISOString() })) setMessage('복습 날짜는 저장하지 못했어요.');
      setSaving(false);
    }}>{option.label}</button>)}</div>
    {choice && <div role="status"><h4 ref={heading} tabIndex={-1}>{choice === current.answerId ? '맞아요.' : `정답은 ${correctLabel}${correctEnding}.`}</h4><p>{current.explanation}</p><a href={current.source} target="_blank" rel="noopener noreferrer">뜻의 공식 출처<span className="sr-only"> (새 창)</span></a>
      <div className={styles.actions}>{(['confused', 'familiar'] as const).map(familiarity => <button key={familiarity} type="button" className={theme.button} disabled={saving} aria-pressed={entries.find(item => item.id === current.entryId)?.familiarity === familiarity} onClick={async () => {
        const entry = entries.find(item => item.id === current.entryId); if (!entry) return;
        setSaving(true);
        setMessage(await save({ ...entry, familiarity }) ? familiarity === 'familiar' ? '다음 퀴즈부터 이 단어는 나오지 않아요.' : '다음에도 복습할 단어로 표시했어요.' : '표시를 저장하지 못했어요.');
        setSaving(false);
      }}>{familiarity === 'familiar' ? '이해했어요 · 복습 제외' : '아직 헷갈려요'}</button>)}<button type="button" className={theme.primary} disabled={saving} onClick={() => { setIndex(value => value + 1); setChoice(null); setMessage(''); }}>{index + 1 === questions.length ? '복습 마치기' : '다음 용어'}</button></div></div>}
    {message && <p role="status" className={theme.muted}>{message}</p>}
  </section>;
}
