/**
 * 일일 포트폴리오 스냅샷
 * - 매일 앱 최초 진입 시 자동 기록
 * - localStorage에 저장 (Zustand persist 통해)
 * - 최대 365일 보관 → 실제 "과거의 나" 비교 기반
 */

export interface StockSnapshot {
  symbol: string;
  avgCost: number;
  shares: number;
  currentPrice: number;
  purchaseRate?: number;
}

export interface DailySnapshot {
  date: string; // YYYY-MM-DD (KST 기준)
  totalValue: number;
  totalCost: number;
  stocks: StockSnapshot[];
}

/** KST 기준 YYYY-MM-DD */
export function getTodayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/** 오늘 기준 N일 전 날짜 */
export function getDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400 * 1000 + 9 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
}

/**
 * 스냅샷 배열에서 가장 가까운 과거 날짜 찾기
 * 정확한 날짜 매칭 실패 시 ±3일 내 가장 가까운 것 반환
 */
export function findSnapshotNearDate(
  snapshots: DailySnapshot[],
  targetDate: string,
  toleranceDays = 3,
): DailySnapshot | null {
  if (snapshots.length === 0) return null;
  const exact = snapshots.find(s => s.date === targetDate);
  if (exact) return exact;

  // 가장 가까운 과거 스냅샷
  const targetTs = new Date(targetDate).getTime();
  const toleranceMs = toleranceDays * 86400 * 1000;
  let bestMatch: DailySnapshot | null = null;
  let bestDiff = Infinity;

  for (const s of snapshots) {
    const diff = Math.abs(new Date(s.date).getTime() - targetTs);
    if (diff <= toleranceMs && diff < bestDiff) {
      bestDiff = diff;
      bestMatch = s;
    }
  }
  return bestMatch;
}

/**
 * 새 스냅샷이 필요한지 판단 (오늘 이미 찍었으면 스킵)
 */
export function needsNewSnapshot(snapshots: DailySnapshot[]): boolean {
  const today = getTodayKST();
  return !snapshots.some(s => s.date === today);
}

/**
 * 최근 N일 이내 스냅샷만 유지 (용량 관리)
 */
export function prune(snapshots: DailySnapshot[], maxDays = 365): DailySnapshot[] {
  if (snapshots.length === 0) return snapshots;
  const cutoffDate = getDateDaysAgo(maxDays);
  return snapshots
    .filter(s => s.date >= cutoffDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}
