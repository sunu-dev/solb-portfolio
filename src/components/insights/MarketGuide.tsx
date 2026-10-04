'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react';
import { MARKET_GUIDES, type MarketGuide as Guide, type MarketGuideId } from '@/config/marketGuides';
import { useGuideDrafts, useGuideNotebook } from '@/hooks/useGuideNotebook';
import { useEconomicEvents } from '@/hooks/useEconomicEvents';
import { useAuth } from '@/hooks/useAuth';
import { GUIDE_NOTE_LIMIT, isGuideId, type GuideEntry } from '@/lib/guideNotebook';
import { getGuideDraftState, type GuideDraft } from '@/lib/guideDraftSession';
import { stockGuideConnections, guideEvents } from '@/lib/guideConnections';
import { logGuideEvent } from '@/lib/tourTelemetry';
import { usePortfolioStore } from '@/store/portfolioStore';
import { openEconomicCalendar } from '@/components/economy/EconomicHighlights';
import ReadingText from '@/components/common/ReadingText';
import CompanyConnections from './CompanyConnections';
import styles from './MarketGuide.module.css';

const dateLabel = (at: string | number) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(new Date(at));

export interface MarketGuideRequest { id: MarketGuideId; key: number }

export default function MarketGuide({ request, children }: { request?: MarketGuideRequest; children: ReactNode }) {
  const requestKey = request?.key;
  const [selection, setSelection] = useState<{ id: MarketGuideId | null; requestKey?: number }>({ id: null });
  // A new external request changes the topic, while local navigation can leave it again.
  // Unsaved text lives in page memory across upper-menu navigation.
  const selected = selection.requestKey === requestKey ? selection.id : request?.id ?? null;
  const returnTarget = useRef<string | null>(null);
  const select = (id: MarketGuideId | null) => {
    if (id) returnTarget.current = `guide-${id}`;
    setSelection({ id, requestKey });
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'insights');
    if (id) url.searchParams.set('guide', id); else url.searchParams.delete('guide');
    if (url.href !== window.location.href) window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };
  const { drafts, updateDraft } = useGuideDrafts();
  const { notebook, ready, save } = useGuideNotebook();
  const previous = useRef<{ id: MarketGuideId | null; requestKey?: number }>({ id: null });
  const logged = useRef<{ id: MarketGuideId | null; requestKey?: number }>({ id: null });
  const guide = MARKET_GUIDES.find(item => item.id === selected);
  const saved = MARKET_GUIDES.filter(item => notebook.entries[item.id]?.savedAt);

  useEffect(() => {
    const restore = () => {
      const id = new URLSearchParams(window.location.search).get('guide');
      setSelection({ id: isGuideId(id) ? id : null, requestKey });
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [requestKey]);

  useEffect(() => {
    const captureOrigin = (event: Event) => {
      const id = (event as CustomEvent<{ returnFocusId?: string }>).detail?.returnFocusId;
      returnTarget.current = typeof id === 'string' && id.startsWith('report-guide-') ? id : null;
    };
    window.addEventListener('open-market-guide', captureOrigin, true);
    return () => window.removeEventListener('open-market-guide', captureOrigin, true);
  }, []);

  useEffect(() => {
    if (!ready || (selected === previous.current.id && requestKey === previous.current.requestKey)) return;
    if (selected && (selected !== logged.current.id || requestKey !== logged.current.requestKey)) logGuideEvent('open', selected);
    logged.current = { id: selected, requestKey };
    const frame = requestAnimationFrame(() => {
      const target = selected ? document.getElementById('market-guide-title')
        : (returnTarget.current ? document.getElementById(returnTarget.current) : null)
          ?? (previous.current.id ? document.getElementById(`guide-${previous.current.id}`) : null);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'start' });
      previous.current = { id: selected, requestKey };
    });
    return () => cancelAnimationFrame(frame);
  }, [selected, requestKey, ready]);

  if (guide) return <div className={styles.guide}>
    <button className={styles.back} onClick={() => select(null)}><ArrowLeft size={18} aria-hidden="true" />리포트로 돌아가기</button>
    <header className={styles.lessonHeader}>
      <p className={styles.eyebrow}>{guide.category}</p>
      <h2 id="market-guide-title" tabIndex={-1} className="reading-title">{guide.title}</h2>
      <p className="reading-copy"><ReadingText>{guide.summary}</ReadingText></p>
    </header>
    {ready ? <GuideLesson key={guide.id} guide={guide} entry={notebook.entries[guide.id]} draftEntry={drafts[guide.id]} updateDraft={draft => updateDraft(guide.id, draft)} save={patch => save(guide.id, patch)} /> : <p role="status">내 기록을 불러오고 있어요…</p>}
  </div>;

  return <>
    {children}
    <section className={styles.overview} aria-labelledby="guide-overview-title">
      <div className={styles.overviewTop}><h2 id="guide-overview-title">더 알아보기</h2>{saved.length > 0 && <span>메모 {saved.length}개</span>}</div>
      <div className={styles.topics}>
        {MARKET_GUIDES.map(item => <button id={`guide-${item.id}`} key={item.id} onClick={() => select(item.id)}>
          <span><small>{item.category}{getGuideDraftState(notebook.entries[item.id], drafts[item.id]).dirty ? ' · 작성 중' : notebook.entries[item.id]?.savedAt ? ' · 내 메모' : ''}</small><strong className="reading-title">{item.title}</strong></span><ChevronRight size={18} aria-hidden="true" />
        </button>)}
      </div>
    </section>
  </>;
}

function GuideLesson({ guide, entry, draftEntry, updateDraft, save }: {
  guide: Guide;
  entry?: GuideEntry;
  draftEntry?: GuideDraft;
  updateDraft: (draft?: GuideDraft) => void;
  save: (patch: Partial<GuideEntry>) => boolean;
}) {
  const [notice, setNotice] = useState('');
  const { user } = useAuth();
  const stocks = usePortfolioStore(s => s.stocks);
  const holdings = [...stocks.investing, ...stocks.watching].filter(stock => !stock.demo && stock.symbol.trim());
  const matches = stockGuideConnections(guide.id, holdings);
  const { data: economicData, error: economicError } = useEconomicEvents();
  const savedExplanation = entry?.explanation ?? '';
  const { text: draft, edited: hasLocalDraft, dirty, conflict } = getGuideDraftState(entry, draftEntry);
  const unmatchedHint = guide.connection === 'usd-value'
      ? '등록한 종목 중 달러로 거래되는 종목은 없어요. 기업이 쓰는 통화와 내 계좌의 환산 가치는 구분해서 살펴봐요.'
      : '현재 등록한 종목과의 직접적인 연결은 확인하지 못했어요. 사업 구조와 매출·비용에 따라 영향이 달라져요.';
  function saveNote() {
    const explanation = draft.trim();
    if (!explanation) return;
    if (save({ explanation, savedAt: Date.now() })) {
      updateDraft();
      setNotice(user ? '메모를 저장했어요.' : '이용 중 볼 메모를 남겼어요. 새로고침하거나 로그인하면 지워져요.');
      logGuideEvent('save', guide.id);
    } else setNotice('브라우저에 저장하지 못했어요. 복사해서 따로 보관해주세요.');
  }
  async function copyNote() {
    try { await navigator.clipboard.writeText(draft.trim()); setNotice('메모를 복사했어요.'); }
    catch { setNotice('자동 복사가 안 돼요. 입력한 글을 선택해서 복사해주세요.'); }
  }

  return <>
    <details className={styles.terms}><summary>용어 설명 <span>{guide.terms.length}개</span></summary><dl>{guide.terms.map(item => <div key={item.term}><dt>{item.term}</dt><dd><ReadingText>{item.meaning}</ReadingText></dd></div>)}</dl></details>
    <section className={styles.section} aria-labelledby="guide-path-title">
      <h3 id="guide-path-title">기업에는 어떤 영향이 있나요?</h3>
      <ol className={styles.path}>{guide.steps.map((step, index) => <li key={step.title}><span className={styles.number} aria-hidden="true">{index + 1}</span><div><h4 className="reading-title">{step.title}</h4><p className="reading-copy"><ReadingText>{step.body}</ReadingText></p></div></li>)}</ol>
      <aside className={styles.condition}><strong>함께 고려할 점</strong><p><ReadingText>{guide.condition}</ReadingText></p></aside>
    </section>
    <section className={styles.section} aria-labelledby="guide-watch-title"><h3 id="guide-watch-title">내 종목에서는 무엇을 봐야 하나요?</h3>
      <ul className={styles.watch}>{guide.watchPoints.map(point => <li key={point}><Check size={17} aria-hidden="true" /><span><ReadingText>{point}</ReadingText></span></li>)}</ul>
      {matches.length > 0 ? <CompanyConnections connections={matches} events={economicError ? null : economicData?.events} />
        : <p className={styles.hint}><ReadingText>{holdings.length === 0 ? '보유·관심 종목을 추가하면 함께 살펴볼 종목을 여기에서 볼 수 있어요.' : unmatchedHint}</ReadingText></p>}
    </section>
    {guide.eventKinds.length > 0 && <GuideFollowup guide={guide} />}
    <details className={styles.notes} open={!!entry?.savedAt || hasLocalDraft}>
    <summary><strong>{entry?.savedAt ? '내 메모' : '메모 남기기'}</strong></summary>
    <section className={styles.section} aria-label="메모">
      <label htmlFor="guide-note" className="sr-only">메모 내용</label>
      <textarea id="guide-note" value={draft} maxLength={GUIDE_NOTE_LIMIT} onChange={event => {
        updateDraft({ text: event.target.value, baseExplanation: hasLocalDraft && dirty && draftEntry ? draftEntry.baseExplanation : savedExplanation });
        setNotice('');
      }} rows={4} placeholder="다음 발표에서 확인할 내용이나 궁금한 점을 적어두세요." aria-describedby={conflict ? 'guide-note-storage guide-note-conflict' : 'guide-note-storage'} />
      <div className={styles.noteMeta}><span>{dirty ? user ? '작성 중 · 저장 전' : '작성 중' : entry?.savedAt ? `${dateLabel(entry.savedAt)} ${user ? '저장됨' : '메모 남김'}` : ''}</span><span>{draft.length}/{GUIDE_NOTE_LIMIT}</span></div>
      {conflict && <div className={styles.feedback} id="guide-note-conflict" role="status">
        <strong>다른 탭에서 메모가 바뀌었어요.</strong>
        <p>지금 쓰던 초안은 그대로 두었어요. 이 초안으로 저장하면 다른 탭의 기록을 바꿔요.</p>
        <details className={styles.model}><summary>새로 저장된 메모 보기</summary><p>{savedExplanation || '저장된 메모가 지워졌어요.'}</p></details>
      </div>}
      <div className={styles.noteActions}><button className={styles.primary} disabled={!draft.trim() || (!dirty && !!entry?.savedAt)} onClick={saveNote}>{user ? conflict ? '이 내용으로 바꿔 저장' : '저장하기' : conflict ? '이 내용으로 메모 바꾸기' : '메모 남기기'}</button><button className={styles.secondary} disabled={!draft.trim()} onClick={() => void copyNote()}>복사하기</button></div>
      {dirty && <p className={styles.hint}>{user ? '이 탭에서 다른 메뉴를 다녀와도 초안은 유지돼요. 새로고침하거나 탭을 닫기 전에는 저장해주세요.' : '이 탭에서 다른 메뉴를 다녀와도 초안은 유지돼요. 보관할 내용은 복사해두세요.'}</p>}
      <p id="guide-note-storage" className={styles.hint}>{user ? '이 브라우저에만 저장돼요. 로그아웃하면 지워져요.' : '이용 중에는 메모가 유지돼요. 새로고침하거나 로그인하면 지워져요. 계속 보관하려면 로그인 후 저장해주세요.'}</p><p className={styles.notice} role="status">{notice}</p>
    </section>
    </details>
    <details className={styles.sources}><summary>설명에 참고한 자료</summary><ul>{guide.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<span className="sr-only"> (새 창)</span></a></li>)}</ul></details>
  </>;
}

function GuideFollowup({ guide }: { guide: Guide }) {
  const { data, error, retry } = useEconomicEvents();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const events = guideEvents(guide, data?.events ?? [], now);
  return <section className={styles.followup} aria-labelledby="guide-followup-title"><h3 id="guide-followup-title">관련 발표</h3>
    {error ? <><p role="status">{error}</p><button className={styles.secondary} onClick={retry}>다시 불러오기</button></> : !data ? <p role="status">관련 발표를 확인하고 있어요…</p> : <>
      {events.recent && <button onClick={() => openEconomicCalendar(events.recent!.key)} className={styles.event}><span><small>최근 확인된 결과 · {dateLabel(events.recent.at)}</small><strong>{events.recent.title}</strong><span>{events.recent.result?.headline}</span></span><ChevronRight size={18} aria-hidden="true" /></button>}
      {events.upcoming && <button onClick={() => openEconomicCalendar(events.upcoming!.key)} className={styles.event}><span><small>다음 발표 · {dateLabel(events.upcoming.at)} (한국시간)</small><strong>{events.upcoming.title}</strong></span><ChevronRight size={18} aria-hidden="true" /></button>}
      {!events.recent && !events.upcoming && <p>현재 확인된 관련 발표가 없어요. 새 일정이 들어오면 여기에서 이어서 볼 수 있어요.</p>}
      {data.warnings.length > 0 && <p className={styles.hint}>일부 일정은 아직 확인 중이에요.</p>}
    </>}
  </section>;
}
