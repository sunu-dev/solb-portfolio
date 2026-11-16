'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Bookmark, Check, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from 'lucide-react';
import { financialTerm, FINANCIAL_TERMS } from '@/lib/financialTerms';
import { buildDictionaryReview, dictionaryReviewEntries, DICTIONARY_LIMIT, type DictionaryEntry, type ReviewQuestion } from '@/lib/personalDictionary';
import FinancialText from '@/components/common/FinancialText';
import readingUI from '@/components/ui/ReadingUI.module.css';
import { usePersonalDictionary } from './PersonalLearningProvider';
import SaveTermButton from './SaveTermButton';
import DictionaryReview from './DictionaryReview';
import DictionaryStory from './DictionaryStory';
import DictionaryConceptStage from './DictionaryConceptStage';
import styles from './StockDictionary.module.css';
import theme from './DictionaryTheme.module.css';

type Filter = 'saved' | 'find' | 'confused';
const sentenceSegmenter = new Intl.Segmenter('ko', { granularity: 'sentence' });
const starters = ['etf', 'return', 'stock', 'chart-volume'].flatMap(id => financialTerm(id) ?? []);

function EntryTools({ entry }: { entry: DictionaryEntry }) {
  const { ready, save, remove } = usePersonalDictionary();
  const [note, setNote] = useState(entry.note);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const removeButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  async function update(next: DictionaryEntry, success: string) {
    setPending(true);
    setMessage(await save(next) ? success : '저장하지 못했어요. 다시 시도해 주세요.');
    setPending(false);
  }
  return <div className={styles.entryTools}>
    <div className={styles.actions} role="group" aria-label="이해 정도 표시">
      <button type="button" className={theme.button} disabled={!ready || pending} aria-pressed={entry.familiarity === 'confused'} onClick={() => update({ ...entry, familiarity: 'confused' }, '복습할 단어로 표시했어요.')}>{entry.familiarity === 'familiar' ? '다시 복습할래요' : '아직 헷갈려요'}</button>
      <button type="button" className={theme.button} disabled={!ready || pending} aria-pressed={entry.familiarity === 'familiar'} onClick={() => update({ ...entry, familiarity: 'familiar' }, '이 단어는 앞으로 퀴즈에 나오지 않아요.')}><Check size={16} aria-hidden="true" />이해했어요</button>
    </div>
    <p className={styles.reviewHint}>이해한 단어는 퀴즈에서 빼고, 단어와 메모는 보관해요.</p>
    <details className={styles.noteEditor}><summary className={readingUI.disclosure}>내 메모{entry.note ? ' 보기' : ' 쓰기'}</summary><label htmlFor={id}>기억할 내용을 적어두세요</label><textarea id={id} rows={3} maxLength={900} value={note} onChange={event => setNote(event.target.value)} /><button type="button" disabled={pending} className={theme.button} onClick={() => update({ ...entry, note }, '메모를 저장했어요.')}>메모 저장</button></details>
    <div className={styles.entryFooter}>{entry.symbol && <span>이 단어를 본 종목 {entry.symbol}</span>}<button ref={removeButton} type="button" className={theme.linkButton} disabled={pending} aria-expanded={confirmRemove} onClick={() => setConfirmRemove(value => !value)}>사전에서 삭제</button></div>
    {confirmRemove && <div className={styles.removeConfirm} role="group" aria-label="단어 삭제 확인">
      <p><strong>{entry.title.split(' · ')[0]}</strong> 항목을 사전에서 삭제할까요?</p>
      <p className={theme.muted}>저장한 메모와 이해 정도 표시도 함께 삭제돼요.</p>
      <div className={styles.actions}>
        <button type="button" className={theme.button} disabled={pending} onClick={() => { setConfirmRemove(false); removeButton.current?.focus(); }}>취소</button>
        <button type="button" className={theme.button} disabled={pending} onClick={async () => {
          setPending(true);
          const removed = await remove(entry.id);
          if (!removed) { setMessage('삭제하지 못했어요. 다시 시도해 주세요.'); setPending(false); }
        }}>{pending ? '삭제 중' : '삭제하기'}</button>
      </div>
    </div>}
    {message && <p className={theme.message} role="status">{message}</p>}
  </div>;
}

/** One definition at a time; account-scoped storage stays in the existing provider. */
export default function StockDictionary({ initialTermId, titleId, onClose }: { initialTermId?: string; titleId: string; onClose: () => void }) {
  const { owner, entries, ready, error, reload, save } = usePersonalDictionary();
  const [search, setSearch] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [trail, setTrail] = useState<{id: string; title: string}[]>([]);
  const [filter, setFilter] = useState<Filter>('find');
  const [hideFamiliar, setHideFamiliar] = useState(true);
  const [selected, setSelected] = useState(initialTermId ? `term:${initialTermId}` : '');
  const [reading, setReading] = useState(Boolean(initialTermId));
  const [review, setReview] = useState<ReviewQuestion[] | null>(null);
  const [word, setWord] = useState(''), [message, setMessage] = useState(''), [saving, setSaving] = useState(false);
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  const listPane = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const dialog = heading.current?.closest('dialog');
      if (dialog?.open && (document.activeElement === dialog || document.activeElement === dialog.querySelector('button'))) heading.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const normalize = (text: string) => text.toLocaleLowerCase().trim();
  const q = normalize(search);
  const known = FINANCIAL_TERMS.find(term => term.aliases.some(alias => normalize(alias) === normalize(word)) || normalize(term.title.split(' · ')[0]) === normalize(word));
  const catalog = [...starters, ...FINANCIAL_TERMS.filter(term => !starters.some(start => start.id === term.id))].map(term => ({ id: `term:${term.id}`, termId: term.id, title: term.title, note: '', familiarity: 'new' as const }));
  const familiarCount = entries.filter(entry => entry.familiarity === 'familiar').length;
  const list = (filter === 'find' ? catalog : entries.filter(entry => filter === 'confused' ? entry.familiarity === 'confused' : !hideFamiliar || entry.familiarity !== 'familiar')).filter(entry => normalize(`${entry.title} ${entry.note} ${entry.termId ? financialTerm(entry.termId)?.aliases.join(' ') : ''}`).includes(q));
  const directTerm = selected.startsWith('term:') ? financialTerm(selected.slice(5)) : undefined;
  const active = list.find(entry => entry.id === selected) ?? (reading && selected ? entries.find(entry => entry.id === selected) ?? (directTerm ? { id: selected, title: directTerm.title, termId: directTerm.id } : undefined) : undefined) ?? list[0];
  const definition = active?.termId ? financialTerm(active.termId) : undefined;
  const sentences = definition ? Array.from(sentenceSegmenter.segment(definition.meaning), part => part.segment.trim()).filter(Boolean) : [];
  const saved = entries.find(entry => entry.id === active?.id);
  const activeIndex = list.findIndex(entry => entry.id === active?.id);
  const reviewCount = Math.min(3, dictionaryReviewEntries(entries).length);
  const related = definition?.related?.flatMap(termId => financialTerm(termId) ?? []) ?? [];
  const pick = (entryId: string, related = false) => {
    if (related && active && entryId !== active.id) setTrail(value => [...value, {id: active.id, title: active.title.split(' · ')[0]}].slice(-6));
    else if (!related) setTrail([]);
    setSelected(entryId); setReading(true); setReview(null);
    requestAnimationFrame(() => { if (reader.current) { reader.current.scrollTop = 0; reader.current.focus({ preventScroll: true }); } });
  };
  const chooseFilter = (next: Filter) => { setTrail([]); setFilter(next); setSearch(''); setSelected(''); setReading(false); setReview(null); if (listPane.current) listPane.current.scrollTop = 0; };
  const backToList = () => { setReading(false); setReview(null); requestAnimationFrame(() => searchInput.current?.focus({ preventScroll: true })); };
  return <section className={`${theme.theme} ${styles.notebook}`} data-stock-dictionary data-focus={focusMode} data-reading={reading || review !== null} onKeyDown={event => {
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault(); setFocusMode(false); backToList();
      }
      if (event.target === reader.current && !review && activeIndex >= 0) {
        if (event.key === 'ArrowRight' && activeIndex < list.length - 1) { event.preventDefault(); pick(list[activeIndex + 1].id); }
        if (event.key === 'ArrowLeft' && activeIndex > 0) { event.preventDefault(); pick(list[activeIndex - 1].id); }
      }
    }}>
    <header className={styles.header}>
      <div className={styles.identity}><Bookmark size={23} strokeWidth={1.8} aria-hidden="true" /><div><h2 ref={heading} id={titleId} tabIndex={-1} data-dialog-initial-focus>내 주식사전</h2><p>뜻을 읽고, 움직여 보며 이해해요.</p></div></div>
      <div className={styles.headerActions}><button type="button" className={styles.focusToggle} aria-pressed={focusMode} onClick={() => setFocusMode(value => !value)}>{focusMode ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}{focusMode ? '목록 함께 보기' : '넓게 보기'}</button><button type="button" className={styles.close} aria-label="내 주식사전 닫기" onClick={onClose}><X size={22} aria-hidden="true" /></button></div>
    </header>
    {error && <div role="alert" className={styles.connectionNotice}><span>저장한 단어 확인 필요 · {error}</span><button type="button" className={theme.button} onClick={reload}>다시 불러오기</button></div>}
    {!ready && !error && <p className={styles.loading} role="status">저장한 단어를 확인하고 있어요. 기본 용어부터 읽을 수 있어요.</p>}
    <div className={styles.workspace}>
      <aside className={styles.index} aria-label="단어 탐색">
        <div className={styles.finder}>
          <label className={styles.search}><Search size={18} aria-hidden="true" /><span className="sr-only">사전에서 찾기</span><input ref={searchInput} type="search" value={search} onChange={event => { setSearch(event.target.value); setTrail([]); setSelected(''); setReading(false); setReview(null); }} placeholder="어떤 단어가 궁금하세요?" /><kbd className={styles.searchKey} aria-hidden="true">/</kbd></label>
          <nav className={styles.tabs} aria-label="사전 분류">{(['find', 'saved', 'confused'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => chooseFilter(value)}>{value === 'saved' ? '내 단어' : value === 'find' ? '전체' : '헷갈려요'}{value === 'saved' && ready && <span>{entries.length}</span>}</button>)}</nav>
          <div className={styles.listMeta}><span aria-live="polite">{q ? `검색 결과 ${list.length}개` : filter === 'find' ? `${list.length}개의 투자 용어` : !ready ? '저장한 단어 확인 중' : `${list.length}개의 단어`}</span>{filter === 'saved' && ready && familiarCount > 0 && <label className={styles.knownToggle}><input type="checkbox" checked={hideFamiliar} onChange={event => { setHideFamiliar(event.target.checked); setSelected(''); setReading(false); }} />이해한 단어 숨기기</label>}</div>
        </div>
        <div ref={listPane} className={styles.listPane}>
          <div className={styles.wordList} aria-label="단어 목록">
            {list.map(entry => <button type="button" className={styles.word} key={entry.id} aria-pressed={active?.id === entry.id && !review} onClick={() => pick(entry.id)}><span><strong>{entry.title.split(' · ')[0]}</strong><small>{entry.title.split(' · ').slice(1).join(' · ') || (entry.termId ? '뜻과 예시 보기' : '직접 적은 단어')}</small></span>{entries.some(item => item.id === entry.id) ? <Bookmark size={15} aria-label="저장됨" /> : <ChevronRight size={16} aria-hidden="true" />}</button>)}
          </div>
          {list.length === 0 && <div className={styles.emptyHint}><Bookmark size={28} strokeWidth={1.4} aria-hidden="true" /><h3>{!ready ? '저장한 단어를 확인하고 있어요' : q ? '일치하는 단어가 없어요' : filter === 'saved' && hideFamiliar && familiarCount > 0 ? '모두 이해한 단어예요' : filter === 'saved' ? '아직 저장한 단어가 없어요' : '헷갈리는 단어가 없어요'}</h3><p>{q ? '다른 이름이나 짧은 단어로 찾아보세요.' : '읽다가 다시 보고 싶은 단어를 저장해 보세요.'}</p><button type="button" className={theme.button} onClick={() => { if (filter === 'saved' && familiarCount > 0) setHideFamiliar(false); else chooseFilter('find'); setSearch(''); }}>{filter === 'saved' && familiarCount > 0 ? '이해한 단어 보기' : '전체 단어 보기'}</button></div>}
        </div>
        <details className={styles.add}><summary data-ui-disclosure="composite"><Plus size={16} aria-hidden="true" />단어 직접 추가</summary><form onSubmit={async event => {
          event.preventDefault(); if (!ready || !word.trim() || saving) return;
          const entry: DictionaryEntry = { id: known ? `term:${known.id}` : `custom:${crypto.randomUUID()}`, ...(known ? { termId: known.id } : {}), title: known?.title ?? word.trim(), note: '', savedAt: new Date().toISOString(), familiarity: 'new' };
          if (entries.some(item => item.id === entry.id || item.title === entry.title)) { setMessage('이미 저장한 단어예요.'); return; }
          setSaving(true); const ok = await save(entry); setSaving(false);
          if (ok) { setWord(''); setMessage('사전에 저장했어요.'); setFilter('saved'); setSearch(''); pick(entry.id); } else setMessage('저장하지 못했어요. 다시 시도해 주세요.');
        }}><label htmlFor={`${id}-new`}>추가할 단어</label><input id={`${id}-new`} maxLength={100} value={word} onChange={event => setWord(event.target.value)} placeholder="예: ETF, 거래량" /><button className={theme.button} disabled={!ready || !word.trim() || saving} type="submit">{saving ? '저장 중' : '저장'}</button>{known && <p className={theme.muted}>뜻과 출처도 함께 저장해요.</p>}</form>{message && <p role="status" className={theme.message}>{message}</p>}</details>
      </aside>
      <div className={styles.readingPane}>
        <button type="button" className={styles.backToList} onClick={backToList}><ArrowLeft size={18} aria-hidden="true" />단어 목록</button>
        <div ref={reader} className={styles.reader} tabIndex={-1} role="region" aria-label="사전 내용">
          {review ? <DictionaryReview questions={review} onClose={() => { setReview(null); setReading(Boolean(active)); }} /> : active ? <article className={styles.definition} key={active.id}>
            {trail.length > 0 && <nav className={styles.readingTrail} aria-label="이어 읽은 단어">{trail.map((item, index) => <span key={`${item.id}:${index}`}><button type="button" onClick={() => { pick(item.id); setTrail(trail.slice(0, index)); }}>{item.title}</button><ChevronRight size={12} aria-hidden="true" /></span>)}<span>{active.title.split(' · ')[0]}</span></nav>}
            <div className={styles.termHeader}><div><h3>{active.title.split(' · ')[0]}</h3></div>{definition && <SaveTermButton termId={definition.id} compact notebook />}</div>
            {definition ? <>
              <p className={styles.lead}><FinancialText current={definition.id} onOpen={termId => pick(`term:${termId}`, true)}>{sentences[0] ?? definition.meaning}</FinancialText></p>
              <DictionaryConceptStage key={definition.id} term={definition} onSelect={termId => pick(`term:${termId}`, true)} />
              <div className={styles.explanation}>{sentences.slice(1).map((sentence, index) => <p key={index} className={styles.meaning}><FinancialText current={definition.id} onOpen={termId => pick(`term:${termId}`, true)}>{sentence}</FinancialText></p>)}</div>
              {definition.example && <section className={styles.example} aria-label="이해를 돕는 예시"><h4>예시</h4><p>{definition.example}</p></section>}
              <DictionaryStory termId={definition.id} />
              {related.length > 0 && <section className={styles.related}><h4>함께 알아두면 좋아요</h4><div>{related.map(term => <button type="button" key={term.id} onClick={() => pick(`term:${term.id}`, true)}>{term.title.split(' · ')[0]}<ChevronRight size={14} aria-hidden="true" /></button>)}</div></section>}
              <a className={styles.source} href={definition.source} target="_blank" rel="noopener noreferrer">설명의 출처<ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (새 창)</span></a>
            </> : <p className={styles.meaning}>직접 적은 단어예요. 확인된 뜻이 없어 퀴즈에는 나오지 않아요.</p>}
            {saved && <details className={styles.savedTools}><summary className={readingUI.disclosure}>내 메모와 복습{saved.note ? ' · 메모 있음' : ''}</summary><EntryTools key={saved.id} entry={saved} /></details>}
          </article> : <div className={styles.readerEmpty}><h3>다시 보고 싶은 말을<br />모아두는 곳.</h3><p>단어의 뜻을 읽고 저장하면<br />내 메모와 함께 다시 볼 수 있어요.</p><button type="button" className={theme.primary} onClick={() => chooseFilter('find')}>용어 둘러보기</button></div>}
        </div>
        {!review && active && activeIndex >= 0 && <nav className={styles.entryNavigation} aria-label="단어 이동"><button type="button" disabled={activeIndex <= 0} onClick={() => pick(list[activeIndex - 1].id)}><ChevronLeft size={17} aria-hidden="true" />이전 단어</button><span>{activeIndex + 1} / {list.length}</span><button type="button" disabled={activeIndex >= list.length - 1} onClick={() => pick(list[activeIndex + 1].id)}>다음 단어<ChevronRight size={17} aria-hidden="true" /></button></nav>}
      </div>
    </div>
    <footer className={styles.footer}><details className={styles.storage}><summary className={readingUI.disclosure}>{owner === 'guest' ? '이 브라우저에 저장돼요' : '내 계정에 저장돼요'}</summary><p>{owner === 'guest' ? '다른 기기에서는 보이지 않아요. 로그인해도 기존 단어가 자동으로 옮겨지지는 않아요.' : '다른 기기에서도 같은 계정으로 로그인하면 볼 수 있어요.'} 최대 {DICTIONARY_LIMIT}개까지 저장할 수 있어요.</p></details>{!review && ready && reviewCount > 0 && <button type="button" className={styles.reviewButton} onClick={() => { setReview(buildDictionaryReview(entries)); setReading(true); if (reader.current) reader.current.scrollTop = 0; }}>{reviewCount}문제 퀴즈 풀기<ChevronRight size={16} aria-hidden="true" /></button>}</footer>
  </section>;
}
