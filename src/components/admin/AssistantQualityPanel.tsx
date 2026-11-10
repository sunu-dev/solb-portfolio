'use client';
import readingUI from '@/components/ui/ReadingUI.module.css';
import { useCallback, useEffect, useState } from 'react';
import { QUALITY_TOPICS, QUALITY_REASONS, type QualityTopic, type QualityReason } from '@/lib/assistantQuality';
import styles from './UsagePanel.module.css';
import reviewStyles from '@/components/learning/AnswerFeedback.module.css';

type Summary = { topic: QualityTopic; asset: string; model: string; version: string; requests: number; ready: number; received: number; blocked: number; failed: number; limited: number; average_ms: number; p95_ms: number; sources_ms: number; generation_ms: number; ratings: number; helpful: number; unhelpful: number };
type Case = { event_id: string; question: string; answer: string; created_at: string; expires_at: string; review_status: 'new' | 'reviewed' | 'fixed'; issue: QualityReason | null };
async function request(method: string, body?: unknown, before?: string) {
  const { supabase } = await import('@/lib/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인이 필요해요.');
  const response = await fetch(`/api/admin/assistant-quality${before ? `?before=${encodeURIComponent(before)}` : ''}`, {
    method, headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '검수 자료를 불러오지 못했어요.');
  return data;
}
export default function AssistantQualityPanel() {
  const [rows, setRows] = useState<Summary[]>([]), [cases, setCases] = useState<Case[]>([]);
  const [next, setNext] = useState<string | null>(null), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(''), [enabled, setEnabled] = useState(false);
  const load = useCallback(async (before?: string) => {
    setBusy(true); setError('');
    try { const data = await request('GET', undefined, before); setRows(data.summary); setCases(previous => before ? [...previous, ...data.cases] : data.cases); setNext(data.next); setEnabled(data.enabled); setLoaded(true); }
    catch (e) { setError(e instanceof Error ? e.message : '불러오기 실패'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const update = async (row: Case, status: Case['review_status'], issue: QualityReason | null) => {
    setBusy(true); setError('');
    try { await request('PATCH', { id: row.event_id, status, issue }); setCases(previous => previous.map(item => item.event_id === row.event_id ? { ...item, review_status: status, issue } : item)); }
    catch (e) { setError(e instanceof Error ? e.message : '검수 상태 저장 실패'); }
    finally { setBusy(false); }
  };
  const total = rows.reduce((sum, row) => sum + row.requests, 0);
  const ready = rows.reduce((sum, row) => sum + row.ready, 0), received = rows.reduce((sum, row) => sum + row.received, 0);
  const ratings = rows.reduce((sum, row) => sum + row.ratings, 0), helpful = rows.reduce((sum, row) => sum + row.helpful, 0);
  return <section className={styles.panel}>
    <header className={styles.toolbar}><div><h2>주비 답변 개선</h2><p>최근 30일 · 인증과 질문 형식 검사를 통과한 요청부터 집계해요. 시작 전 로그인·접속 실패는 포함하지 않아요.</p></div><button type="button" disabled={busy} onClick={() => void load()}>{busy ? '확인 중…' : '새로고침'}</button></header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {loaded && !enabled && <p>새 요청 집계가 꺼져 있어요. 저장된 자료만 표시해요.</p>}
    <dl className={styles.funnel}><div><dt>집계된 질문</dt><dd>{total}건</dd></div><div><dt>답변 준비 / 브라우저 수신 확인</dt><dd>{ready}건 / {received}건</dd></div><div><dt>도움됐어요 / 전체 평가</dt><dd>{helpful}건 / {ratings}건</dd></div></dl>
    <p className={styles.note}>시간은 서버 처리 기준이며 네트워크·화면 표시 시간은 제외해요. 수신 미확인은 답변을 못 받았다는 확정이 아니에요. 창 닫기나 집계 통신 실패도 포함될 수 있어요. 평가는 참여한 사용자 기준이며 전체 만족도로 해석하지 않아요.</p>
    <div className={styles.block}><h3>어떤 질문부터 고칠까요?</h3>
      <div className={styles.tableWrap}><table><caption className="sr-only">질문 유형과 모델별 응답 품질</caption><thead><tr>{['질문 유형','상품 / 모델','요청','준비 / 수신','검수 차단 / 실패 / 제한','서버 처리 평균 / 95%','자료 / 생성 시간','도움 / 아쉬움'].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={`${row.topic}:${row.asset}:${row.model}:${row.version}`}><th scope="row">{QUALITY_TOPICS[row.topic]}<small> ({row.version})</small></th><td>{({market:'시장',stock:'주식',fund:'ETF 등',leveraged:'배수 상품'} as Record<string,string>)[row.asset]} / {row.model}</td><td>{row.requests}</td><td>{row.ready} / {row.received}</td><td>{row.blocked} / {row.failed} / {row.limited}</td><td>{(row.average_ms / 1000).toFixed(1)}초 / {(row.p95_ms / 1000).toFixed(1)}초</td><td>{(row.sources_ms / 1000).toFixed(1)}초 / {(row.generation_ms / 1000).toFixed(1)}초</td><td>{row.helpful} / {row.unhelpful}</td></tr>)}</tbody></table></div>
      {loaded && !rows.length && <p>아직 집계된 질문이 없어요. 예시 수치를 채우지 않아요.</p>}
    </div>
    <section className={`${styles.block} ${reviewStyles.root}`}><h3>사용자가 제공한 검수 사례</h3><p>동의한 질문·답변만 표시해요. 사용자가 편집한 내용일 수 있으며 사실로 확정된 자료가 아니에요. 원인 확인 → 수정 → 같은 질문과 새 질문으로 검증한 뒤 ‘반영 확인’으로 표시하세요.</p>
      {loaded && !cases.length && <p>제공된 사례가 없어요.</p>}
      {cases.map(row => <article className={reviewStyles.case} key={row.event_id}><p>{new Date(row.created_at).toLocaleString('ko-KR')} · {new Date(row.expires_at).toLocaleDateString('ko-KR')} 검수 종료</p><h4>{row.question}</h4><details><summary className={readingUI.disclosure}>제공한 답변 보기</summary><pre>{row.answer}</pre></details><div className={styles.controls}>
        <label>문제 유형 <select value={row.issue ?? ''} disabled={busy} onChange={e => void update(row, row.review_status, (e.target.value || null) as QualityReason | null)}><option value="">아직 분류하지 않음</option>{Object.entries(QUALITY_REASONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>검수 상태 <select value={row.review_status} disabled={busy} onChange={e => void update(row, e.target.value as Case['review_status'], row.issue)}><option value="new">검수 대기</option><option value="reviewed">원인 확인</option><option value="fixed">반영 확인</option></select></label>
      </div></article>)}
      {next && <button type="button" disabled={busy} onClick={() => void load(next)}>이전 사례 더 보기</button>}
    </section>
  </section>;
}
