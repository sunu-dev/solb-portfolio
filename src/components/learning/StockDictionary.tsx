'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, Check, ChevronRight, Plus, Search, X } from 'lucide-react';
import { financialTerm, FINANCIAL_TERMS } from '@/lib/financialTerms';
import { buildDictionaryReview, dictionaryReviewEntries, DICTIONARY_LIMIT, type DictionaryEntry, type ReviewQuestion } from '@/lib/personalDictionary';
import FinancialText from '@/components/common/FinancialText';
import readingUI from '@/components/ui/ReadingUI.module.css';
import { usePersonalDictionary } from './PersonalLearningProvider';
import JoobiAvatar from './JoobiAvatar';
import SaveTermButton from './SaveTermButton';
import DictionaryReview from './DictionaryReview';
import styles from './StockDictionary.module.css';
import theme from './DictionaryTheme.module.css';

type Filter = 'saved' | 'find' | 'confused';
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

/** A notebook: the list chooses a maintained definition; storage remains account scoped. */
export default function StockDictionary({ initialTermId, titleId, onClose }: { initialTermId?: string; titleId: string; onClose: () => void }) {
  const { owner, entries, ready, error, reload, save } = usePersonalDictionary();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('saved');
  const [hideFamiliar, setHideFamiliar] = useState(true);
  const [selected, setSelected] = useState(initialTermId ? `term:${initialTermId}` : '');
  const [reading, setReading] = useState(Boolean(initialTermId));
  const [review, setReview] = useState<ReviewQuestion[] | null>(null);
  const [word, setWord] = useState(''), [message, setMessage] = useState(''), [saving, setSaving] = useState(false);
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const reader = useRef<HTMLElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef<HTMLDivElement>(null);
  const scrollContent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const view = scroll.current, frame = scrollFrame.current, content = scrollContent.current;
    if (!view || !frame || !content) return;
    let animation = 0;
    const update = () => {
      cancelAnimationFrame(animation);
      animation = requestAnimationFrame(() => {
        const range = view.scrollHeight - view.clientHeight;
        const thumb = Math.max(28, view.clientHeight * view.clientHeight / Math.max(1, view.scrollHeight));
        frame.dataset.overflow = String(range > 8);
        frame.dataset.above = String(view.scrollTop > 8);
        frame.dataset.below = String(range - view.scrollTop > 8);
        frame.style.setProperty('--dictionary-scroll-thumb', `${thumb}px`);
        frame.style.setProperty('--dictionary-scroll-offset', `${range > 0 ? Math.max(0, Math.min(1, view.scrollTop / range)) * Math.max(0, view.clientHeight - thumb) : 0}px`);
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(view); observer.observe(content);
    view.addEventListener('scroll', update, { passive: true }); update();
    return () => { observer.disconnect(); view.removeEventListener('scroll', update); cancelAnimationFrame(animation); };
  }, []);
  const toTop = () => requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = 0; });
  useEffect(() => {
    // The lazy-loaded notebook can arrive after showModal focused the empty dialog.
    const frame = requestAnimationFrame(() => {
      const title = heading.current;
      const dialog = title?.closest('dialog');
      if (dialog?.open && (document.activeElement === dialog || document.activeElement === dialog.querySelector('button'))) {
        title?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const normalize = (text: string) => text.toLocaleLowerCase().trim();
  const q = normalize(search);
  const known = FINANCIAL_TERMS.find(term => term.aliases.some(alias => normalize(alias) === normalize(word)) || normalize(term.title.split(' · ')[0]) === normalize(word));
  const exploring = !ready || filter === 'find' || (filter === 'saved' && entries.length === 0);
  const catalog = (filter === 'find' || q ? FINANCIAL_TERMS : starters).map(term => ({ id: `term:${term.id}`, termId: term.id, title: term.title, note: '', familiarity: 'new' as const }));
  const familiarCount = entries.filter(entry => entry.familiarity === 'familiar').length;
  const list = (exploring ? catalog : entries.filter(entry => filter === 'confused' ? entry.familiarity === 'confused' : !hideFamiliar || entry.familiarity !== 'familiar')).filter(entry => normalize(`${entry.title} ${entry.note} ${entry.termId ? financialTerm(entry.termId)?.aliases.join(' ') : ''}`).includes(q));
  const selectedSaved = entries.find(entry => entry.id === selected);
  const selectedTerm = selected.startsWith('term:') ? financialTerm(selected.slice(5)) : undefined;
  const active = selectedSaved ?? (selectedTerm ? { id: selected, title: selectedTerm.title, termId: selectedTerm.id } : undefined) ?? list[0];
  const term = active?.termId ? financialTerm(active.termId) : undefined;
  const saved = entries.find(entry => entry.id === active?.id);
  const reviewCount = Math.min(3, dictionaryReviewEntries(entries).length);
  const pick = (entryId: string) => {
    setSelected(entryId); setReading(true); toTop();
    requestAnimationFrame(() => reader.current?.focus({ preventScroll: true }));
  };
  const chooseFilter = (next: Filter) => { setFilter(next); setSearch(''); setSelected(''); setReading(false); setReview(null); toTop(); };
  return <section className={`${theme.theme} ${styles.notebook}`} data-stock-dictionary data-reading={reading || review !== null}>
    <div className={styles.rings} aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div>
    <div className={styles.paper}>
      <header className={styles.header}><div><h2 ref={heading} id={titleId} tabIndex={-1} data-dialog-initial-focus className={theme.hand}>내 주식사전</h2><p>{ready ? <>저장한 단어 <b>{entries.length}</b>개</> : error ? '저장한 단어 확인 필요' : '저장한 단어 확인 중'}</p></div><JoobiAvatar size={62} /><button type="button" className={styles.close} aria-label="내 주식사전 닫기" onClick={onClose}><X size={22} aria-hidden="true" /></button></header>
      <nav className={styles.tabs} aria-label="사전 분류">{(['saved', 'find', 'confused'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value && !review} onClick={() => chooseFilter(value)}>{value === 'saved' ? '내 단어' : value === 'find' ? '단어 찾기' : '헷갈려요'}</button>)}</nav>
      <div ref={scrollFrame} className={styles.scrollFrame}>
      <div ref={scroll} className={styles.scroll} tabIndex={0} role="region" aria-label="사전 내용"><div ref={scrollContent}>
        {error && <div role="alert" className={styles.connectionNotice}><p>{error}</p><button type="button" className={theme.button} onClick={reload}>다시 불러오기</button></div>}
        {!ready && !error && <p className={styles.loading} role="status">저장한 단어를 확인하고 있어요. 기본 용어부터 읽을 수 있어요.</p>}
        <>
          {review ? <DictionaryReview questions={review} onClose={() => { setReview(null); setReading(false); }} /> : <div className={styles.columns}>
            <section className={styles.index} aria-label="단어 목록">
              <label className={styles.search}><Search size={18} aria-hidden="true" /><span className="sr-only">사전에서 찾기</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={exploring ? '궁금한 단어 찾기' : '단어나 내 메모 찾기'} /></label>
              {exploring && ready && entries.length === 0 && <p className={styles.emptyHint}>저장한 단어가 없어요.<br />아래에서 뜻을 읽고 저장할 수 있어요.</p>}
              {filter === 'saved' && ready && familiarCount > 0 && <label className={styles.knownToggle}><input type="checkbox" checked={hideFamiliar} onChange={event => { setHideFamiliar(event.target.checked); setSelected(''); setReading(false); }} /><span>이해한 단어 숨기기 <small>{familiarCount}개</small></span></label>}
              <div className={styles.wordList} tabIndex={0} aria-label="단어 목록 스크롤">
                {list.map(entry => <button type="button" className={styles.word} key={entry.id} aria-pressed={active?.id === entry.id} onClick={() => pick(entry.id)}><span><strong>{entry.title.split(' · ')[0]}</strong><small>{entry.title.split(' · ').slice(1).join(' · ') || (entry.termId ? '뜻 보기' : '직접 적은 단어')}</small></span>{entries.some(saved => saved.id === entry.id) ? <Bookmark size={16} aria-label="저장됨" /> : <ChevronRight size={16} aria-hidden="true" />}</button>)}
                {list.length === 0 && <div className={styles.emptyHint}>
                  <p>{q ? '찾는 단어가 없어요. 다른 말로 찾아보세요.' : filter === 'saved' && hideFamiliar && familiarCount > 0 ? '저장한 단어를 모두 이해했어요.' : '헷갈린다고 표시한 단어가 없어요.'}</p>
                  {filter === 'saved' && hideFamiliar && familiarCount > 0 && <button type="button" className={theme.linkButton} onClick={() => { setHideFamiliar(false); setSearch(''); setSelected(''); }}>이해한 단어 보기</button>}
                </div>}
              </div>
              {exploring && filter !== 'find' && !q && <button type="button" className={styles.catalogLink} onClick={() => chooseFilter('find')}>전체 {FINANCIAL_TERMS.length}개 단어 보기<ChevronRight size={17} aria-hidden="true" /></button>}
              {filter === 'find' && <p className={styles.catalogCount} aria-live="polite">{q ? `검색 결과 ${list.length}개` : `뜻과 출처가 있는 단어 ${FINANCIAL_TERMS.length}개`}</p>}
              <details className={styles.add}><summary data-ui-disclosure="composite"><Plus size={16} aria-hidden="true" />단어 직접 추가</summary><form onSubmit={async event => {
                event.preventDefault(); if (!ready || !word.trim() || saving) return;
                const entry: DictionaryEntry = { id: known ? `term:${known.id}` : `custom:${crypto.randomUUID()}`, ...(known ? { termId: known.id } : {}), title: known?.title ?? word.trim(), note: '', savedAt: new Date().toISOString(), familiarity: 'new' };
                if (entries.some(item => item.id === entry.id || item.title === entry.title)) { setMessage('이미 저장한 단어예요.'); return; }
                setSaving(true); const ok = await save(entry); setSaving(false);
                if (ok) { setWord(''); setMessage('사전에 저장했어요.'); setSelected(entry.id); } else setMessage('저장하지 못했어요. 다시 시도해 주세요.');
              }}><label htmlFor={`${id}-new`}>추가할 단어</label><input id={`${id}-new`} maxLength={100} value={word} onChange={e => setWord(e.target.value)} placeholder="예: ETF, 거래량" /><button className={theme.button} disabled={!ready || !word.trim() || saving} type="submit">{saving ? '저장 중' : '저장'}</button>{known && <p className={theme.muted}>뜻과 출처도 함께 저장해요.</p>}</form>{message && <p role="status" className={theme.message}>{message}</p>}</details>
            </section>
            <section className={styles.reader} ref={reader} tabIndex={-1} aria-label="선택한 단어 뜻">
              <button type="button" className={`${theme.linkButton} ${styles.backToList}`} onClick={() => { setReading(false); toTop(); }}><ArrowLeft size={17} aria-hidden="true" />목록으로</button>
              {active ? <><article className={styles.note}><i className={styles.tape} aria-hidden="true" /><h3 className={theme.hand}>{active.title.split(' · ')[0]}</h3>{term ? <><p className={styles.meaning}><FinancialText current={term.id}>{term.meaning}</FinancialText></p>{term.example && <details className={styles.example}><summary className={readingUI.disclosure}>예시로 보기</summary><p>{term.example}</p></details>}<SaveTermButton key={term.id} termId={term.id} compact notebook /><a className={styles.source} href={term.source} target="_blank" rel="noopener noreferrer">설명의 출처<span className="sr-only"> (새 창)</span></a></> : <p className={styles.meaning}>직접 적은 단어예요. 확인된 뜻이 없어 퀴즈에는 나오지 않아요.</p>}</article>{saved && <EntryTools key={saved.id} entry={saved} />}</> : <p className={styles.emptyHint}>{filter === 'saved' && hideFamiliar && familiarCount > 0 && list.length === 0 ? '단어와 메모는 그대로 보관하고 있어요. 다시 보고 싶으면 이해한 단어를 펼쳐보세요.' : '목록에서 단어를 선택하면 뜻을 볼 수 있어요.'}</p>}
            </section>
          </div>}
        </>
        </div></div>
        <div className={styles.scrollRail} aria-hidden="true"><span /></div>
        </div>
        <footer className={styles.footer}><details className={styles.storage}><summary className={readingUI.disclosure}>{owner === 'guest' ? '이 브라우저에 저장돼요' : '내 계정에 저장돼요'}</summary><p>{owner === 'guest' ? '다른 기기에서는 보이지 않아요. 로그인해도 기존 단어가 자동으로 옮겨지지는 않아요.' : '다른 기기에서도 같은 계정으로 로그인하면 볼 수 있어요.'} 최대 {DICTIONARY_LIMIT}개까지 저장할 수 있어요.</p></details>{!review && ready && reviewCount > 0 && <button type="button" className={theme.button} onClick={() => { setReview(buildDictionaryReview(entries)); toTop(); }}>{reviewCount}문제 퀴즈 풀기</button>}</footer>
    </div>
  </section>;
}
