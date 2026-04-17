/**
 * 원화 포맷팅 유틸 — 서비스 전체 통일 규칙 (Toss 스타일)
 *
 * 규칙:
 * - 1억 미만: 풀숫자 + 콤마 (276,000원)
 * - 1억 이상: 억 축약 (2.1억원)
 * - 음수: -₩ 형태
 */

interface FormatOptions {
  prefix?: boolean;    // ₩ 접두어 (default: true)
  suffix?: string;     // 접미어 (예: "원")
  short?: boolean;     // 억 축약 (default: true) — 1억 미만은 항상 풀숫자
}

export function formatKRW(val: number, opts?: FormatOptions): string {
  if (!isFinite(val) || isNaN(val)) return opts?.prefix !== false ? '₩0' : '0';

  const prefix = opts?.prefix !== false ? '₩' : '';
  const suffix = opts?.suffix || '';
  const short = opts?.short !== false;
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);

  // 10억 이상 → 억 축약
  if (short && abs >= 1_000_000_000) {
    const v = Math.abs(val / 100_000_000);
    const formatted = v >= 10 ? Math.round(v).toLocaleString() : v.toFixed(1);
    return `${sign}${prefix}${formatted}억${suffix}`;
  }

  // 1억 미만 → 풀숫자 (Toss 스타일)
  return `${sign}${prefix}${Math.round(abs).toLocaleString()}${suffix}`;
}

/**
 * 짧은 버전 (₩ 없이, 만/억만)
 * 히트맵, 테이블 셀 등 공간 제한 시 사용
 */
export function formatKRWShort(val: number): string {
  return formatKRW(val, { prefix: true });
}

/**
 * 변동금액 표시 (+₩2,684 / -₩1.2만)
 */
export function formatKRWChange(val: number): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${formatKRW(val)}`;
}
