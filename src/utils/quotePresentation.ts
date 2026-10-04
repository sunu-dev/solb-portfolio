/** A missing comparison is different from an unchanged price. */
export function quoteDirection(percent: number | null | undefined): 'up' | 'down' | 'flat' | 'unknown' {
  if (percent == null || !Number.isFinite(percent)) return 'unknown';
  if (Math.abs(percent) < 0.005) return 'flat';
  return percent > 0 ? 'up' : 'down';
}

export function quoteTimestamp(timestamp: number | null | undefined): string | null {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  const date = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}
