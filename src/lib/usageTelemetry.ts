import type { UsageEvent } from './usageMetrics';

/** Deliberately carries no ticker, URL, search text, holdings or explanation text. */
export function usageEvent(event: UsageEvent) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('joobi-usage', { detail: event }));
}
