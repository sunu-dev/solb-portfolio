import { getUsTradingSession } from '@/utils/usTradingSession';

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
  | { phase: 'unknown' }
  | { phase: 'holiday'; nextOpensInMs: number }; // 공휴일 (간이 — 주말과 동일 처리)

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const session = getUsTradingSession(now);
  if (session.phase === 'open') return { phase: 'open', closesInMs: session.closeAt - now.getTime() };
  if (session.nextOpen === null) return { phase: 'unknown' };
  const remaining = session.nextOpen - now.getTime();
  if (session.phase === 'pre') return { phase: 'pre', opensInMs: remaining };
  if (session.phase === 'holiday' || session.phase === 'weekend' || session.phase === 'post') {
    return { phase: session.phase, nextOpensInMs: remaining };
  }
  return { phase: 'unknown' };
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
    case 'unknown':
      return { emoji: '⚪', text: '미장 · 거래 일정 확인 필요', accent: 'closed' };
    case 'open':
      return { emoji: '🟢', text: `미장 진행 중 · 마감까지 ${formatDuration(status.closesInMs)}`, accent: 'live' };
    case 'pre':
      return { emoji: '🌅', text: `미장 개장까지 ${formatDuration(status.opensInMs)}`, accent: 'soon' };
    case 'post':
      return { emoji: '🌙', text: `미장 마감 · 다음 개장 ${formatDuration(status.nextOpensInMs)} 후`, accent: 'closed' };
    case 'weekend':
      return { emoji: '💤', text: `미장 주말 · 다음 개장 ${formatDuration(status.nextOpensInMs)} 후`, accent: 'closed' };
    case 'holiday':
      return { emoji: '🏛️', text: `미장 휴장 · 다음 개장 ${formatDuration(status.nextOpensInMs)} 후`, accent: 'closed' };
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
    case 'dawn':    return { label: '새벽',    hint: '시세 기준 시각을 함께 확인해보세요' };
    case 'morning': return { label: '아침',    hint: '최근 거래일의 미장 결과를 확인해보세요' };
    case 'day':     return { label: '낮',      hint: '점심에 잠깐 체크해볼까요' };
    case 'evening': return { label: '저녁',    hint: '미장 거래 일정을 확인해보세요' };
    case 'night':   return { label: '밤',      hint: '미장 배지에서 거래 상태를 확인해보세요' };
  }
}
