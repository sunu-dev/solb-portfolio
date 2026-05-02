/**
 * Monthly Chapter — 30일 시즌으로 작동하는 투자 일지 척추.
 *
 * 핵심 철학 (전문가 회의 결과):
 *   "데이터는 같아도, 프레임/진행률/Streak를 매일 달리하면 뇌는 새 자극으로 처리한다."
 *
 * 매일 신선도 엔진 (P1~P4 우선순위):
 *   P1 — 희소·강력: 임계 돌파, 신고가, 최고/최악의 하루
 *   P2 — 행동 기반: streak 갱신, 거래 카운트
 *   P3 — 패턴 인식: 평균 대비 분위, 이번 달 평균 비교
 *   P4 — Fallback: 컨텍스트 리프레이밍 (30일 전 오늘 vs 지금) — 항상 존재
 */

import type { PortfolioStocks, QuoteData, CandleRaw, StockNote } from '@/config/constants';
import type { DailySnapshot } from '@/utils/dailySnapshot';

// ─── Phase 결정 (D-카운트다운 라벨) ────────────────────────────────────────
//
// 이전 구현은 새 달 1~5일을 "이전 달 recap phase"로 보여줬음.
// → "5월 시작했는데 4월 챕터가 살아있다"는 UX 혼란.
// 변경: 새 달 1일부터 즉시 새 챕터. 지난달 회고는 ChapterShelf에서 접근.
// type은 backward compat 위해 유지하지만 'recap' 값은 더 이상 생성 안 됨.
export type ChapterPhase = 'progress' | 'closing' | 'recap';

export interface ChapterTime {
  /** 1~31. 오늘이 이번 달 며칠째 */
  dayOfMonth: number;
  /** 이번 달 말일 (일수) */
  lastDay: number;
  /** D-N (남은 일) */
  daysRemaining: number;
  /** 진행률 0~1 */
  progress: number;
  /** 1~25일 progress / 26~말일 closing */
  phase: ChapterPhase;
  /** "5월" 같은 현재 달 라벨 */
  monthLabel: string;
  /** 챕터 ID (YYYY-MM, 항상 현재 달) */
  chapterId: string;
  /** 새 달 첫 7일이면 true — "지난달 회고 보기" CTA 노출 트리거 */
  isFreshMonth: boolean;
  /** 지난달 chapterId — isFreshMonth일 때 ChapterShelf 진입점으로 사용 */
  previousChapterId: string;
}

export function computeChapterTime(now: Date = new Date()): ChapterTime {
  const dayOfMonth = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const isLastWeek = dayOfMonth >= lastDay - 4;

  const phase: ChapterPhase = isLastWeek ? 'closing' : 'progress';

  const monthLabel = now.toLocaleDateString('ko-KR', { month: 'long' });
  const chapterId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 지난달 chapterId — 새 달 첫 7일 동안 회고 진입점으로 노출
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousChapterId = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

  return {
    dayOfMonth,
    lastDay,
    daysRemaining: lastDay - dayOfMonth,
    progress: dayOfMonth / lastDay,
    phase,
    monthLabel,
    chapterId,
    isFreshMonth: dayOfMonth <= 7,
    previousChapterId,
  };
}

// ─── 챕터 통계 ─────────────────────────────────────────────────────────────
export interface ChapterStats {
  totalAbsReturn: number;       // 누적 손익 (USD)
  totalPctReturn: number;        // 누적 수익률 %
  prevTotalAbsReturn: number | null;  // 어제까지의 누적 (델타 비교용)
  prevTotalPctReturn: number | null;
  /** 이번 달 챔피언 종목 (수익률 1위) */
  champion: { symbol: string; pctReturn: number; absReturn: number } | null;
  /** 이번 달 베스트 데이 */
  bestDay: { date: string; absChange: number; pctChange: number } | null;
  /** 이번 달 작성된 메모 수 */
  notesThisMonth: number;
  /** 메모 streak (연속 작성 일수) */
  memoStreak: number;
  /** 데이터 커버리지 0~1 */
  coverage: number;
}

interface BuildStatsInput {
  stocks: PortfolioStocks;
  macroData: Record<string, QuoteData | unknown>;
  rawCandles: Record<string, CandleRaw>;
  snapshots: DailySnapshot[];
  now?: Date;
}

export function buildChapterStats(input: BuildStatsInput): ChapterStats | null {
  const { stocks, macroData, rawCandles, snapshots, now = new Date() } = input;
  const investing = (stocks.investing || []).filter(s => s.shares > 0 && s.avgCost > 0);
  if (investing.length === 0) return null;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  // 1. 종목별 30일(또는 이번 달) 수익률 — 챔피언 산출
  type Perf = { symbol: string; pctReturn: number; absReturn: number };
  const perfs: Perf[] = [];
  let totalAbsReturn = 0;
  let dataCoverage = 0;
  for (const s of investing) {
    const q = macroData[s.symbol] as QuoteData | undefined;
    const candles = rawCandles[s.symbol];
    if (!q?.c || !candles?.c?.length || !candles?.t?.length) continue;
    // 이번 달 시작 시점 가격 찾기
    const targetTs = monthStart.getTime() / 1000;
    let monthStartPrice: number | null = null;
    for (let i = candles.t.length - 1; i >= 0; i--) {
      if (candles.t[i] <= targetTs) {
        monthStartPrice = candles.c[i];
        break;
      }
    }
    if (!monthStartPrice || monthStartPrice <= 0) continue;
    const pctReturn = ((q.c - monthStartPrice) / monthStartPrice) * 100;
    const absReturn = (q.c - monthStartPrice) * s.shares;
    perfs.push({ symbol: s.symbol, pctReturn, absReturn });
    totalAbsReturn += absReturn;
    dataCoverage++;
  }
  const coverage = dataCoverage / investing.length;
  if (coverage < 0.4) return null;

  const totalCost = investing.reduce((sum, s) => sum + s.avgCost * s.shares, 0);
  const totalPctReturn = totalCost > 0 ? (totalAbsReturn / totalCost) * 100 : 0;

  // 2. 챔피언 — 수익률 1위
  const sortedByPct = [...perfs].sort((a, b) => b.pctReturn - a.pctReturn);
  const champion = sortedByPct[0] || null;

  // 3. 베스트 데이 — 일별 누적 변화
  let bestDay: { date: string; absChange: number; pctChange: number } | null = null;
  if (snapshots.length >= 2) {
    const monthSnaps = snapshots
      .filter(s => new Date(s.date).getTime() >= monthStart.getTime())
      .sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < monthSnaps.length; i++) {
      const prev = monthSnaps[i - 1].totalValue;
      const curr = monthSnaps[i].totalValue;
      if (prev > 0) {
        const change = curr - prev;
        const pctChange = (change / prev) * 100;
        if (!bestDay || change > bestDay.absChange) {
          bestDay = { date: monthSnaps[i].date, absChange: change, pctChange };
        }
      }
    }
  }

  // 4. 어제까지의 누적 (델타 카피용)
  let prevTotalAbsReturn: number | null = null;
  let prevTotalPctReturn: number | null = null;
  if (snapshots.length > 0) {
    const ydate = new Date(now.getTime() - 86400 * 1000);
    const ydateStr = ydate.toISOString().split('T')[0];
    const ySnap = snapshots.find(s => s.date === ydateStr || s.date.startsWith(ydateStr.slice(0, 8)));
    if (ySnap && ySnap.totalCost > 0) {
      prevTotalAbsReturn = ySnap.totalValue - ySnap.totalCost;
      prevTotalPctReturn = (prevTotalAbsReturn / ySnap.totalCost) * 100;
    }
  }

  // 5. 이번 달 메모 + Streak
  let notesThisMonth = 0;
  const allNoteDates = new Set<string>();
  const allStocks = [...(stocks.investing || []), ...(stocks.watching || []), ...(stocks.sold || [])];
  for (const stock of allStocks) {
    for (const note of (stock.notes || []) as StockNote[]) {
      const isoPart = note.date.split('_')[0];
      const noteDate = new Date(isoPart);
      if (isNaN(noteDate.getTime())) continue;
      const dateKey = noteDate.toISOString().split('T')[0];
      if (noteDate.getTime() >= monthStart.getTime()) notesThisMonth++;
      allNoteDates.add(dateKey);
    }
  }

  // Memo streak — 오늘부터 거꾸로 메모 작성된 연속 일수
  let memoStreak = 0;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 86400 * 1000);
    const key = d.toISOString().split('T')[0];
    if (allNoteDates.has(key)) memoStreak++;
    else if (i > 0) break; // 오늘 메모 없어도 OK, 어제부터 끊기면 종료
  }

  return {
    totalAbsReturn,
    totalPctReturn,
    prevTotalAbsReturn,
    prevTotalPctReturn,
    champion,
    bestDay,
    notesThisMonth,
    memoStreak,
    coverage,
  };
}

// ─── 오늘의 한 줄 (P1~P4 신선도 엔진) ─────────────────────────────────────
export interface TodayLine {
  text: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  emoji?: string;
}

interface TodayLineInput {
  time: ChapterTime;
  stats: ChapterStats;
  snapshots: DailySnapshot[];
}

/**
 * 매일 다른 카피 1개 생성. P1→P4 순으로 발견 즉시 반환.
 * 같은 데이터라도 매일 다른 프레임으로 보여줌.
 */
export function buildTodayLine(input: TodayLineInput): TodayLine {
  const { time, stats, snapshots } = input;
  const { totalPctReturn, prevTotalPctReturn, champion, bestDay, memoStreak, totalAbsReturn } = stats;

  // ── P1: 희소·강력 ──────────────────────────────────────────────────────
  // P1.1 — 누적 손익 임계 돌파
  if (prevTotalPctReturn !== null) {
    const thresholds = [10, 5, 3, 1, -1, -3, -5, -10];
    for (const t of thresholds) {
      if (t > 0 && prevTotalPctReturn < t && totalPctReturn >= t) {
        return {
          text: `이번 달 첫 +${t}% 돌파`,
          priority: 'P1',
          emoji: '🎉',
        };
      }
      if (t < 0 && prevTotalPctReturn > t && totalPctReturn <= t) {
        return {
          text: `이번 달 ${t}% 도달 — 점검 신호`,
          priority: 'P1',
          emoji: '⚠️',
        };
      }
    }
  }

  // P1.2 — 챔피언 변경 (구현 단순화: 챔피언이 이번 달 5%+면 강조)
  if (champion && champion.pctReturn >= 5) {
    return {
      text: `${champion.symbol} 이번 달 +${champion.pctReturn.toFixed(1)}% — 챕터 챔피언`,
      priority: 'P1',
      emoji: '🏆',
    };
  }

  // P1.3 — 베스트 데이 (오늘이거나 최근)
  if (bestDay) {
    const bestDate = new Date(bestDay.date);
    const daysAgo = Math.floor((Date.now() - bestDate.getTime()) / 86400000);
    if (daysAgo === 0) {
      return {
        text: `오늘이 이번 달 최고의 하루 (+${bestDay.pctChange.toFixed(2)}%)`,
        priority: 'P1',
        emoji: '🌟',
      };
    }
    if (daysAgo <= 3) {
      return {
        text: `${daysAgo}일 전이 이번 달 최고의 하루 (+${bestDay.pctChange.toFixed(2)}%)`,
        priority: 'P1',
        emoji: '✨',
      };
    }
  }

  // ── P2: 행동 기반 ──────────────────────────────────────────────────────
  // P2.1 — 메모 streak
  if (memoStreak >= 3) {
    return {
      text: `${memoStreak}일째 메모 — streak 갱신 중`,
      priority: 'P2',
      emoji: '🔥',
    };
  }

  // ── P3: 패턴 인식 ──────────────────────────────────────────────────────
  // P3.1 — 50% 진행 마일스톤
  if (Math.abs(time.progress - 0.5) < 0.04) {
    const sign = totalPctReturn >= 0 ? '+' : '';
    return {
      text: `절반 통과 — 누적 ${sign}${totalPctReturn.toFixed(2)}%, 남은 15일`,
      priority: 'P3',
      emoji: '📍',
    };
  }

  // P3.2 — 마지막 일주일
  if (time.daysRemaining <= 7 && time.daysRemaining > 0) {
    return {
      text: `마지막 일주일 — D-${time.daysRemaining}`,
      priority: 'P3',
      emoji: '⏳',
    };
  }

  // P3.3 — 어제 대비 델타 강조
  if (prevTotalPctReturn !== null && Math.abs(totalPctReturn - prevTotalPctReturn) >= 0.3) {
    const delta = totalPctReturn - prevTotalPctReturn;
    const sign = delta >= 0 ? '+' : '';
    return {
      text: `어제 대비 ${sign}${delta.toFixed(2)}%p — 오늘 누적 ${totalPctReturn >= 0 ? '+' : ''}${totalPctReturn.toFixed(2)}%`,
      priority: 'P3',
      emoji: '📈',
    };
  }

  // ── P4: Fallback (항상 존재) ───────────────────────────────────────────
  // P4.1 — 30일 전 오늘 비교
  if (snapshots.length > 0) {
    const ts30 = Date.now() - 30 * 86400 * 1000;
    const date30 = new Date(ts30).toISOString().split('T')[0];
    const snap30 = snapshots.find(s => Math.abs(new Date(s.date).getTime() - ts30) < 2 * 86400 * 1000);
    if (snap30 && snap30.totalCost > 0) {
      const ret30 = ((snap30.totalValue - snap30.totalCost) / snap30.totalCost) * 100;
      const sign30 = ret30 >= 0 ? '+' : '';
      const signNow = totalPctReturn >= 0 ? '+' : '';
      void date30;
      return {
        text: `30일 전 ${sign30}${ret30.toFixed(1)}% → 지금 ${signNow}${totalPctReturn.toFixed(1)}%`,
        priority: 'P4',
        emoji: '📅',
      };
    }
  }

  // P4.2 — 진행 + 누적
  void totalAbsReturn;
  const dayLabel = `${time.monthLabel} ${time.dayOfMonth}일째`;
  const signNow = totalPctReturn >= 0 ? '+' : '';
  return {
    text: `${dayLabel} — 누적 ${signNow}${totalPctReturn.toFixed(2)}%`,
    priority: 'P4',
    emoji: '📖',
  };
}
