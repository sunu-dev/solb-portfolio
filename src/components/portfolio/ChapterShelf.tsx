'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { loadChapters, subscribeChapters, type ArchivedChapter } from '@/utils/chapterArchive';
import { STOCK_KR } from '@/config/constants';
import { getYahooSymbolCandidates } from '@/utils/stockCurrency';
import styles from './ChapterShelf.module.css';

const pct = (value: number | null) => value === null || !Number.isFinite(value) ? '기록 없음' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
const tone = (value: number | null) => value === null || !Number.isFinite(value) ? 'unknown' : value > 0 ? 'gain' : value < 0 ? 'loss' : 'flat';
const count = (value: number) => Number.isFinite(value) && value >= 0 ? Math.floor(value).toLocaleString('ko-KR') : '—';
function month(id: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(id);
  return match ? { year: match[1], number: match[2], label: `${match[1]}년 ${Number(match[2])}월` } : { year: '기록', number: '—', label: '날짜 미확인' };
}

export default function ChapterShelf({ chapters: supplied, onSelect }: { chapters?: ArchivedChapter[]; onSelect?: (chapterId: string) => void } = {}) {
  const [saved, setSaved] = useState<ArchivedChapter[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState({ back: false, forward: false });
  const readerId = useId();
  const updateScroll = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    const back = el.scrollLeft > 1;
    const forward = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setScrollable(previous => previous.back === back && previous.forward === forward ? previous : { back, forward });
  }, []);
  useEffect(() => {
    if (supplied !== undefined) return;
    const refresh = () => setSaved(loadChapters());
    const unsubscribe = subscribeChapters(refresh);
    const frame = requestAnimationFrame(refresh);
    return () => { cancelAnimationFrame(frame); unsubscribe(); };
  }, [supplied]);
  const chapters = supplied ?? saved;
  const sorted = chapters ? [...chapters].filter(ch => ch && typeof ch.chapterId === 'string').sort((a, b) => b.chapterId.localeCompare(a.chapterId)) : [];
  useEffect(() => {
    if (!rail.current) return;
    const observer = new ResizeObserver(updateScroll);
    observer.observe(rail.current);
    return () => observer.disconnect();
  }, [sorted.length, updateScroll]);
  const selected = sorted.find(ch => ch.chapterId === selectedId) ?? sorted[0];
  const date = selected ? month(selected.chapterId) : null;
  const champion = selected?.championSymbol;
  const championName = champion ? getYahooSymbolCandidates(champion).map(symbol => STOCK_KR[symbol]).find(Boolean) ?? champion : null;
  const select = (chapter: ArchivedChapter) => { setSelectedId(chapter.chapterId); onSelect?.(chapter.chapterId); };
  const scroll = (direction: number) => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * .8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });

  return <section className={styles.panel} aria-label="챕터 책장">
    <header className={styles.header}>
      <div><h2>챕터 책장 <span>{sorted.length}권</span></h2><p>한 달의 투자 결과를 한 권씩 모아요.</p></div>
      <BookOpen size={20} aria-hidden="true" />
    </header>
    {!chapters ? <p role="status" className={styles.empty}>기록을 불러오고 있어요.</p> : !selected || !date ? <div className={styles.empty}>
      <BookOpen size={30} strokeWidth={1.3} aria-hidden="true" /><div><h3>첫 번째 책이 만들어질 거예요</h3><p>지난달의 보유 종목과 가격 자료가 준비되면<br />한 달의 기록이 여기에 쌓여요.</p></div>
    </div> : <>
      <div className={styles.reader} id={readerId}>
        <div className={styles.coverStage} aria-hidden="true">
          <div className={styles.cover} data-tone={tone(selected.totalPctReturn)}>
            <span className={styles.coverYear}>{date.year}</span>
            <span className={styles.coverMonth}>{date.number}<small>월</small></span>
            <span className={styles.coverTitle}>나의 투자 기록</span>
            <span className={styles.coverBrand}>joobi</span>
          </div>
        </div>
        <div className={styles.record} aria-live="polite" aria-atomic="true">
          <span className={styles.date}>{date.label}</span>
          <h3>{selected.keyword?.trim() || '한 달의 기록'}</h3>
          <dl className={styles.metrics}>
            <div className={styles.returnMetric}><dt>기록된 수익률</dt><dd data-tone={tone(selected.totalPctReturn)}>{pct(selected.totalPctReturn)}</dd></div>
            <div><dt>남긴 메모</dt><dd>{count(selected.notesCount)}<small>개</small></dd></div>
            <div><dt>메모한 날</dt><dd>{count(selected.memoStreak)}<small>일</small></dd></div>
          </dl>
        </div>
      </div>
      {sorted.length > 1 && <div className={styles.archive}>
        <div className={styles.archiveHeading}><span>지난 기록 골라보기</span><div><button aria-label="앞쪽 기록 보기" disabled={!scrollable.back} onClick={() => scroll(-1)}><ChevronLeft size={17} /></button><button aria-label="뒤쪽 기록 보기" disabled={!scrollable.forward} onClick={() => scroll(1)}><ChevronRight size={17} /></button></div></div>
        <div ref={rail} onScroll={updateScroll} className={styles.books} role="group" aria-label="월별 투자 기록">
          {sorted.map(ch => { const period = month(ch.chapterId); return <button key={ch.chapterId} className={styles.book} aria-pressed={selected.chapterId === ch.chapterId} aria-controls={readerId} aria-label={`${period.label} 기록, 수익률 ${pct(ch.totalPctReturn)}`} onClick={() => select(ch)}>
            <span className={styles.spine} data-tone={tone(ch.totalPctReturn)} aria-hidden="true"><span>{period.year}</span><strong>{period.number}<small>월</small></strong><span>{pct(ch.totalPctReturn)}</span></span>
            <span className={styles.bookState}>{selected.chapterId === ch.chapterId ? '읽는 중' : `${Number(period.number) || '—'}월 기록`}</span>
          </button>; })}
        </div>
      </div>}
      <details className={styles.details} key={selected.chapterId}>
        <summary>이 달의 기록 자세히 보기 <ChevronDown size={16} aria-hidden="true" /></summary>
        <dl className={styles.highlights}>
          <div><dt>{(selected.championPctReturn ?? 0) < 0 ? '하락 폭이 가장 작았던 종목' : '가격 상승률이 가장 높았던 종목'}</dt><dd>{championName ?? '기록 없음'}{championName && <span data-tone={tone(selected.championPctReturn)}>{pct(selected.championPctReturn)}</span>}</dd></div>
          <div><dt>{(selected.bestDayPctChange ?? 0) < 0 ? '평가금액이 가장 적게 줄어든 날' : '평가금액 증가율이 가장 높았던 날'}</dt><dd>{selected.bestDayDate ?? '기록 없음'}{selected.bestDayDate && <span data-tone={tone(selected.bestDayPctChange)}>{pct(selected.bestDayPctChange)}</span>}</dd></div>
        </dl>
        <div className={styles.explanation}><strong>수익률은 어떻게 계산하나요?</strong><p>저장 당시 보유 수량으로 계산한 월중 가격 변동 손익을 매입금액으로 나눈 값이에요. 실제 계좌 수익률과 다를 수 있어요. 평가금액의 변화에는 입출금과 보유 수량 변화도 포함될 수 있어요.</p><p>이 책장에는 월별 요약이 저장돼요. 개별 메모 내용은 해당 종목의 기록에서 확인할 수 있어요.</p></div>
      </details>
    </>}
  </section>;
}
