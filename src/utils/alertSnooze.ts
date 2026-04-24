/**
 * 알림 Snooze — 일시 숨김 관리
 * - localStorage 기반, 유저 기기 로컬
 * - 기한 지나면 자동 복귀
 */

const STORAGE_KEY = 'solb_alert_snoozes';

export type SnoozeDuration = '1h' | '3h' | '24h' | 'market_close';

interface SnoozeRecord {
  [alertId: string]: number; // until timestamp (ms)
}

function load(): SnoozeRecord {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SnoozeRecord;
    // 만료된 항목 정리
    const now = Date.now();
    const cleaned: SnoozeRecord = {};
    for (const [id, until] of Object.entries(parsed)) {
      if (until > now) cleaned[id] = until;
    }
    // 만료된 게 있었다면 다시 저장
    if (Object.keys(cleaned).length !== Object.keys(parsed).length) {
      saveRaw(cleaned);
    }
    return cleaned;
  } catch {
    return {};
  }
}

function saveRaw(record: SnoozeRecord) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch { /* silent */ }
}

/**
 * Duration → until timestamp 계산
 * market_close: 미국 정규장 마감(16:00 ET) 기준 — 이미 마감이면 다음 거래일
 */
function computeUntil(duration: SnoozeDuration): number {
  const now = Date.now();
  switch (duration) {
    case '1h':  return now + 60 * 60 * 1000;
    case '3h':  return now + 3 * 60 * 60 * 1000;
    case '24h': return now + 24 * 60 * 60 * 1000;
    case 'market_close': {
      // 미국 ET로 오늘 16:00 또는 다음 거래일 16:00
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
        weekday: 'short',
      });
      const parts = fmt.formatToParts(new Date()).reduce<Record<string, string>>((acc, p) => {
        acc[p.type] = p.value;
        return acc;
      }, {});
      const hour = parseInt(parts.hour === '24' ? '0' : parts.hour, 10);
      const minute = parseInt(parts.minute, 10);
      const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const etDow = dayMap[parts.weekday] ?? 0;
      const minsNow = hour * 60 + minute;
      const CLOSE_MIN = 16 * 60;

      let daysAhead = 0;
      if (minsNow >= CLOSE_MIN) {
        // 이미 마감 — 다음 거래일
        daysAhead = etDow === 5 ? 3 : etDow === 6 ? 2 : 1;
      } else if (etDow === 0) {
        daysAhead = 1;
      } else if (etDow === 6) {
        daysAhead = 2;
      }

      const minsUntil = daysAhead === 0
        ? CLOSE_MIN - minsNow
        : (24 * 60 - minsNow) + (daysAhead - 1) * 24 * 60 + CLOSE_MIN;
      return now + minsUntil * 60 * 1000;
    }
  }
}

/**
 * 알림을 기간 동안 snooze
 */
export function snoozeAlert(alertId: string, duration: SnoozeDuration) {
  const record = load();
  record[alertId] = computeUntil(duration);
  saveRaw(record);
}

/**
 * 특정 알림이 현재 snooze 중인지
 */
export function isAlertSnoozed(alertId: string): boolean {
  const record = load();
  const until = record[alertId];
  return typeof until === 'number' && until > Date.now();
}

/**
 * Snooze 해제
 */
export function unsnoozeAlert(alertId: string) {
  const record = load();
  if (record[alertId]) {
    delete record[alertId];
    saveRaw(record);
  }
}

/**
 * 전체 snooze 초기화
 */
export function clearAllSnoozes() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* silent */ }
}

/**
 * Duration 라벨 (UI용)
 */
export function getSnoozeLabel(duration: SnoozeDuration): string {
  switch (duration) {
    case '1h':           return '1시간';
    case '3h':           return '3시간';
    case '24h':          return '24시간';
    case 'market_close': return '장 마감까지';
  }
}
