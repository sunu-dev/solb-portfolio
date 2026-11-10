/** Read-only interpretation of daily pilot observations. Collection completion
 * is not a score for the correctness of explanations. No future days are inferred. */
function pilotHealth(report) {
  const time = Date.parse(report?.observedAt), day = Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : '';
  const weekday = Number.isFinite(time) ? new Date(time).getUTCDay() : -1;
  if (!day) return { state: 'invalid_observation', expected: 0, completed: 0, missing: [], failures: [] };
  // The fixed pilot covers the ten US sessions November 2–13. There are no
  // NYSE closure dates in this window. These rules must not be used after it.
  if (day < '2026-11-03' || day > '2026-11-14' || weekday < 2 || weekday > 6) return { state: 'outside_pilot_session', expected: 0, completed: 0, missing: [], failures: [] };
  if (new Date(time).getUTCHours() < 7) return { state: 'before_collection_deadline', expected: 0, completed: 0, missing: [], failures: [] };
  const previous = new Date(time - 86400000).toISOString().slice(0, 10);
  const keys = ['INTC', 'NVDA', 'AMD', 'AMZN', 'GOOGL', 'MSFT', 'META', 'AAPL'].map((symbol, index) => `collection:${symbol}:${index < 2 ? previous : day}`);
  const rows = new Map((report.collections ?? []).map(row => [row.event_key, row]));
  const missing = keys.filter(key => !rows.has(key));
  const failures = keys.filter(key => rows.has(key) && !(rows.get(key).reasons ?? []).some(code => ['collection_stored', 'collection_no_recent_evidence', 'collection_finished'].includes(code)))
    .map(key => ({ event: key, reasons: rows.get(key).reasons }));
  return { state: missing.length || failures.length ? 'needs_attention' : 'collection_complete', sessionDay: previous,
    expected: keys.length, completed: keys.length - missing.length - failures.length, missing, failures, explanationQualityVerified: false };
}
module.exports = { pilotHealth };
