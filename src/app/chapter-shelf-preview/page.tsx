import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChapterShelf from '@/components/portfolio/ChapterShelf';
import type { ArchivedChapter } from '@/utils/chapterArchive';
import styles from '../portfolio-map-preview/preview.module.css';

const chapter: ArchivedChapter = { chapterId: '2026-08', monthLabel: '8월', keyword: null, totalPctReturn: 6, totalAbsReturn: 600000, valuationCurrency: 'KRW', championSymbol: 'TSLL', championPctReturn: 8.3, notesCount: 0, memoStreak: 0, bestDayDate: null, bestDayPctChange: null, archivedAt: '2026-09-01' };
const many: ArchivedChapter[] = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 7 - index, 1));
  const chapterId = date.toISOString().slice(0, 7);
  return { ...chapter, chapterId, monthLabel: `${date.getUTCMonth() + 1}월`, keyword: index === 0 ? '흔들려도 기준을 지킨 달' : index === 1 ? '매수 전, 한 번 더 생각하기' : null, totalPctReturn: [6, -3.8, 1.4, 0, -8.2, 12.6][index % 6], championSymbol: index % 2 ? '005930' : 'TSLL', championPctReturn: index % 2 ? -1.2 : 8.3, notesCount: 12 - index, memoStreak: 8 - index % 8, bestDayDate: `${chapterId}-12`, bestDayPctChange: 2.4 };
});
const cases: Record<string, { label: string; chapters: ArchivedChapter[] }> = {
  single: { label: '1권 · 메모 없음', chapters: [chapter] },
  many: { label: '12권 · 여러 해', chapters: many },
  empty: { label: '아직 기록 없음', chapters: [] },
  long: { label: '긴 제목 · 큰 숫자', chapters: [{ ...chapter, keyword: '오르내리는 시장에서도 내가 정한 투자 기준을 지키기 위해 남긴 한 달의 기록', totalPctReturn: 1234.5, notesCount: 1234, memoStreak: 31 }] },
  unknown: { label: '일부 자료 없음', chapters: [{ ...chapter, chapterId: 'unknown', totalPctReturn: Number.NaN, championSymbol: null, championPctReturn: null }] },
};

export default async function ChapterShelfPreview({ searchParams }: { searchParams: Promise<{ case?: string; view?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const query = await searchParams;
  const key = query.case && Object.hasOwn(cases, query.case) ? query.case : 'single';
  return <main className={styles.preview}>
    <header className={styles.controls}><p>챕터 책장 개선안<span>예시 데이터 · 운영 미반영</span></p><details><summary>다른 기록 보기</summary><nav>{Object.entries(cases).map(([id, item]) => <Link key={id} href={`/chapter-shelf-preview?case=${id}${query.view === 'mobile' ? '&view=mobile' : ''}`} aria-current={id === key ? 'page' : undefined}>{item.label}</Link>)}<Link href={`/chapter-shelf-preview?case=${key}${query.view === 'mobile' ? '' : '&view=mobile'}`}>{query.view === 'mobile' ? 'PC 폭' : '모바일 폭'}</Link></nav></details></header>
    <div className={styles.canvas} data-mobile={query.view === 'mobile'}><ChapterShelf chapters={cases[key].chapters} /></div>
  </main>;
}
