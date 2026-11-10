'use client';
import readingUI from '@/components/ui/ReadingUI.module.css';
import { useEffect, useId, useRef, useState } from 'react';
import { ThumbsDown, ThumbsUp, Check } from 'lucide-react';
import { CASE_CONSENT_VERSION, QUALITY_REASONS, type QualityReason } from '@/lib/assistantQuality';
import styles from './AnswerFeedback.module.css';

export async function qualityRequest(method: string, body?: unknown, id?: string, before?: string) {
  const { supabase } = await import('@/lib/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인한 뒤 이용할 수 있어요.');
  const response = await fetch(`/api/assistant-quality${id ? `?id=${encodeURIComponent(id)}` : before ? `?before=${encodeURIComponent(before)}` : ''}`, {
    method, headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000), cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '저장하지 못했어요. 다시 시도해 주세요.');
  return data;
}

export default function AnswerFeedback({ receipt, question, answer }: { receipt: string; question: string; answer: string }) {
  const id = useId();
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [reason, setReason] = useState<QualityReason | null>(null);
  const [review, setReview] = useState(false);
  const [questionDraft, setQuestionDraft] = useState(question);
  const [answerDraft, setAnswerDraft] = useState(answer);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const sending = useRef(false);
  useEffect(() => {
    // Receipt acknowledgement is idempotent; it never submits question or answer text.
    void qualityRequest('POST', { action: 'received', receipt }).catch(() => {});
  }, [receipt]);
  const rate = async (value: 1 | -1, why: QualityReason | null = null) => {
    if (sending.current) return; sending.current = true; setBusy(true); setError('');
    try { await qualityRequest('POST', { action: 'rating', receipt, rating: value, reason: why }); setRating(value); setReason(why); setStatus('평가를 저장했어요. 대화 내용은 보내지 않았어요.'); }
    catch (e) { setError(e instanceof Error ? e.message : '평가를 저장하지 못했어요.'); }
    finally { sending.current = false; setBusy(false); }
  };
  const share = async () => {
    if (!consent || sending.current) return; sending.current = true; setBusy(true); setError('');
    try {
      await qualityRequest('POST', { action: 'case', receipt, question: questionDraft, answer: answerDraft, consent, consentVersion: CASE_CONSENT_VERSION });
      setReview(false); setConsent(false); setStatus('검수용으로 보냈어요. 아래 ‘내가 제공한 사례’에서 삭제할 수 있어요.');
    } catch (e) { setError(e instanceof Error ? e.message : '사례를 보내지 못했어요.'); }
    finally { sending.current = false; setBusy(false); }
  };
  return <section className={styles.root} aria-label="답변 평가">
    <div className={styles.actions}>
      <button type="button" aria-pressed={rating === 1} disabled={busy} onClick={() => void rate(1)}><ThumbsUp size={15} aria-hidden="true" />도움됐어요</button>
      <button type="button" aria-pressed={rating === -1} disabled={busy} onClick={() => void rate(-1)}><ThumbsDown size={15} aria-hidden="true" />아쉬워요</button>
    </div>
    {rating === -1 && <div className={styles.actions} aria-label="아쉬운 이유">{Object.entries(QUALITY_REASONS).map(([key, label]) => <button type="button" key={key} aria-pressed={reason === key} disabled={busy} onClick={() => void rate(-1, key as QualityReason)}>{label}</button>)}</div>}
    {rating !== null && <button type="button" aria-expanded={review} aria-controls={`${id}-review`} onClick={() => { setReview(!review); setConsent(false); }}>이 답변을 검수용으로 보내기 (선택)</button>}
    {review && <div id={`${id}-review`} className={styles.review}>
      <h4>보낼 내용을 확인해 주세요</h4>
      <p>아래 질문과 답변만 주비 운영자가 읽고 답변 개선에 사용해요. 앞선 대화·보유 내역은 함께 보내지 않아요. 이름·연락처·계좌번호·보유 금액은 지워 주세요.</p>
      <label>질문<textarea value={questionDraft} maxLength={600} onChange={e => { setQuestionDraft(e.target.value); setConsent(false); }} /></label>
      <label>답변<textarea value={answerDraft} maxLength={5000} rows={5} onChange={e => { setAnswerDraft(e.target.value); setConsent(false); }} /></label>
      <p>삭제 관리를 위해 내 계정과 연결해 30일 동안 보관해요. AI 모델 학습에 따로 보내지 않으며, 제공하지 않아도 질문할 수 있어요.</p>
      <label className={styles.consent}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />위 질문·답변을 답변 개선 목적으로 30일간 보관하고 운영자가 검수하는 데 동의해요. (선택)</label>
      <div className={styles.actions}><button type="button" className={styles.primary} disabled={!consent || busy || questionDraft.trim().length < 2 || answerDraft.trim().length < 2} onClick={() => void share()}><Check size={15} aria-hidden="true" />동의하고 사례 보내기</button><button type="button" disabled={busy} onClick={() => { setReview(false); setConsent(false); }}>취소</button></div>
    </div>}
    {status && <p role="status">{status}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}

type SharedCase = { event_id: string; question: string; answer: string; expires_at: string };
export function SharedAnswerCases() {
  const [cases, setCases] = useState<SharedCase[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = async (before?: string) => {
    setBusy(true); setError('');
    try { const data = await qualityRequest('GET', undefined, undefined, before); setCases(previous => before ? [...previous, ...data.cases] : data.cases); setNext(data.next); setLoaded(true); }
    catch (e) { setError(e instanceof Error ? e.message : '사례를 불러오지 못했어요.'); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setBusy(true); setError('');
    try { await qualityRequest('DELETE', undefined, id); setCases(rows => rows.filter(row => row.event_id !== id)); }
    catch (e) { setError(e instanceof Error ? e.message : '삭제하지 못했어요.'); }
    finally { setBusy(false); }
  };
  return <details className={styles.root} onToggle={e => { if (e.currentTarget.open) void load(); }}>
    <summary className={readingUI.disclosure}>내가 제공한 사례 · 삭제</summary>
    <p>검수용으로 따로 동의해 보낸 질문·답변이에요. 삭제하면 운영자 검수 목록에서도 사라져요. 별도로 남긴 버튼 평가는 유지돼요.</p>
    {loaded && !cases.length && <p>제공한 사례가 없어요.</p>}
    {cases.map(row => <div className={styles.case} key={row.event_id}><strong>{row.question}</strong><details><summary className={readingUI.disclosure}>제공한 답변 보기</summary><pre>{row.answer}</pre></details><p>{new Date(row.expires_at).toLocaleDateString('ko-KR')} 검수 종료</p><button type="button" disabled={busy} onClick={() => void remove(row.event_id)}>사례 삭제</button></div>)}
    {next && <button type="button" disabled={busy} onClick={() => void load(next)}>이전 사례 더 보기</button>}
    <button type="button" disabled={busy} onClick={() => void load()}>{busy ? '확인 중…' : '다시 확인'}</button>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </details>;
}
