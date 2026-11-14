'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { FINANCIAL_TERMS } from '@/lib/financialTerms';
import { uniquePageFlipRef } from '@/lib/pageFlipRef';
import PersonalLearningProvider from './PersonalLearningProvider';
import SaveTermButton from './SaveTermButton';
import DictionaryStory from './DictionaryStory';
import theme from './DictionaryTheme.module.css';
import styles from './DictionaryBookPreview.module.css';

type Term = (typeof FINANCIAL_TERMS)[number];
interface FlipEngine {
  flipNext(corner?: 'top' | 'bottom'): void;
  flipPrev(corner?: 'top' | 'bottom'): void;
  turnToPage(page: number): void;
  getCurrentPageIndex(): number;
  getOrientation(): 'portrait' | 'landscape';
  destroy(): void;
}
interface BookHandle { pageFlip(): FlipEngine | undefined }

export const DictionaryBookLeaf = forwardRef<HTMLDivElement, { term: Term; number: number }>(function Leaf({ term, number }, ref) {
  const pageRef = useMemo(() => uniquePageFlipRef(ref), [ref]);
  return <div ref={pageRef} className={styles.leaf} data-density="soft">
    <article className={`${styles.page} ${number % 2 ? styles.leftPage : styles.rightPage}`}>
      <header className={styles.runningTitle}><span>주비 주식사전</span><SaveTermButton termId={term.id} compact notebook /></header>
      <div className={styles.pageText} onMouseDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}>
        <h2>{term.title.split(' · ')[0]}</h2>
        <p className={styles.subtitle}>{term.title.split(' · ').slice(1).join(' · ')}</p>
        <p className={styles.meaning}>{term.meaning}</p>
        {term.example && <section className={styles.example}><h3>예를 들면</h3><p>{term.example}</p></section>}
        <DictionaryStory termId={term.id} /><div className={styles.actions}><a href={term.source} target="_blank" rel="noopener noreferrer">설명의 출처<span className="sr-only"> (새 창)</span></a></div>
      </div>
      <footer className={styles.folio}>{number}</footer>
    </article>
  </div>;
});

function Book() {
  const host = useRef<HTMLDivElement>(null);
  const book = useRef<BookHandle>(null);
  const [current, setCurrent] = useState(0);
  const [portrait, setPortrait] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [search, setSearch] = useState('');
  // Stable children prevent the wrapper from rebuilding its page collection on every flip.
  const pages = useMemo(() => FINANCIAL_TERMS.map((term, index) => <DictionaryBookLeaf key={term.id} term={term} number={index + 1} />), []);
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(motion.matches);
    sync(); motion.addEventListener('change', sync);
    return () => motion.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    const container = host.current;
    let engine: FlipEngine | undefined;
    const timer = setInterval(() => {
      engine = book.current?.pageFlip();
      if (engine) { setReady(true); setPortrait(engine.getOrientation() === 'portrait'); clearInterval(timer); }
    }, 50);
    return () => {
      clearInterval(timer);
      const mountedEngine = engine ?? book.current?.pageFlip();
      // The upstream React wrapper does not dispose the engine on unmount.
      // Defer until React has detached the host; StrictMode rehearsal stays connected.
      queueMicrotask(() => { if (container && !container.isConnected) mountedEngine?.destroy(); });
    };
  }, [reduced]);
  const step = portrait ? 1 : 2;
  const last = current + step >= pages.length;
  const go = (direction: number) => {
    const engine = book.current?.pageFlip();
    if (!engine || !ready) return;
    if (reduced) engine.turnToPage(Math.max(0, Math.min(pages.length - 1, current + direction * step)));
    else if (direction > 0) engine.flipNext('bottom');
    else engine.flipPrev('bottom');
  };
  const matches = search.trim() ? FINANCIAL_TERMS.filter(term => `${term.title} ${term.aliases.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())) : [];
  return <main className={`${theme.theme} ${styles.screen}`}>
    <header className={styles.header}><div><h1>내 주식사전<span>{pages.length}개 용어</span></h1><p className={styles.intro}>궁금한 주식 용어를 찾아보세요.</p></div>
    <div className={styles.toolbar}>
      <label className={styles.search}><Search size={18} aria-hidden="true" /><span className="sr-only">단어 찾기</span><input type="search" placeholder="궁금한 단어 찾기" value={search} onChange={event => setSearch(event.target.value)} /></label>
    </div></header>
    {search.trim() && <section className={styles.results} aria-label="단어 검색 결과">{matches.length ? matches.map(term => <button className={theme.button} key={term.id} type="button" onClick={() => { book.current?.pageFlip()?.turnToPage(FINANCIAL_TERMS.indexOf(term)); setSearch(''); }}>{term.title.split(' · ')[0]}</button>) : <p role="status">찾는 단어가 없어요. 다른 말로 검색해 보세요.</p>}</section>}
    <div className={styles.cover} ref={host}>
      <HTMLFlipBook ref={book} key={String(reduced)} className={styles.book} style={{}} width={360} height={470} size="stretch" minWidth={280} maxWidth={380} minHeight={390} maxHeight={510} startPage={current} drawShadow flippingTime={800} usePortrait startZIndex={1} autoSize maxShadowOpacity={0.24} showCover={false} mobileScrollSupport={false} clickEventForward useMouseEvents={!reduced} swipeDistance={40} showPageCorners={!reduced} disableFlipByClick onFlip={(event: { data: number }) => setCurrent(event.data)} onChangeOrientation={(event: { data: string }) => setPortrait(event.data === 'portrait')}>
        {pages}
      </HTMLFlipBook>
    </div>
    <nav className={styles.navigation} aria-label="책장 넘기기"><button type="button" className={theme.button} disabled={!ready || current === 0} onClick={() => go(-1)}><ChevronLeft size={18} aria-hidden="true" />이전 장</button><span aria-live="polite">{current + 1}{!portrait && current + 1 < pages.length ? `–${current + 2}` : ''} / {pages.length}</span><button type="button" className={theme.button} disabled={!ready || last} onClick={() => go(1)}>다음 장<ChevronRight size={18} aria-hidden="true" /></button></nav>
    <p className={styles.turnHint}>{reduced ? '이전·다음 버튼으로 읽어보세요.' : '모서리를 잡아 넘길 수도 있어요.'}</p><p className={styles.previewNote}>디자인 시안 · 저장한 단어는 이 브라우저에 보관돼요.</p>
  </main>;
}

export default function DictionaryBookPreview() {
  return <PersonalLearningProvider owner="guest"><Book /></PersonalLearningProvider>;
}
