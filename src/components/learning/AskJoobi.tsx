'use client';
import { JOOBI_STAGES, type JoobiPricePreview, type JoobiStage } from '@/lib/joobiProgress';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, ChevronDown, ChevronRight, MessageCircle, SlidersHorizontal, X } from 'lucide-react';
import { JoobiRequestError, withRequestSignal, readJoobiResponse, joobiRequestErrorMessage } from '@/lib/joobiRequest';
import FinancialText from '@/components/common/FinancialText';
import { ASSISTANT_QUESTION, GENERAL_SUBJECT, QUESTION_LIMIT } from '@/lib/assistantQuestion';
import { useAnalysisQuota } from '@/hooks/useAnalysisQuota';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { isKoreanStockSymbol } from '@/utils/stockCurrency';
import { answerParagraphs } from '@/lib/answerParagraphs';
import { usePortfolioStore } from '@/store/portfolioStore';
import { ASSISTANT_INDUSTRIES, ASSISTANT_PERIOD_LABELS, ASSISTANT_PERIODS, type AssistantPeriod } from '@/lib/assistantEvidence';
import { useJoobiConversation } from './JoobiConversationProvider';
import { usePersonalDictionary } from './PersonalLearningProvider';
import JoobiAvatar from './JoobiAvatar';
import { JOOBI_STAGE_REACTIONS, joobiComposerReaction, joobiReplyReaction } from '@/lib/joobiReactions';
import AnswerFeedback, { SharedAnswerCases } from './AnswerFeedback';
import chat from './JoobiChat.module.css';
import { STOCK_KR } from '@/config/constants';
import { assistantAsksBack, assistantSmallTalk, assistantSmallTalkReply } from '@/lib/assistantSmallTalk';
import { assistantChoiceClarification, assistantShortReply } from '@/lib/assistantIntent';
import { savePendingQuestion, takePendingQuestion } from '@/lib/joobiPendingQuestion';
import readingUI from '@/components/ui/ReadingUI.module.css';

function ConversationOptions({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  useFocusTrap(true, ref, onClose);
  return <div className={chat.optionsBackdrop}>
    <section ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={chat.optionsPanel} tabIndex={-1}>
      <header><h3 id={titleId} tabIndex={-1} data-dialog-initial-focus>{title}</h3><button type="button" onClick={onClose} aria-label="설정 닫고 대화로 돌아가기"><X size={20} aria-hidden="true" /></button></header>
      <div className={chat.optionsBody}>{children}</div>
      <footer><button type="button" className={chat.send} onClick={onClose}>대화로 돌아가기</button></footer>
    </section>
  </div>;
}

function AnswerParagraphs({ text }: { text: string }) {
  return <div className={chat.answerText}>{answerParagraphs(text).map((paragraph, index) => <p key={index}><FinancialText>{paragraph}</FinancialText></p>)}</div>;
}

const monthDay = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;
const samePricePreview = (a?: JoobiPricePreview | null, b?: JoobiPricePreview | null) => !!a && !!b && a.day === b.day && a.baselineDay === b.baselineDay
  && a.prices.length === b.prices.length && a.prices.every((price, index) => price.symbol === b.prices[index].symbol && price.changePercent === b.prices[index].changePercent);
/** 설명보다 먼저 읽는 숫자. 서버가 확인한 등락률만 보여주고, 자세한 조건은 '근거와 비교'에 둔다. */
function PriceStrip({ preview }: { preview: JoobiPricePreview }) {
  return <section className={chat.priceStrip} aria-label="같은 기간의 가격 변화">
    <dl>{preview.prices.map(price => <div key={price.symbol}><dt>{price.label}</dt><dd data-direction={price.changePercent < 0 ? 'down' : price.changePercent > 0 ? 'up' : 'flat'}>{price.changePercent > 0 ? '+' : ''}{price.changePercent.toFixed(2)}%</dd></div>)}</dl>
    <p>{monthDay(preview.baselineDay)} 종가 대비 · {monthDay(preview.day)} {preview.sessionState === 'closed' ? '마감 가격' : preview.sessionState === 'intraday' ? '장중 가격' : '마지막 가격'}</p>
  </section>;
}

export default function AskJoobi({ symbol: initialSymbol, embedded = false, notice }: { symbol?: string; embedded?: boolean; notice?: ReactNode }) {
  const { owner, entries } = usePersonalDictionary();
  const stocks = usePortfolioStore(state => state.stocks);
  const available = [...new Map([...stocks.investing, ...stocks.watching].filter(stock => !stock.demo).map(stock => [stock.symbol, stock])).values()];
  const [symbol, setSymbol] = useState(initialSymbol ?? GENERAL_SUBJECT);
  const [market, setMarket] = useState<'kr' | 'us'>(initialSymbol && !isKoreanStockSymbol(initialSymbol) ? 'us' : 'kr');
  const [period, setPeriod] = useState<AssistantPeriod>('1d');
  const { question, setQuestion, answers, setAnswers, clear, copyDraftTo } = useJoobiConversation(`${symbol}:${market}:${period}`);
  const [options, setOptions] = useState<'context' | 'privacy' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<JoobiStage>('checking');
  const [pricePreview, setPricePreview] = useState<JoobiPricePreview | null>(null);
  const [candidates, setCandidates] = useState<{ symbol: string; label: string }[]>([]);
  const [confirmedSymbol, setConfirmedSymbol] = useState<string | undefined>(undefined);
  const answer = answers.at(-1);
  const lastAnswered = answers.findLast(item => !item.local);
  // 주비가 방금 되물었다면 "네", "아니요"는 맞장구가 아니라 그 물음에 대한 답이에요. 한 글자여도 보낼 수 있어요.
  const answersJoobi = owner !== 'guest' && !!answer && !answer.local && assistantAsksBack(answer.currentStatus);
  const repliesToJoobi = (text: string) => answersJoobi && assistantShortReply(text);
  const clarifiesChoice = (text: string) => !!assistantChoiceClarification(text, answer?.currentStatus);
  const tooShort = (text: string) => text.length < 2 && !repliesToJoobi(text) && !clarifiesChoice(text);
  const starters = symbol === GENERAL_SUBJECT ? ['오늘 시장에 무슨 일이 있었어요?', 'ETF는 주식과 뭐가 달라요?'] : ['최근 주가가 왜 움직였어요?', '이 종목을 쉽게 설명해 주세요'];
  const subject = symbol === GENERAL_SUBJECT ? `${market === 'kr' ? '한국' : '미국'} 시장` : STOCK_KR[symbol] || available.find(stock => stock.symbol === symbol)?.name || symbol;
  const transcript = useRef<HTMLDivElement>(null);
  const transcriptContent = useRef<HTMLDivElement>(null);
  const scrollThumb = useRef<HTMLSpanElement>(null);
  const [scrollState,setScrollState] = useState({overflow:false,more:false});
  const input = useRef<HTMLTextAreaElement>(null);
  const fillQuestion = (text: string) => { setConfirmedSymbol(undefined); setCandidates([]); setQuestion(text); input.current?.focus(); };
  const resetConversation = () => { clear(); setFailedQuestion(null); setError(''); setStopped(false); setConfirmClear(false); };
  const resetTransient = () => { setFailedQuestion(null); setConfirmedSymbol(undefined); setCandidates([]); setError(''); setStopped(false); setConfirmClear(false); };
  const changeContext = (nextSymbol: string, nextMarket = market, nextPeriod = period) => {
    if (loading) return;
    copyDraftTo(`${nextSymbol}:${nextMarket}:${nextPeriod}`);
    setSymbol(nextSymbol); setMarket(nextMarket); setPeriod(nextPeriod); resetTransient();
  };
  const chooseSymbol = (next: string) => changeContext(next, next === GENERAL_SUBJECT ? market : isKoreanStockSymbol(next) ? 'kr' : 'us');
  const request = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const latestMessage = useRef<HTMLElement>(null);
  const unfinished = useRef<string | null>(null);
  const pendingMessage = useRef<HTMLDivElement>(null);
  const quota = useAnalysisQuota(true);
  const id = useId();
  const scrollConversationTo=useCallback((element:HTMLElement|null, nearest=false)=>{
    const view=transcript.current;
    if(!element) return;
    if(!embedded || !view){element.scrollIntoView({block:nearest?'nearest':'start',behavior:'instant'});return;}
    const target=element.getBoundingClientRect(),bounds=view.getBoundingClientRect();
    if(nearest&&target.top>=bounds.top&&target.bottom<=bounds.bottom)return;
    view.scrollTo({top:view.scrollTop+target.top-bounds.top-12,behavior:'instant'});
  },[embedded]);

  useEffect(() => () => {
    request.current?.abort(); request.current = null;
    const pending = unfinished.current;
    if (pending) setQuestion(draft => draft || pending);
    unfinished.current = null;
  }, [setQuestion]);
  // 마우스·키보드 환경에서는 질문창을 열자마자 바로 적을 수 있게 한다.
  // 터치 기기에서는 화면 키보드가 대화를 가리지 않도록 자동으로 열지 않는다.
  useEffect(() => {
    if (!embedded || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;
      input.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [embedded]);
  useEffect(() => {
    if (owner === 'guest') return;
    const pending = takePendingQuestion();
    if (pending) setQuestion(draft => draft || pending.text);
  }, [owner, setQuestion]);
  useEffect(() => {
    const discard = () => {
      request.current?.abort(); request.current = null; unfinished.current = null;
      setLoading(false); setPendingQuestion(null); setFailedQuestion(null); setConsent(false); setPricePreview(null);
      setConfirmClear(false); setError(''); setStopped(false);
    };
    window.addEventListener('solb-user-storage-clearing', discard);
    return () => window.removeEventListener('solb-user-storage-clearing', discard);
  }, []);
  useEffect(() => {
    if (pendingQuestion || failedQuestion) scrollConversationTo(pendingMessage.current, true);
  }, [pendingQuestion, failedQuestion, scrollConversationTo]);
  useEffect(() => {
    const field = input.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(112, Math.max(44, field.scrollHeight))}px`;
  }, [question]);
  useEffect(() => {
    const view=transcript.current, content=transcriptContent.current;
    if(!view || !content || !embedded) return;
    let frame=0;
    const update=()=>{
      if(frame)return;
      frame=requestAnimationFrame(()=>{
        frame=0;
        const overflow=view.scrollHeight>view.clientHeight+4;
        const more=overflow&&view.scrollTop+view.clientHeight<view.scrollHeight-8;
        const thumb=Math.max(8,Math.min(100,view.clientHeight/view.scrollHeight*100));
        const progress=view.scrollHeight>view.clientHeight?view.scrollTop/(view.scrollHeight-view.clientHeight):0;
        if(scrollThumb.current){scrollThumb.current.style.height=`${thumb}%`;scrollThumb.current.style.top=`${Math.max(0,Math.min(100-thumb,progress*(100-thumb)))}%`;}
        setScrollState(previous=>previous.overflow===overflow&&previous.more===more?previous:{overflow,more});
      });
    };
    const observer=new ResizeObserver(update);observer.observe(view);observer.observe(content);
    view.addEventListener('scroll',update,{passive:true});update();
    return()=>{observer.disconnect();view.removeEventListener('scroll',update);if(frame)cancelAnimationFrame(frame);};
  },[embedded,scrollState.overflow]);
  const stopWaiting = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent this click from submitting if React replaces the stop control.
    event.preventDefault();
    request.current?.abort(); request.current = null;
    setQuestion(draft => draft || pendingQuestion || '');
    setFailedQuestion(pendingQuestion);
    unfinished.current = null;
    setPendingQuestion(null); setLoading(false); setStopped(true); setPricePreview(null);
    input.current?.focus();
  };
  const sendQuestion = async (agreed: boolean, retryQuestion?: string) => {
    const submittedQuestion = (retryQuestion ?? question).trim();
    if (request.current || !agreed || tooShort(submittedQuestion) || quota.remaining === 0) return;
    const controller = new AbortController(); request.current = controller;
    let answered = false;
    let phase: 'session' | 'answer' = 'session';
    setLoading(true); setFailedQuestion(null); setError(''); setStopped(false); setCandidates([]); setStage('checking'); setPricePreview(null);
    // 바로 위 답변에 이미 보이는 숫자는 다시 보여주지 않는다.
    const shownPrices = answers.findLast(item => item.pricePreview)?.pricePreview;
    let preview: JoobiPricePreview | undefined;
    // Make room for the reply on phones; do not refocus the composer when it arrives.
    input.current?.blur();
    unfinished.current = submittedQuestion;
    setPendingQuestion(submittedQuestion);
    // A manual retry sends the failed question, not the next draft being composed.
    if (!retryQuestion || question.trim() === submittedQuestion) setQuestion('');
    const timeout = setTimeout(() => controller.abort(), 110_000);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await withRequestSignal(supabase.auth.getSession(), controller.signal);
      if (request.current !== controller) return;
      if (!session || session.user.id !== owner) { setError('로그인한 뒤 질문할 수 있어요.'); return; }
      phase = 'answer';
      const response = await fetch('/api/ai-analysis', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ questionId: ASSISTANT_QUESTION.id, questionText: submittedQuestion, confirmedSymbol, questionConsent: true, symbol, questionPeriod: period, questionMarket: market, historySymbol: symbol,
          questionHistory: answers.filter(item => !item.local).slice(-3).map(item => ({ symbol: item.symbol, market: item.market, period: item.period, sessionReference: item.sessionReference, industryFocus: item.industryFocus, question: item.question, answer: [item.currentStatus, ...item.keyAdvice, ...(item.assistantInsights ?? []).map(insight => insight.text), item.conclusion.desc].join('\n').slice(0, 1800) })),
          unclearTerms: entries.filter(entry => entry.familiarity === 'confused' && entry.termId).slice(0, 8).map(entry => entry.termId) }) });
      const data = await readJoobiResponse(response, next => { if (request.current === controller) setStage(next); },
        next => { if (request.current !== controller || samePricePreview(next, shownPrices)) return; preview = next; setPricePreview(next); });
      if (request.current !== controller) return;
      const acceptedQuota = quota.acceptResponse(data, owner);
      if (!response.ok || !data.success) {
        // A write may have succeeded even if its acknowledgement was lost.
        // Refresh once; never automatically resend a potentially charged request.
        if (!acceptedQuota) quota.refresh(); if (Array.isArray(data.candidates)) setCandidates(data.candidates.filter((item: { symbol?: unknown; label?: unknown }) => typeof item.symbol === 'string' && typeof item.label === 'string').slice(0, 4)); setError(data.code === 'daily_user_limit' ? '' : (data.httpStatus ?? response.status) === 401 ? '로그인이 만료됐어요. 다시 로그인한 뒤 보내주세요.' : typeof data.error === 'string' ? data.error : '답변 서버가 요청을 처리하지 못했어요. 잠시 후 다시 보내주세요.'); return; }
      if (typeof data.report?.currentStatus !== 'string' || !Array.isArray(data.report.keyAdvice) || !data.report.keyAdvice.every((item: unknown) => typeof item === 'string') || typeof data.report.conclusion?.desc !== 'string') throw new JoobiRequestError('format');
      setAnswers(previous => [...previous, { ...data.report, ...(preview ? { pricePreview: preview } : {}), turnId: (previous.at(-1)?.turnId ?? -1) + 1, question: submittedQuestion, symbol: data.subject?.symbol ?? symbol, market: data.subject?.market ?? market, period: data.subject?.period ?? period,
        sessionReference: data.subject?.sessionReference === 'previous' || data.subject?.sessionReference === 'latest' ? data.subject.sessionReference : undefined,
        industryFocus: Array.isArray(data.subject?.industryFocus) ? ASSISTANT_INDUSTRIES.filter(industry => data.subject.industryFocus.includes(industry)) : undefined }]);
      answered = true;
      requestAnimationFrame(() => {
        scrollConversationTo(latestMessage.current);
        // A reply must not interrupt someone already typing their next question.
        if (!input.current || document.activeElement !== input.current) {
          heading.current?.focus({ preventScroll: true });
        }
      });
    } catch (error) { if (request.current === controller) {
      setError(joobiRequestErrorMessage(error, controller.signal.aborted, typeof navigator !== 'undefined' && navigator.onLine === false, phase));
      quota.refresh();
    } }
    finally { clearTimeout(timeout); if (request.current === controller) {
      request.current = null; unfinished.current = null; setLoading(false); setPendingQuestion(null); setPricePreview(null);
      if (!answered) { setFailedQuestion(submittedQuestion); setQuestion(draft => draft || submittedQuestion); }
    } }
  };
  // 인사·감사·맞장구는 AI에 보내지 않고 바로 답해요. 횟수·로그인·전송 동의가 필요 없어요.
  const replyLocally = (text: string) => {
    const clarification = assistantChoiceClarification(text, answer?.currentStatus);
    const kind = assistantSmallTalk(text);
    if ((!kind && !clarification) || request.current) return false;
    // 주비의 물음에 답한 "네"나 되묻는 "네?"는 다음 질문이에요. "알겠어요" 같은 맞장구는 그대로 화면에서 답해요.
    // 로그인 전이거나 오늘 질문을 다 썼으면 보낼 수 없으니 이때도 화면에서 답해요.
    if (!clarification && kind === 'acknowledge' && owner !== 'guest' && quota.remaining !== 0 && (repliesToJoobi(text) || /[?？]/.test(text))) return false;
    const reply = clarification ?? assistantSmallTalkReply(kind!, { subject: symbol === GENERAL_SUBJECT ? undefined : subject, hasConversation: !!lastAnswered });
    setAnswers(previous => [...previous, { local: true, turnId: (previous.at(-1)?.turnId ?? -1) + 1, question: text, symbol, market, period,
      currentStatus: reply, keyAdvice: [], conclusion: { desc: '' }, followUps: kind === 'farewell' ? [] : lastAnswered?.followUps?.length ? lastAnswered.followUps : starters }]);
    setQuestion(''); resetTransient();
    requestAnimationFrame(() => scrollConversationTo(latestMessage.current));
    return true;
  };
  const ask = (event: React.FormEvent) => {
    event.preventDefault();
    if (request.current || question.trim().length < 1) return;
    if (replyLocally(question.trim())) return;
    if (tooShort(question.trim()) || quota.remaining === 0) return;
    if (owner === 'guest') { savePendingQuestion(question, symbol === GENERAL_SUBJECT ? undefined : symbol); window.dispatchEvent(new CustomEvent('open-login')); return; }
    setConsent(true);
    void sendQuestion(true);
  };
  return <div data-empty={!answers.length && !loading && !failedQuestion} className={`${chat.chat}${!answers.length && !loading && !failedQuestion ? ` ${chat.empty}` : ''}${embedded ? ` ${chat.embedded}` : ''}`}>
    <div className={chat.surface} inert={options !== null}>
    <button type="button" className={chat.contextBar} aria-label="대화 설정" aria-haspopup="dialog" onClick={() => setOptions('context')}>
      <span className={chat.contextMeta}><span className={chat.subject}><MessageCircle size={15} aria-hidden="true" />{subject}</span><span className={chat.periodTag}>{ASSISTANT_PERIOD_LABELS[period]}</span></span>
      <span className={chat.settingsLabel}><SlidersHorizontal size={16} aria-hidden="true" />변경</span>
    </button>
    <div className={chat.readingArea}>
    <div ref={transcript} className={chat.transcript} role="region" aria-label="주비와 나눈 대화, 위아래로 스크롤" tabIndex={0}><div ref={transcriptContent}>
    {notice}
    {!!answers.length && <div className={chat.sessionNote}><span>이 탭에서 나눈 이야기를 이어가요</span><button type="button" disabled={loading} onClick={() => setConfirmClear(true)}>대화 지우기</button></div>}
    {confirmClear && <div className={chat.confirmation}><p>이 대화와 작성 중인 질문을 지울까요?</p><div><button type="button" onClick={() => setConfirmClear(false)}>계속 이야기하기</button><button type="button" onClick={resetConversation}>지우고 새로 시작</button></div></div>}
    {!answers.length && !loading && !failedQuestion && <>
      <div className={chat.welcome}><JoobiAvatar large mood="hello" /><div><h3>{symbol === GENERAL_SUBJECT ? '주식, 어디가 궁금하세요?' : `${subject}, 어떤 점이 궁금하세요?`}</h3><p>주가가 왜 움직였는지, 낯선 말은 무슨 뜻인지 물어보세요.</p></div></div>
      {!question.trim() && <div className={chat.suggestions} role="group" aria-labelledby={`${id}-examples`}><p id={`${id}-examples`} className={chat.suggestionsLabel}>궁금한 질문을 골라보세요</p>{starters.map(text => <button type="button" key={text} className={chat.starterBubble} onClick={() => fillQuestion(text)}><MessageCircle size={18} strokeWidth={1.6} aria-hidden="true" /><span>{text}</span></button>)}</div>}
    </>}
    {!!answers.length && <div className={chat.thread} aria-label="주비와 나눈 대화">
      {answers.map((answer, index) => {
        const latest = index === answers.length - 1;
        const answerName = STOCK_KR[answer.symbol] || (answer.assistantEvidence?.price?.symbol === answer.symbol ? answer.assistantEvidence.price.label : undefined) || answer.symbol;
        // 같은 종목·같은 거래일 답이 이어지면 대상 표시를 반복하지 않는다.
        const previous = answers.slice(0, index).findLast(item => !item.local);
        const sameSubjectAsPrevious = !!previous && previous.symbol === answer.symbol && previous.market === answer.market && previous.assistantEvidence?.price?.day === answer.assistantEvidence?.price?.day;
        return <section key={answer.turnId} ref={latest ? latestMessage : undefined} className={chat.turn} aria-label={`${index + 1}번째 질문과 답변`}>
          <p className={chat.userMessage}><span className="sr-only">내 질문: </span>{answer.question}</p>
          <div className={chat.assistantLabel}><JoobiAvatar mood={latest && !loading ? joobiReplyReaction(answer.question, !!answer.local) : 'idle'} /><span>주비 <span className={chat.muted}>AI 주식비서</span></span></div>
    <article className={chat.response}>
      <h3 ref={latest ? heading : undefined} tabIndex={-1} className="sr-only">주비의 답변: {answer.question}</h3>
      {!answer.local && !answer.pricePreview && (answer.symbol !== GENERAL_SUBJECT || answer.market) && !sameSubjectAsPrevious && <p className={chat.answerSubject}>{answer.symbol === GENERAL_SUBJECT ? `${answer.market === 'us' ? '미국' : '한국'} 시장` : answerName !== answer.symbol ? `${answerName} · ${answer.symbol}` : answer.symbol}{answer.assistantEvidence?.price ? ` · ${answer.assistantEvidence.price.day} 거래일` : ''}</p>}
      {!answer.local && answer.symbol !== symbol && <p className={chat.scopeNote}>질문에서 확인한 종목은 {answerName}예요.</p>}
      {answer.pricePreview && <PriceStrip preview={answer.pricePreview} />}
      <AnswerParagraphs text={answer.currentStatus} />
      {answer.keyAdvice.map((text, index) => <AnswerParagraphs key={index} text={text} />)}
      {(answer.assistantEvidence?.price || !!answer.assistantInsights?.length) && <details className={chat.detailGroup}><summary className={readingUI.disclosure}>근거와 비교 더 보기</summary>
      {answer.assistantEvidence?.price && <section className={chat.priceComparison} aria-label="같은 기간의 주가 비교">
        {!answer.pricePreview && <><header><h4>{answer.assistantEvidence.comparisons.length ? '같은 기간의 움직임' : '가격 변화'}</h4><p className={chat.muted}>{answer.assistantEvidence.price.baselineDay} 종가 대비<br />{answer.assistantEvidence.price.day} 마지막 가격</p></header>
        <dl>{[answer.assistantEvidence.price, ...answer.assistantEvidence.comparisons].map(price => <div key={price.symbol}><dt>{price.label}</dt><dd data-direction={price.changePercent < 0 ? 'down' : price.changePercent > 0 ? 'up' : 'flat'}>{price.changePercent > 0 ? '+' : ''}{price.changePercent.toFixed(2)}%</dd></div>)}</dl></>}
        {answer.assistantEvidence.price.intradayLowChangePercent !== undefined && <p className={chat.comparisonNote}><FinancialText>{(answer.assistantEvidence.price.intradayLowChangePercent === 0 ? '장중 가장 낮았을 때의 가격은 전일 종가와 같았어요.' : `장중 가장 낮았을 때는 전일 종가보다 ${Math.abs(answer.assistantEvidence.price.intradayLowChangePercent).toFixed(2)}% ${answer.assistantEvidence.price.intradayLowChangePercent < 0 ? '낮았어요' : '높았어요'}.`) + ' 위 등락률은 마지막으로 받은 가격 기준이에요.'}</FinancialText></p>}
        <p className={chat.comparisonNote}>{answer.assistantEvidence.comparisons.length > 0 && '함께 움직였더라도 같은 이유 때문이라고 단정할 수는 없어요. '}배당금은 포함하지 않았어요.</p>
      </section>}
      {answer.assistantInsights?.map((insight, index) => <section key={index} className={chat.insight}><h4>{insight.kind === 'interpretation' ? '이런 영향으로 이어질 수 있어요' : '자료에서 살펴본 내용'}</h4><p><FinancialText>{insight.text}</FinancialText></p><div className={chat.evidenceLinks}>{insight.evidenceIds.map(evidenceId => { const evidence = answer.assistantEvidence?.evidence.find(e => e.id === evidenceId); return evidence && <a key={evidenceId} href={evidence.url} target="_blank" rel="noopener noreferrer">{evidence.kind === 'article' ? '기사 본문' : evidence.kind === 'headline' ? '기사 제목' : evidence.kind === 'price' ? '가격 자료' : evidence.kind === 'reference' ? '회사·상품 자료' : '공시 자료'} · {evidence.publisher}<span className="sr-only"> (새 창)</span></a>; })}</div></section>)}
      </details>}
      {!answer.local && !answer.followUps?.length && <p><FinancialText>{answer.conclusion.desc}</FinancialText></p>}
      {!answer.local && <details className={chat.detailGroup}><summary className={readingUI.disclosure}>답변에 제공한 자료</summary><p className={chat.muted}>제공한 자료 목록이에요. 답변의 모든 문장을 검증했다는 뜻은 아니에요.</p>
        {answer.assistantEvidence && <><p className={chat.muted}>자료를 받은 시각: {new Date(answer.assistantEvidence.checkedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국 시간)</p>{answer.assistantEvidence.gaps.map((gap, i) => <p className={chat.muted} key={i}>{gap}</p>)}</>}
        {answer._meta?.sourceDetails?.length ? <ul className={chat.sourceList}>{answer._meta.sourceDetails.map((source, index) => <li key={index}>{source.url && /^https:\/\//.test(source.url) ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} · {source.provider}<span className="sr-only"> (새 창)</span></a> : `${source.name} · ${source.provider}`}{source.note && <small>{source.note}</small>}</li>)}</ul> : <p>이번 질문에 연결된 출처 자료가 없어요. 최신 회사 소식이나 실적은 확인하지 못했어요.</p>}</details>}
      {latest && !!answer.followUps?.length && <div className={chat.followUps}><h4>{answer.local ? '이런 것부터 물어볼 수 있어요' : '여기서 더 궁금하다면'}</h4>{quota.remaining === 0 && <p className={chat.muted}>오늘은 질문을 모두 사용했어요. 용어 설명과 지난 답변은 계속 볼 수 있어요.</p>}{answer.followUps.map(text => <button type="button" key={text} className={chat.suggestion} disabled={loading || quota.remaining === 0} onClick={() => fillQuestion(text)}><span>{text}</span><ChevronRight size={18} aria-hidden="true" /></button>)}</div>}
      {answer.qualityReceipt && <AnswerFeedback receipt={answer.qualityReceipt} question={answer.question} answer={[answer.currentStatus, ...answer.keyAdvice, ...(answer.assistantInsights ?? []).map(insight => insight.text)].join('\n\n')} />}
      {answer.local ? <p className={chat.muted}>바로 드린 답이라 질문 횟수는 쓰지 않았어요.</p> : latest && <p className={chat.muted}>밑줄 있는 용어를 누르면 뜻을 읽고 내 주식사전에 저장할 수 있어요.</p>}
    </article>
        </section>;
      })}
      {lastAnswered && <div className={chat.continueActions} aria-label="답변을 다시 설명받기">
        {['더 쉽게 설명해 줘', '예를 들어 설명해 줘'].map(text => <button key={text} type="button" disabled={loading || quota.remaining === 0} onClick={() => fillQuestion(text)}>{text}</button>)}
      </div>}
    </div>}
    {!loading && failedQuestion && <div ref={pendingMessage}><p className={chat.userMessage}><span className="sr-only">답변을 받지 못한 질문: </span>{failedQuestion}</p><div className={chat.assistantLabel}><JoobiAvatar mood="retry" /><p className={chat.failedNote}>이 질문의 답변을 받지 못했어요.</p></div></div>}
    {loading && <div ref={pendingMessage}><p className={chat.userMessage}><span className="sr-only">보낸 질문: </span>{pendingQuestion}</p><div className={`${chat.waiting}${pricePreview ? ` ${chat.waitingWithFacts}` : ''}`} role="status"><JoobiAvatar mood={JOOBI_STAGE_REACTIONS[stage]} /><span>{JOOBI_STAGES[stage]}</span><span className={chat.dots} aria-hidden="true"><i /><i /><i /></span></div>{pricePreview && <PriceStrip preview={pricePreview} />}</div>}
    {stopped && <p className={chat.footnote} role="status">답변 기다리기를 멈췄어요. 질문을 고쳐 다시 보낼 수 있어요. 이미 보낸 질문은 이용 횟수에 포함될 수 있어요.</p>}
    </div>
    </div>
    {embedded&&scrollState.overflow&&<><div className={chat.scrollRail} aria-hidden="true"><span ref={scrollThumb} /></div><button type="button" className={chat.scrollCue} onClick={()=>{const view=transcript.current;if(view)view.scrollTo({top:scrollState.more?view.scrollTop+view.clientHeight*.8:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}>{scrollState.more?'대화 아래로 이동':'대화 처음으로 이동'}<ChevronDown size={14} aria-hidden="true" className={!scrollState.more?chat.pointUp:undefined} /></button></>}
    </div>
    <form onSubmit={ask} className={chat.composer}>
      <div className={chat.inputBox}>
      <label className="sr-only" htmlFor={`${id}-question`}>{answer ? '이어서 궁금한 점' : '주비에게 질문하기'}</label>
        <textarea autoComplete="off" ref={input} id={`${id}-question`} value={question} maxLength={QUESTION_LIMIT} rows={1} onChange={event => { setQuestion(event.target.value); setConfirmedSymbol(undefined); setCandidates([]); }} placeholder={loading ? '기다리는 동안 다음 질문을 적어도 좋아요' : answer ? '이어서 물어보세요' : '주비에게 물어보세요'} aria-describedby={`${id}-privacy`} onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
            event.preventDefault(); event.currentTarget.form?.requestSubmit();
          }
        }} />
        <div className={chat.inputFooter}><JoobiAvatar size={28} mood={joobiComposerReaction({ options, clear: confirmClear, loading, stage, stopped, error: !!error, candidates: !!candidates.length, limited: quota.remaining === 0, typing: !!question.trim(), history: !!answers.length })} />{loading ? <button key="stop" type="button" className={chat.stop} onClick={stopWaiting}>중단</button> : <button key="send" type="submit" className={`${chat.send}${owner !== 'guest' && !consent ? '' : ` ${chat.sendIcon}`}`} disabled={tooShort(question.trim()) || (owner !== 'guest' && quota.remaining === 0 && !clarifiesChoice(question.trim()))} aria-describedby={owner !== 'guest' && !consent ? `${id}-consent` : undefined} aria-label={owner === 'guest' ? '로그인하고 질문하기' : '질문 보내기'}>{owner !== 'guest' && !consent ? '물어보기' : <ArrowUp size={21} aria-hidden="true" />}</button>}</div>
      </div>

      {error && <p className={chat.error} role="alert">{error}</p>}
      {!loading && failedQuestion && !candidates.length && <button type="button" className={chat.retry} disabled={quota.remaining === 0} onClick={() => void sendQuestion(consent, failedQuestion)}>이 질문 다시 보내기</button>}
      {!!candidates.length && <div className={chat.stockChoices} aria-label="질문의 종목 확인">{candidates.map(candidate => <button key={candidate.symbol} type="button" aria-pressed={confirmedSymbol === candidate.symbol} onClick={() => { setConfirmedSymbol(candidate.symbol); setError(`${candidate.label} (${candidate.symbol})로 확인했어요. 질문을 보내주세요.`); }}>{candidate.label} ({candidate.symbol})</button>)}</div>}
      <div className={chat.composerInfo}>
        <div className={chat.composerMeta}><p className={chat.quotaNote} aria-live="polite">{stopped ? '중단한 질문도 횟수에 포함될 수 있어요' : quota.status === 'signed-out' ? '로그인 후 질문할 수 있어요' : typeof quota.remaining === 'number' ? quota.remaining === 0 ? '오늘 질문을 모두 사용했어요. 내일 다시 물어볼 수 있어요.' : `오늘 ${quota.remaining}번 더 물어볼 수 있어요` : '질문을 보내면 1회를 사용해요'}</p><button type="button" id={`${id}-privacy`} onClick={() => setOptions('privacy')}>전송 안내</button></div>
        {owner !== 'guest' && !consent && <p id={`${id}-consent`}>버튼이나 Enter로 보내면 질문·최근 대화·선택 종목·헷갈리는 용어를 AI에 보내요.</p>}
      </div>
    </form>
    </div>
    {options && <ConversationOptions title={options === 'context' ? '대화 대상과 기간' : 'AI 전송·대화 보관'} onClose={() => setOptions(null)}>
      {options === 'context' ? <>
      <div className={chat.settings}>
        <div><label htmlFor={`${id}-stock`}>이야기할 종목</label>
          <div className={chat.selectWrap}><select id={`${id}-stock`} value={symbol} disabled={loading} onChange={event => chooseSymbol(event.target.value)}>
            <option value={GENERAL_SUBJECT}>{`${market === 'kr' ? '한국' : '미국'} 시장에 대해 물어보기`}</option>
            {initialSymbol && !available.some(stock => stock.symbol === initialSymbol) && <option value={initialSymbol}>{STOCK_KR[initialSymbol] || initialSymbol} · 지금 보고 있는 종목</option>}
            {available.map(stock => <option key={stock.symbol} value={stock.symbol}>{STOCK_KR[stock.symbol] || stock.name || stock.symbol} ({stock.symbol})</option>)}
          </select><ChevronDown size={16} aria-hidden="true" /></div>
        </div>
        {symbol === GENERAL_SUBJECT && <div className={chat.optionField}><span id={`${id}-market`}>이야기할 시장</span><div className={chat.segments} role="group" aria-labelledby={`${id}-market`}>{(['kr', 'us'] as const).map(value => <button type="button" key={value} aria-pressed={market === value} disabled={loading} onClick={() => changeContext(GENERAL_SUBJECT, value)}>{value === 'kr' ? '한국 시장' : '미국 시장'}</button>)}</div></div>}
        <div className={chat.optionField}><span id={`${id}-period`}>주가를 비교할 기간</span><div className={chat.segments} role="group" aria-labelledby={`${id}-period`}>{ASSISTANT_PERIODS.map(value => <button type="button" key={value} aria-pressed={period === value} disabled={loading} onClick={() => changeContext(symbol, market, value)}>{ASSISTANT_PERIOD_LABELS[value]}</button>)}</div></div>
        {!!available.length && <div className={chat.optionField}><span>내 종목에서 고르기</span><div className={chat.optionStocks}>{available.map(stock => <button key={stock.symbol} type="button" disabled={loading} aria-pressed={symbol === stock.symbol} onClick={() => chooseSymbol(stock.symbol)}>{STOCK_KR[stock.symbol] || stock.name || stock.symbol}{(STOCK_KR[stock.symbol] || stock.name) !== stock.symbol && <small>{stock.symbol}</small>}</button>)}</div></div>}
        <p className={chat.settingsNote}>종목·시장·기간별로 대화를 나눠요. 다른 대화를 보고 돌아와도 이 탭에서는 이어갈 수 있어요.</p>
      </div>

      </> : <div className={chat.privacyCopy}><p>적은 질문과 최근 대화 3개, 선택한 종목·시장·기간, ‘아직 헷갈려요’로 표시한 용어를 보내요. 보유 수량·평균 매수가는 자동으로 보내지 않아요. 계좌번호·연락처는 적지 마세요. 인사나 고맙다는 말에는 AI에 보내지 않고 바로 답하며, 질문 횟수를 쓰지 않아요.</p><p>종목·시장·기간별 최근 대화 20개를 이 탭에서만 유지해요. 답변에는 직전 대화 3개를 보내요. 질문창을 닫아도 이어갈 수 있고, 새로고침·탭 닫기·로그아웃하면 지워져요. 로그인 전에 적은 질문 하나는 로그인한 뒤 입력창에 다시 보여드리고, 자동으로 보내지 않아요. 질문 유형·응답 시간·실패 여부는 원문 없이 30일간 집계해요. 버튼 평가는 계정과 연결해 보관해요. 별도로 동의해 제공한 검수 사례만 서버에 30일간 저장해요. 답변을 기다리다 창을 닫으면 기다리기가 중단돼요.</p>{owner !== 'guest' && <SharedAnswerCases key={owner} />}</div>}
    </ConversationOptions>}
  </div>;
}
