const STORAGE_KEY = 'solb_pro_demand_activity_v1';
const ACTIVITY_EVENT = 'solb-pro-demand-activity';
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ACTIONS = 50;

export interface ProDemandActivityRecord {
  visitDays: string[];
  managementActions: number[];
}

const EMPTY_ACTIVITY: ProDemandActivityRecord = Object.freeze({
  visitDays: [],
  managementActions: [],
});

function toLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function sanitizeProDemandActivity(raw: unknown, now = Date.now()): ProDemandActivityRecord {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_ACTIVITY };
  const source = raw as Partial<ProDemandActivityRecord>;
  const cutoff = now - WINDOW_MS;
  const validDays = new Set<string>();

  for (const value of Array.isArray(source.visitDays) ? source.visitDays : []) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) continue;
    const parsed = new Date(`${value}T23:59:59`).getTime();
    if (Number.isFinite(parsed) && parsed >= cutoff) validDays.add(value);
  }

  const managementActions = (Array.isArray(source.managementActions) ? source.managementActions : [])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= cutoff && value <= now)
    .slice(-MAX_ACTIONS);

  return { visitDays: [...validDays].sort(), managementActions };
}

function read(now = Date.now()): ProDemandActivityRecord {
  if (typeof window === 'undefined') return { ...EMPTY_ACTIVITY };
  try {
    return sanitizeProDemandActivity(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'), now);
  } catch {
    return { ...EMPTY_ACTIVITY };
  }
}

function write(activity: ProDemandActivityRecord): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activity));
    window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT));
  } catch { /* 저장 실패는 제품 사용을 막지 않음 */ }
}

export function recordProDemandVisit(now = Date.now()): void {
  const activity = read(now);
  const today = toLocalDateKey(now);
  if (activity.visitDays.includes(today)) return;
  write({ ...activity, visitDays: [...activity.visitDays, today].sort() });
}

export function recordProDemandManagementAction(now = Date.now()): void {
  const activity = read(now);
  write({ ...activity, managementActions: [...activity.managementActions, now].slice(-MAX_ACTIONS) });
}

export function getProDemandActivityCounts(now = Date.now()): {
  visitsLast14Days: number;
  importOrEditCountLast14Days: number;
} {
  const activity = read(now);
  return {
    visitsLast14Days: activity.visitDays.length,
    importOrEditCountLast14Days: activity.managementActions.length,
  };
}

export function subscribeProDemandActivity(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(ACTIVITY_EVENT, listener);
  return () => window.removeEventListener(ACTIVITY_EVENT, listener);
}
