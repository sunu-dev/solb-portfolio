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
 * 최근 N일 이내 스냅샷만 유지 + 같은 날짜 중복 제거
 * 정합성 결함 C3 수정: 두 탭 동시 마운트/KST 자정 경계에서 같은 date 2회 push 방지.
 * 같은 날짜 중복 시 totalValue가 큰 것을 우선(시세 더 많이 로드된 시점).
 */
export function prune(snapshots: DailySnapshot[], maxDays = 365): DailySnapshot[] {
  if (snapshots.length === 0) return snapshots;
  const cutoffDate = getDateDaysAgo(maxDays);

  // 같은 date dedup — Map으로 마지막 또는 totalValue 큰 것 보존
  const byDate = new Map<string, DailySnapshot>();
  for (const s of snapshots) {
    if (s.date < cutoffDate) continue;
    const existing = byDate.get(s.date);
    if (!existing || s.totalValue > existing.totalValue) {
      byDate.set(s.date, s);
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
