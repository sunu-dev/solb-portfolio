/**
 * 한국어 날짜·상대 시간 SSOT
 *
 * 정책: docs/KOREAN_UI_SYSTEM.md §3.5
 *
 * 컴포넌트마다 "5분 전"·"방금"·"어제" 따로 구현하던 산발 로직 통합.
 *
 * 단계:
 *   <60초:     "방금"
 *   <1시간:    "N분 전"
 *   <24시간:   "N시간 전"
 *   <48시간:   "어제"
 *   <7일:      "N일 전"
 *   그 이상:   "YYYY-MM-DD"
 *
 * 사용 예:
 *   formatRelativeKo(Date.now() - 30_000)        // "방금"
 *   formatRelativeKo(Date.now() - 5 * 60_000)    // "5분 전"
 *   formatRelativeKo(new Date('2025-01-01'))     // "2025-01-01"
 */

type DateInput = number | string | Date;

function toMs(input: DateInput): number {
  if (input instanceof Date) return input.getTime();
  if (typeof input === 'string') return new Date(input).getTime();
  return input;
}

/** 한국어 상대 시간 — 1시간 이내는 분, 24시간 이내는 시간, 어제는 "어제", 7일 이내는 N일, 그 외 절대 날짜. */
export function formatRelativeKo(input: DateInput, now: DateInput = Date.now()): string {
  const ts = toMs(input);
  const nowMs = toMs(now);
  if (!Number.isFinite(ts) || !Number.isFinite(nowMs)) return '';

  const diffMs = nowMs - ts;
  if (diffMs < 0) return formatAbsoluteKo(ts);  // 미래 시점은 절대 날짜로

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return '방금';

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;

  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;

  const day = Math.floor(hour / 24);
  if (day === 1) return '어제';
  if (day < 7) return `${day}일 전`;

  return formatAbsoluteKo(ts);
}

/** 한국어 절대 날짜 — "YYYY-MM-DD" (ISO 형식, 정합성 우선). */
export function formatAbsoluteKo(input: DateInput): string {
  const ts = toMs(input);
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** 한국어 절대 날짜 — "YYYY년 M월 D일" (자연어 형식, 본문용). */
export function formatLongKo(input: DateInput): string {
  const ts = toMs(input);
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 한국어 시간 — "오전/오후 H:MM" 형식. */
export function formatTimeKo(input: DateInput): string {
  const ts = toMs(input);
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${ampm} ${h12}:${m}`;
}