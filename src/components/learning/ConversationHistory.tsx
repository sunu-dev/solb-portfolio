'use client';
import { useEffect, useState } from 'react';
import { useConversationHistory } from './JoobiConversationProvider';
import { historyDayLabel } from '@/lib/conversationHistory';
import { answerParagraphs } from '@/lib/answerParagraphs';
import readingUI from '@/components/ui/ReadingUI.module.css';
import styles from './ConversationHistory.module.css';
export function ConversationSaveStatus() {
  const { archive, error, pending, saving } = useConversationHistory();
  if (!archive) return null;
  return <div className={styles.status} aria-live="polite">
    {saving ? '대화 저장 중…' : error ? <><span role="alert">{error}</span>{pending > 0 && <button type="button" onClick={() => void archive.retry()}>저장 다시 시도</button>}</> : pending === 0 ? '질문과 답변은 내 계정에 저장돼요' : null}
  </div>;
}
export default function ConversationHistory() {
  const { archive, rows, loading, error, cursor, pending } = useConversationHistory();
  const [confirm, setConfirm] = useState<string | 'all' | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { void archive?.load(); }, [archive]);
  const remove = async () => {
    if (!archive || !confirm || deleting) return;
    setDeleting(true);
    try { if (await archive.remove(confirm === 'all' ? undefined : confirm)) setConfirm(null); }
    finally { setDeleting(false); }
  };
  const groups = new Map<string, typeof rows>();
  rows.forEach(row => { const day = historyDayLabel(row.createdAt); groups.set(day, [...(groups.get(day) ?? []), row]); });
  return <div className={styles.history}>
    <p className={styles.note}>내 계정에 저장된 질문과 답변이에요. 답변의 시세와 설명은 당시 자료이며, 다시 읽어도 AI 이용 횟수를 쓰지 않아요.</p>
    <div className={styles.actions}><button type="button" disabled={loading || deleting || !archive} onClick={() => void archive?.load()}>새로고침</button><button type="button" disabled={loading || deleting || (!rows.length && !pending)} onClick={() => setConfirm('all')}>전체 기록 삭제</button></div>
    {error && <p role="alert">{error}</p>}
    {confirm && <div className={styles.confirm} role="group" aria-label="대화 기록 삭제 확인"><p>{confirm === 'all' ? '계정의 모든 질문과 답변을 삭제할까요?' : '이 질문과 답변을 삭제할까요?'} 삭제하면 복구할 수 없어요.</p><div className={styles.actions}><button type="button" disabled={deleting} onClick={() => setConfirm(null)}>취소</button><button type="button" disabled={deleting} onClick={() => void remove()}>{deleting ? '삭제 중…' : '삭제하기'}</button></div></div>}
    {loading && <p role="status">대화 기록을 불러오고 있어요…</p>}
    {!loading && !error && !rows.length && <p>아직 저장된 대화가 없어요. 기능 적용 후 주고받은 대화부터 모아볼 수 있어요.</p>}
    {[...groups].map(([day, items]) => <section key={day}><h4>{day}</h4>{items.map(row => <details key={row.id} className={styles.item}>
      <summary className={readingUI.disclosure}><span>{row.answer.question}</span><time dateTime={row.createdAt}>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }).format(new Date(row.createdAt))}</time></summary>
      <div className={styles.reply}><p className={styles.note}>{new Date(row.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · 한국시간의 답변</p>
      {row.answer.pricePreview && <div className={styles.prices}>{row.answer.pricePreview.prices.map(p => <p key={p.symbol}>{p.label} <strong>{p.changePercent > 0 ? '+' : ''}{p.changePercent.toFixed(2)}%</strong></p>)}<small>{row.answer.pricePreview.baselineDay} 종가 대비 · {row.answer.pricePreview.day} 자료</small></div>}
      {[row.answer.currentStatus, ...row.answer.keyAdvice, row.answer.conclusion.desc].filter(Boolean).flatMap(answerParagraphs).map((text, i) => <p key={i}>{text}</p>)}
      {!!row.answer.savedSources?.length && <details><summary className={readingUI.disclosure}>답변에 참고한 자료</summary><ul>{row.answer.savedSources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title} (새 창)</a></li>)}</ul></details>}
      <button type="button" disabled={deleting} onClick={() => setConfirm(row.id)}>이 대화 삭제</button>
      </div>
    </details>)}</section>)}
    {cursor !== null && <button type="button" disabled={loading || deleting} onClick={() => void archive?.load(true)}>이전 기록 더 보기</button>}
  </div>;
}
