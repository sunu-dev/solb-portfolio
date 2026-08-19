/**
 * 일일 포트폴리오 스냅샷
 * - 매일 앱 최초 진입 시 자동 기록
 * - localStorage에 저장 (Zustand persist 통해)
 * - 최근 1년은 일별, 이후 5년까지는 주별, 그보다 오래된 기록은 월별로 보관
 */

export interface StockSnapshot {
  symbol: string;
  currency?: 'KRW' | 'USD';
  avgCost: number;
  shares: number;
  currentPrice: number;
  purchaseRate?: number;
}

export interface DailySnapshot {
  date: string; // YYYY-MM-DD (KST 기준)
  /** 같은 날짜에 여러 번 기록됐을 때 최신 상태를 고르기 위한 생성 시각 */
  capturedAt?: string;
  schemaVersion?: 1 | 2;
  valuationCurrency?: 'KRW';
  usdKrw?: number;
  totalValueKrw?: number;
  totalCostKrw?: number;
  totalValue: number;
  totalCost: number;
  stocks: StockSnapshot[];
}

export function isCanonicalKrwSnapshot(snapshot: DailySnapshot): boolean {
  return snapshot.schemaVersion === 2
    && snapshot.valuationCurrency === 'KRW'
    && Number.isFinite(snapshot.totalValueKrw)
    && Number.isFinite(snapshot.totalCostKrw);
}

export function getSnapshotKrwTotals(
  snapshot: DailySnapshot,
): { totalValueKrw: number; totalCostKrw: number } | null {
  if (!isCanonicalKrwSnapshot(snapshot)) return null;
  return {
    totalValueKrw: snapshot.totalValueKrw as number,
    totalCostKrw: snapshot.totalCostKrw as number,
  };
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
 * 스냅샷 배열에서 가장 가까운 과거 날짜 찾기.
 *
 * 정합성 결함 L2 수정: tolerance 기본값 3 → 7 (시장 휴일/연휴 보정).
 * 미국 시장 최대 연휴(추수감사절 + 주말 + 블랙프라이데이) 4일 + 한국 추석 5일대 모두 커버.
 *
 * 예: 1년 전(=오늘 기준 365일 전) 비교 시, 그 날이 토요일이고 직전 금요일도 휴일이면
 * 3일 tolerance로는 fallback 없음 → "데이터 없음"으로 잘못 판단되던 문제.
 */
export function findSnapshotNearDate(
  snapshots: DailySnapshot[],
  targetDate: string,
  toleranceDays = 7,
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
    const snapshotTs = new Date(s.date).getTime();
    const diff = targetTs - snapshotTs;
    // 비교 기준일 이후의 값은 당시에는 존재하지 않았으므로 과거 성과 기준으로 쓰지 않는다.
    if (diff < 0) continue;
    if (diff <= toleranceMs && diff < bestDiff) {
      bestDiff = diff;
      bestMatch = s;
    }
  }
  return bestMatch;
}

export function findCanonicalSnapshotNearDate(
  snapshots: DailySnapshot[],
  targetDate: string,
  toleranceDays = 7,
): DailySnapshot | null {
  return findSnapshotNearDate(
    snapshots.filter(isCanonicalKrwSnapshot),
    targetDate,
    toleranceDays,
  );
}

/**
 * 새 스냅샷이 필요한지 판단 (오늘 이미 찍었으면 스킵)
 */
export function needsNewSnapshot(snapshots: DailySnapshot[]): boolean {
  const today = getTodayKST();
  return !snapshots.some(s => s.date === today && isCanonicalKrwSnapshot(s));
}

function preferredSnapshot(
  existing: DailySnapshot | undefined,
  candidate: DailySnapshot,
): DailySnapshot {
  if (!existing) return candidate;
  const existingCanonical = isCanonicalKrwSnapshot(existing);
  const candidateCanonical = isCanonicalKrwSnapshot(candidate);
  if (existingCanonical !== candidateCanonical) {
    return candidateCanonical ? candidate : existing;
  }

  const existingCapturedAt = existing.capturedAt
    ? Date.parse(existing.capturedAt)
    : Number.NaN;
  const candidateCapturedAt = candidate.capturedAt
    ? Date.parse(candidate.capturedAt)
    : Number.NaN;
  if (Number.isFinite(existingCapturedAt) || Number.isFinite(candidateCapturedAt)) {
    if (!Number.isFinite(existingCapturedAt)) return candidate;
    if (!Number.isFinite(candidateCapturedAt)) return existing;
    return candidateCapturedAt >= existingCapturedAt ? candidate : existing;
  }

  // 구버전에는 capturedAt이 없다. 호출부가 [...기존, 신규] 순서로 넘기므로 마지막 값을 최신으로 본다.
  return candidate;
}

function dedupeSnapshots(snapshots: DailySnapshot[]): DailySnapshot[] {
  const byDate = new Map<string, DailySnapshot>();
  for (const snapshot of snapshots) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)) continue;
    byDate.set(
      snapshot.date,
      preferredSnapshot(byDate.get(snapshot.date), snapshot),
    );
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 최근 N일 이내 스냅샷만 유지 + 같은 날짜 중복 제거
 * 정합성 결함 C3 수정: 두 탭 동시 마운트/KST 자정 경계에서 같은 date 2회 push 방지.
 * 같은 날짜 중복 시 canonical KRW를 우선하고, 그 안에서는 capturedAt이 최신인 값을 보존.
 */
export function prune(snapshots: DailySnapshot[], maxDays = 365): DailySnapshot[] {
  if (snapshots.length === 0) return snapshots;
  const cutoffDate = getDateDaysAgo(maxDays);
  return dedupeSnapshots(snapshots).filter((snapshot) => snapshot.date >= cutoffDate);
}

function isoWeekKey(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * 장기 보존용 계층 압축.
 *
 * - 최근 dailyDays: 모든 일별 기록
 * - 그 이전부터 weeklyDays까지: ISO 주차별 가장 최근 기록
 * - 더 오래된 기록: 월별 가장 최근 기록(기간 제한 없음)
 *
 * 장기 흐름은 보존하면서 localStorage/단일 DB row가 무한히 커지는 것을 막는다.
 */
export function pruneForLongTerm(
  snapshots: DailySnapshot[],
  dailyDays = 365,
  weeklyDays = 365 * 5,
): DailySnapshot[] {
  if (snapshots.length === 0) return snapshots;
  const today = getTodayKST();
  const dailyCutoff = getDateDaysAgo(dailyDays);
  const weeklyCutoff = getDateDaysAgo(Math.max(dailyDays, weeklyDays));
  const recent: DailySnapshot[] = [];
  const weekly = new Map<string, DailySnapshot>();
  const monthly = new Map<string, DailySnapshot>();

  for (const snapshot of dedupeSnapshots(snapshots)) {
    if (snapshot.date > today) continue;
    if (snapshot.date >= dailyCutoff) {
      recent.push(snapshot);
      continue;
    }
    if (snapshot.date >= weeklyCutoff) {
      weekly.set(isoWeekKey(snapshot.date), snapshot);
      continue;
    }
    monthly.set(snapshot.date.slice(0, 7), snapshot);
  }

  return [
    ...monthly.values(),
    ...weekly.values(),
    ...recent,
  ].sort((a, b) => a.date.localeCompare(b.date));
}
