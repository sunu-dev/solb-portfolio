/**
 * 원화 포맷팅 유틸 — 서비스 전체 통일 규칙
 *
 * 규칙:
 * - ₩ 접두어 사용
 * - 3자리 콤마 적용
 * - 1만 이상: "만" 축약 (소수점 1자리)
 * - 1억 이상: "억" 축약 (소수점 1자리)
 * - 음수: -₩ 형태
 */

interface FormatOptions {
  prefix?: boolean;    // ₩ 접두어 (default: true)
  suffix?: string;     // 접미어 (예: "원")
  short?: boolean;     // 만/억 축약 (default: true)
}

export function formatKRW(val: number, opts?: FormatOptions): string {
  const prefix = opts?.prefix !== false ? '₩' : '';
  const suffix = opts?.suffix || '';
  const short = opts?.short !== false;
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);

  if (short) {
    if (abs >= 100000000) {
      // 1억 이상
      const v = val / 100000000;
      const formatted = Math.abs(v) >= 10 ? `${Math.round(v).toLocaleString()}` : `${v.toFixed(1)}`;
      return `${sign}${prefix}${formatted.replace('-', '')}억${suffix}`;
    }
    if (abs >= 10000) {
      // 1만 이상
      const v = val / 10000;
      const formatted = Math.abs(v) >= 1000 ? `${Math.round(v).toLocaleString()}` : `${v.toFixed(1)}`;
      return `${sign}${prefix}${formatted.replace('-', '')}만${suffix}`;
    }
  }

  // 1만 미만
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
