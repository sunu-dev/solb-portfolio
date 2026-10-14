import type { MacroEntry } from '@/config/constants';

/** Preserve unknown comparisons; zero is reserved for a confirmed unchanged quote. */
export function macroEntryFromQuote(quote: { c?: unknown; d?: unknown; dp?: unknown } | null | undefined): MacroEntry | null {
  if (typeof quote?.c !== 'number' || !Number.isFinite(quote.c) || quote.c <= 0) return null;
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  return { value: quote.c, change: finite(quote.d), changePercent: finite(quote.dp) };
}

const MACRO_ALIASES: Record<string, string> = { KOSPI: '코스피', KOSDAQ: '코스닥', 'WTI Oil': 'WTI' };

/** Read legacy event labels against the same keys used by live market data. */
export function macroValue(data: Record<string, unknown>, label: string): number | null {
  for (const key of [MACRO_ALIASES[label] ?? label, label]) {
    const value = (data[key] as { value?: unknown } | undefined)?.value;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}
