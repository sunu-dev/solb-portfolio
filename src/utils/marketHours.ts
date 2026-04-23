/**
 * 미국 증시 개장/마감 시간 계산 (NYSE 기준)
 * - 정규장: 09:30 ~ 16:00 ET (월~금)
 * - KST는 ET + 13 (서머타임) 또는 +14 (일반) — 자동 감지
 */

export type MarketStatus =
  | { phase: 'open'; closesInMs: number }      // 정규장 진행 중
  | { phase: 'pre';  opensInMs: number }       // 개장 전 당일
  | { phase: 'post'; nextOpensInMs: number }   // 마감 후 당일
  | { phase: 'weekend'; nextOpensInMs: number } // 주말
  | { phase: 'holiday'; nextOpensInMs: number }; // 공휴일 (간이 — 주말과 동일 처리)

// 미국 동부 시간(ET)의 현재 분단위 시각 반환 (0=00:00 ET ... 1439=23:59 ET)
// 서머타임(DST, 보통 3월 둘째 일요일 ~ 11월 첫 일요일) 자동 반영
function getEtMinutes(now: Date = new Date()): { etDate: Date; minutesOfDay: number; dayOfWeek: number } {
  // Intl.DateTimeFormat로 ET 시각 추출 — DST 자동 반영
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(now).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const year = parseInt(parts.year, 10);
  const month = parseInt(parts.month, 10) - 1;
  const day = parseInt(parts.day, 10);
  const hour = parseInt(parts.hour === '24' ? '0' : parts.hour, 10);
  const minute = parseInt(parts.minute, 10);
  const etDate = new Date(year, month, day, hour, minute);

  // 요일: en-US weekday short (Mon/Tue/...)
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dayMap[parts.weekday] ?? new Date().getDay();

  return { etDate, minutesOfDay: hour * 60 + minute, dayOfWeek };
}

const OPEN_MIN = 9 * 60 + 30;   // 09:30 ET
const CLOSE_MIN = 16 * 60;       // 16:00 ET

/**
 * ET 기준 다음 개장까지 남은 ms 계산
 * - 오늘이 금요일 16시 이후면 월요일 09:30 ET
 * - 주말이면 월요일 09:30 ET
 * - 평일 마감 후면 다음 평일 09:30 ET
 */
function msUntilNextOpen(now: Date, nowMin: number, dow: number): number {
  let daysToAdd = 0;

  // 평일 & 아직 개장 전 → 오늘
  if (dow >= 1 && dow <= 5 && nowMin < OPEN_MIN) {
    daysToAdd = 0;
  }
  // 평일 & 마감 후 → 다음날 (금요일이면 월요일)
  else if (dow >= 1 && dow <= 5 && nowMin >= CLOSE_MIN) {
    daysToAdd = dow === 5 ? 3 : 1;
  }
  // 토요일 → 월요일
  else if (dow === 6) daysToAdd = 2;
  // 일요일 → 월요일
  else if (dow === 0) daysToAdd = 1;

  // 대상일 09:30 ET (local은 DST 차이 있지만 ms 계산 간편히 처리)
  const target = new Date(now);
  target.setTime(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

  // target 시점의 ET OPEN 시각을 현재와 비교해서 ms 계산
  // 간단히: 오늘 ET의 00:00 → +OPEN_MIN분 후가 target opens
  const { etDate } = getEtMinutes(target);
  const etMidnight = new Date(etDate);
  etMidnight.setHours(0, 0, 0, 0);
  const etOpen = new Date(etMidnight);
  etOpen.setMinutes(OPEN_MIN);

  // etOpen은 target의 ET 로컬 시간. 실제 ms 차이 = etOpen - now (단, now가 UTC, etOpen이 naive → 일관성 맞춤)
  // 간단 대체: 다음 개장까지의 "분 단위" 계산
  let minsUntil: number;
  if (daysToAdd === 0) {
    minsUntil = OPEN_MIN - nowMin;
  } else {
    // 오늘 마감 후부터 다음 개장까지
    const minsToMidnight = 24 * 60 - nowMin;
    const fullDays = Math.max(0, daysToAdd - 1);
    minsUntil = minsToMidnight + fullDays * 24 * 60 + OPEN_MIN;
  }

  return minsUntil * 60 * 1000;
}

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const { minutesOfDay, dayOfWeek } = getEtMinutes(now);

  // 주말
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { phase: 'weekend', nextOpensInMs: msUntilNextOpen(now, minutesOfDay, dayOfWeek) };
  }

  // 평일
  if (minutesOfDay < OPEN_MIN) {
    return { phase: 'pre', opensInMs: (OPEN_MIN - minutesOfDay) * 60 * 1000 };
  }
  if (minutesOfDay >= CLOSE_MIN) {
    return { phase: 'post', nextOpensInMs: msUntilNextOpen(now, minutesOfDay, dayOfWeek) };
  }

  return { phase: 'open', closesInMs: (CLOSE_MIN - minutesOfDay) * 60 * 1000 };
}

// ─── 포매팅 헬퍼 ────────────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin <= 0) return '곧';
  if (totalMin < 60) return `${totalMin}분`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days <= 2 && remHours > 0) return `${days}일 ${remHours}시간`;
  return `${days}일`;
}

/**
 * UI 표시용 라벨 반환
 */
export function getMarketLabel(status: MarketStatus): { emoji: string; text: string; accent: 'live' | 'soon' | 'closed' } {
  switch (status.phase) {
    case 'open':
      return { emoji: '🟢', text: `미장 진행 중 · 마감까지 ${formatDuration(status.closesInMs)}`, accent: 'live' };
    case 'pre':
      return { emoji: '🌅', text: `미장 개장까지 ${formatDuration(status.opensInMs)}`, accent: 'soon' };
    case 'post':
      return { emoji: '🌙', text: `미장 마감 · 다음 개장 ${formatDuration(status.nextOpensInMs)} 후`, accent: 'closed' };
    case 'weekend':
      return { emoji: '💤', text: `주말 · 다음 개장 ${formatDuration(status.nextOpensInMs)} 후`, accent: 'closed' };
    case 'holiday':
      return { emoji: '🏛️', text: `휴장 · 다음 개장 ${formatDuration(status.nextOpensInMs)} 후`, accent: 'closed' };
  }
}

/**
 * 시간대 구분 (KST 기준) — Dashboard 컨텍스트 제공용
 */
export type TimeSlot = 'dawn' | 'morning' | 'day' | 'evening' | 'night';

export function getKstTimeSlot(now: Date = new Date()): TimeSlot {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const h = kst.getUTCHours();
  if (h >= 2 && h < 6) return 'dawn';
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'day';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

export function getTimeSlotContext(slot: TimeSlot): { label: string; hint: string } {
  switch (slot) {
    case 'dawn':    return { label: '새벽',    hint: '미장이 아직 뜨거울 시간이에요' };
    case 'morning': return { label: '아침',    hint: '어젯밤 미장 결과를 확인해보세요' };
    case 'day':     return { label: '낮',      hint: '점심에 잠깐 체크해볼까요' };
    case 'evening': return { label: '저녁',    hint: '미장 개장을 기다리는 시간' };
    case 'night':   return { label: '밤',      hint: '미장이 열려 있어요' };
  }
}
