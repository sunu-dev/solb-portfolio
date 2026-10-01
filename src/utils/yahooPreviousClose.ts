/** range=5d의 chartPreviousClose는 조회 시작 전 종가다. 전일 대비 계산에 쓰면 안 된다. */
export function yahooPreviousClose(result: {
  meta?: { previousClose?: number };
  indicators?: { quote?: Array<{ close?: Array<number | null> }> };
}): number | null {
  const previous = result.meta?.previousClose;
  if (typeof previous === 'number' && Number.isFinite(previous) && previous > 0) return previous;
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  // 마지막 봉은 이번 세션. null을 먼저 필터링하면 이전 세션을 한 칸 더 거슬러갈 수 있다.
  const candidate = closes.at(-2);
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0 ? candidate : null;
}
