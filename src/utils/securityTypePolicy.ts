/**
 * 주비가 현재 가격·통화·자산 분류를 안전하게 처리할 수 있는 Finnhub 종목 유형.
 *
 * 검색과 신규상장 동기화가 반드시 이 정책을 함께 사용해야 한다.
 * 새 유형을 추가할 때는 securityTypePolicy.test.ts의 허용·차단 사례도 갱신한다.
 */
export const SUPPORTED_FINNHUB_SECURITY_TYPES = [
  'COMMON STOCK',
  'ADR',
  'ETP',
  'ETF',
] as const;

const SUPPORTED_TYPE_SET = new Set<string>(SUPPORTED_FINNHUB_SECURITY_TYPES);

export function normalizeFinnhubSecurityType(type: unknown): string {
  return typeof type === 'string' ? type.trim().toUpperCase() : '';
}

export function isSupportedFinnhubSecurityType(type: unknown): boolean {
  return SUPPORTED_TYPE_SET.has(normalizeFinnhubSecurityType(type));
}

/** 동기화에서 탈락한 유형을 집계해 공급자 스키마 변화를 관측한다. */
export function countUnsupportedFinnhubSecurityTypes(
  rows: Array<{ type?: unknown }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (isSupportedFinnhubSecurityType(row.type)) continue;
    const type = normalizeFinnhubSecurityType(row.type) || '(EMPTY)';
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}
