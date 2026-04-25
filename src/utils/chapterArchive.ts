/**
 * Chapter Archive — 지난 달 회고 책장.
 *
 * 매월 1일 자동 아카이브: 지난달 챕터 통계가 localStorage에 저장됨.
 * 책장 화면에서 시간순으로 누적된 챕터들을 시각화.
 */

import type { PortfolioStocks, QuoteData, CandleRaw } from '@/config/constants';
import type { DailySnapshot } from '@/utils/dailySnapshot';

export interface ArchivedChapter {
  /** YYYY-MM */
  chapterId: string;
  /** "4월 챕터" */
  monthLabel: string;
  /** 사용자 입력 키워드 (있다면) */
  keyword: string | null;
  /** 누적 손익 % */
  totalPctReturn: number;
  /** 누적 손익 절대값 (USD) */
  totalAbsReturn: number;
  /** 챔피언 종목 */
  championSymbol: string | null;
  championPctReturn: number | null;
  /** 메모 작성 일수 */
  notesCount: number;
  /** 메모 streak (월말 시점) */
  memoStreak: number;
  /** 베스트 데이 (있다면) */
  bestDayDate: string | null;
  bestDayPctChange: number | null;
  /** 아카이브 시점 ISO */
  archivedAt: string;
}

const ARCHIVE_KEY = 'solb_chapter_archive';

/** 책장에서 챕터 리스트 로드 */
export function loadChapters(): ArchivedChapter[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/** 책장에 챕터 1개 추가 (chapterId 중복 시 덮어쓰기) */
export function saveChapter(chapter: ArchivedChapter): void {
  try {
    const existing = loadChapters().filter(c => c.chapterId !== chapter.chapterId);
    const next = [...existing, chapter].sort((a, b) => b.chapterId.localeCompare(a.chapterId));
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
  } catch { /* quota or storage err */ }
}

/** 자동 아카이브 — 매월 1일 첫 진입 시 호출. 지난달 챕터를 책장에 저장. */
export function autoArchiveLastMonth(input: {
  stocks: PortfolioStocks;
  macroData: Record<string, QuoteData | unknown>;
  rawCandles: Record<string, CandleRaw>;
  snapshots: DailySnapshot[];
}): ArchivedChapter | null {
  const now = new Date();
  // 지난달 1일~말일
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // 이번 달 0일 = 지난달 말일
  const chapterId = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = lastMonthStart.toLocaleDateString('ko-KR', { month: 'long' });

  // 이미 아카이브됐으면 skip
  const existing = loadChapters();
  if (existing.some(c => c.chapterId === chapterId)) return null;

  // 키워드 (Phase 5 연동)
  let keyword: string | null = null;
  try {
    keyword = localStorage.getItem(`solb_chapter_keyword_${chapterId}`);
  } catch { /* ignore */ }

  // 지난달 데이터 — 스냅샷 + 종목별 평가
  const investing = (input.stocks.investing || []).filter(s => s.shares > 0 && s.avgCost > 0);
  if (investing.length === 0) return null;

  // 지난달 시작 시점 vs 말일 가격 — 챕터 수익률
  type Perf = { symbol: string; pctReturn: number; absReturn: number };
  const perfs: Perf[] = [];
  let totalAbsReturn = 0;
  for (const s of investing) {
    const candles = input.rawCandles[s.symbol];
    if (!candles?.c?.length || !candles?.t?.length) continue;
    const startTs = lastMonthStart.getTime() / 1000;
    const endTs = lastMonthEnd.getTime() / 1000;
    let startPrice: number | null = null;
    let endPrice: number | null = null;
    for (let i = candles.t.length - 1; i >= 0; i--) {
      if (!endPrice && candles.t[i] <= endTs) endPrice = candles.c[i];
      if (candles.t[i] <= startTs) { startPrice = candles.c[i]; break; }
    }
    if (!startPrice || !endPrice || startPrice <= 0) continue;
    const pctReturn = ((endPrice - startPrice) / startPrice) * 100;
    const absReturn = (endPrice - startPrice) * s.shares;
    perfs.push({ symbol: s.symbol, pctReturn, absReturn });
    totalAbsReturn += absReturn;
  }

  if (perfs.length === 0) return null;

  const totalCost = investing.reduce((s, st) => s + st.avgCost * st.shares, 0);
  const totalPctReturn = totalCost > 0 ? (totalAbsReturn / totalCost) * 100 : 0;

  const champion = [...perfs].sort((a, b) => b.pctReturn - a.pctReturn)[0] || null;

  // 베스트 데이
  let bestDayDate: string | null = null;
  let bestDayPctChange: number | null = null;
  if (input.snapshots.length >= 2) {
    const monthSnaps = input.snapshots
      .filter(s => {
        const t = new Date(s.date).getTime();
        return t >= lastMonthStart.getTime() && t <= lastMonthEnd.getTime();
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < monthSnaps.length; i++) {
      const prev = monthSnaps[i - 1].totalValue;
      const curr = monthSnaps[i].totalValue;
      if (prev > 0) {
        const pctChange = ((curr - prev) / prev) * 100;
        if (bestDayPctChange === null || pctChange > bestDayPctChange) {
          bestDayDate = monthSnaps[i].date;
          bestDayPctChange = pctChange;
        }
      }
    }
  }

  // 메모 통계
  const allStocks = [...(input.stocks.investing || []), ...(input.stocks.watching || []), ...(input.stocks.sold || [])];
  let notesCount = 0;
  const noteDates = new Set<string>();
  for (const stock of allStocks) {
    for (const note of (stock.notes || [])) {
      const isoPart = note.date.split('_')[0];
      const t = new Date(isoPart).getTime();
      if (t >= lastMonthStart.getTime() && t <= lastMonthEnd.getTime()) {
        notesCount++;
        noteDates.add(isoPart);
      }
    }
  }
  const memoStreak = noteDates.size; // 단순화 — 작성한 unique 일수

  const archived: ArchivedChapter = {
    chapterId,
    monthLabel,
    keyword,
    totalPctReturn,
    totalAbsReturn,
    championSymbol: champion?.symbol ?? null,
    championPctReturn: champion?.pctReturn ?? null,
    notesCount,
    memoStreak,
    bestDayDate,
    bestDayPctChange,
    archivedAt: new Date().toISOString(),
  };

  saveChapter(archived);
  return archived;
}
