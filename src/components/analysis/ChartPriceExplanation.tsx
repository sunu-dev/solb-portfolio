'use client';

import { useEffect, useRef, useState } from 'react';
import { CHART_QUESTION, chartSessionFacts } from '@/lib/chartAnalysis';
import type { IntradayCandles } from '@/lib/intradayCandles';
import type { useAnalysisQuota } from '@/hooks/useAnalysisQuota';
import type { AiResultMeta as ResultMeta } from '@/lib/aiResultMeta';
import { ArrowRight, ChartNoAxesCombined } from 'lucide-react';
import { CHART_VIEW_LABEL, type ChartObservation, type ChartView } from '@/lib/chartTechnicalContext';
import FinancialText from '../common/FinancialText';
import AiResultMeta from '../common/AiResultMeta';
import ChartAnalysisLoading from './ChartAnalysisLoading';
import readingUI from '../ui/ReadingUI.module.css';
import appUI from '../ui/AppUI.module.css';
import styles from './ChartPriceExplanation.module.css';

export type ChartQuota = Pick<ReturnType<typeof useAnalysisQuota>, 'status' | 'remaining' | 'acceptResponse'>;
interface PriceReport { currentStatus: string; chartViews: ChartObservation[]; conclusion?: { desc: string }; _meta?: ResultMeta }
interface Answer { report: PriceReport; data: IntradayCandles; seenViews: readonly ChartView[] }

export default function ChartPriceExplanation({ symbol, currency, data, quota, onData, onNews, selectedViews }: {
  symbol: string; currency: 'KRW' | 'USD'; data: IntradayCandles; quota: ChartQuota;
  onData: (data: IntradayCandles, notice?: string, views?: ChartView[]) => void; onNews?: () => void;
  selectedViews?: readonly ChartView[];
}) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const latestData = useRef(data);
  useEffect(() => { latestData.current = data; }, [data]);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, [symbol, data.sessionDate]);
  const newViews = !!answer && !!selectedViews?.some(view => !answer.seenViews.includes(view));
  const stale = !!answer && (answer.data.snapshotId !== data.snapshotId || newViews);
  const blocked = quota.status === 'checking' || quota.status === 'ready' && quota.remaining === 0;

  const explain = async () => {
    if (request.current || blocked) return;
    if (quota.status === 'signed-out') { window.dispatchEvent(new CustomEvent('open-login')); return; }
    const controller = new AbortController(); request.current = controller;
    setPending(true); setError('');
    const current = () => request.current === controller && !controller.signal.aborted;
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!current()) return;
      if (!session?.access_token) { window.dispatchEvent(new CustomEvent('open-login')); return; }
      const response = await fetch('/api/ai-analysis', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ symbol, currency, price: data.c.at(-1), questionId: CHART_QUESTION.id, mentorId: CHART_QUESTION.mentor, chartSessionDate: data.sessionDate, chartViews: selectedViews }) });
      const result = await response.json();
      if (!current()) return;
      quota.acceptResponse(result, session.user.id);
      if (response.status === 401) { window.dispatchEvent(new CustomEvent('open-login')); return; }
      if (response.status === 403) { setError(result.error || 'AI 이용 동의를 먼저 확인해 주세요.'); return; }
      if (response.status === 409 && result.chart) {
        chartSessionFacts(result.chart); onData(result.chart, result.error); setAnswer(null);
      }
      if (!response.ok || !result.success) { setError(result.error || '차트 해설을 받지 못했어요. 잠시 후 다시 요청해 주세요.'); return; }
      if (!result.chart?.snapshotId || !result.report?.currentStatus || !Array.isArray(result.report.chartViews)) throw new Error('invalid_chart_answer');
      chartSessionFacts(result.chart);
      // The returned plot and explanation use exactly the same server-read price series.
      const newerAlreadyShown = result.chart.asOf < latestData.current.asOf
        || result.chart.receivedAt && latestData.current.receivedAt && result.chart.receivedAt < latestData.current.receivedAt;
      if (!newerAlreadyShown) onData(result.chart, undefined, result.report.chartViews.map((item: ChartObservation) => item.view));
      setAnswer({ report: result.report, data: result.chart, seenViews: [...new Set([...(selectedViews ?? []), ...result.report.chartViews.map((item: ChartObservation) => item.view)])] });
    } catch {
      if (request.current === controller) setError('차트 해설 응답을 확인하지 못했어요. 남은 횟수를 확인한 뒤 다시 요청해 주세요.');
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setPending(false); }
    }
  };

  if (data.t.length < 3) return null;
  if (data.c.length < 5) return <p className={styles.note}>5분 가격 자료가 5개 이상 쌓이면 차트의 모양을 비교할 수 있어요.</p>;
  const content = answer && <div className={styles.answer}>
    <p><FinancialText>{answer.report.currentStatus}</FinancialText></p>
    {answer.report.chartViews.map(item => <div className={styles.observation} key={item.view}>
      <h5>{CHART_VIEW_LABEL[item.view]}</h5>
      <p><FinancialText>{item.meaning}</FinancialText></p>
      <p className={styles.watch}><span className={styles.watchLabel}>다음에 볼 변화</span> <FinancialText>{item.watchNext}</FinancialText></p>
      <details className={styles.evidence}><summary className={readingUI.disclosure}>계산 근거 보기</summary><p><FinancialText>{item.observed}</FinancialText></p></details>
    </div>)}
    {answer.report.conclusion?.desc && <p className={styles.note}><FinancialText>{answer.report.conclusion.desc}</FinancialText></p>}
    {onNews && <button type="button" className={styles.link} onClick={onNews}>같은 종목의 소식 살펴보기</button>}
    <AiResultMeta meta={answer.report._meta} source="ai-analysis" symbol={symbol} />
  </div>;
  return <section className={styles.section} aria-label="5분 차트 가격 해설">
    {answer && !stale ? <>
      <h4 className={styles.title}>이 차트에서 읽을 점</h4>
      <p className={styles.note}>{answer.data.sessionDate} · 5분 가격 자료 기준</p>
      {content}
    </> : answer ? <>
      <p className={styles.note}>{newViews ? '차트에 다른 관점을 추가했어요. 이전 해설은 아래에서 따로 볼 수 있어요.' : '새 가격 자료를 받았어요. 이전 해설은 아래에서 따로 볼 수 있어요.'}</p>
      <details className={styles.previous}><summary className={readingUI.disclosure}>이전 자료의 해설 보기</summary>{content}</details>
    </> : null}
    {(!answer || stale) && <>
      <button type="button" className={`${appUI.primaryButton} ${styles.action}`} onClick={() => void explain()} disabled={pending || blocked} aria-busy={pending}>
        <ChartNoAxesCombined size={20} aria-hidden="true" />
        <span>{pending ? '차트 해설 요청 중…' : quota.status === 'checking' ? 'AI 이용 횟수 확인 중…' : quota.status === 'signed-out' ? '로그인하고 이 차트 쉽게 풀어보기' : '이 차트 쉽게 풀어보기'}</span>
        {!pending && <ArrowRight size={18} aria-hidden="true" />}
      </button>
      {pending ? <ChartAnalysisLoading /> : <p className={styles.note}>가격의 모양과 여러 지표를 함께 살펴보고, 이 차트에서 읽을 점을 설명해요.</p>}
      {quota.status === 'ready' && <p className={styles.note}>{quota.remaining === 0 ? '오늘 AI 설명 횟수를 모두 사용했어요.' : `AI 설명 1회 사용 · 오늘 ${quota.remaining}회 남았어요.`}</p>}
    </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
