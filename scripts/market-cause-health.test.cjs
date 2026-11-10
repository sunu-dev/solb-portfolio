const { test } = require('node:test'), assert = require('node:assert/strict');
const { pilotHealth } = require('./market-cause-health.cjs');
test('setup and weekend snapshots never count as observed pilot sessions', () => {
  for (const observedAt of ['2026-10-31T07:00:00Z', '2026-11-08T07:00:00Z', '2026-11-09T07:00:00Z', '2026-11-15T07:00:00Z']) assert.equal(pilotHealth({ observedAt }).state, 'outside_pilot_session');
});
test('waits for all daily collection windows before judging missing work', () => {
  assert.equal(pilotHealth({ observedAt: '2026-11-03T06:59:59Z' }).state, 'before_collection_deadline');
});
test('detects missing work across the UTC midnight split', () => {
  const r = pilotHealth({ observedAt: '2026-11-03T07:30:00Z', collections: [{ event_key: 'collection:INTC:2026-11-02', reasons: ['collection_stored'] }] });
  assert.equal(r.expected, 8); assert.equal(r.completed, 1); assert.equal(r.missing.length, 7); assert.ok(r.missing.includes('collection:AMD:2026-11-03'));
});
test('distinguishes a budget hold from source absence and from quality verification', () => {
  const collections = ['INTC', 'NVDA', 'AMD', 'AMZN', 'GOOGL', 'MSFT', 'META', 'AAPL'].map((symbol, i) => ({ event_key: `collection:${symbol}:${i < 2 ? '2026-11-02' : '2026-11-03'}`, reasons: ['collection_no_recent_evidence'] }));
  const r = pilotHealth({ observedAt: '2026-11-03T07:00:00Z', collections }); assert.equal(r.state, 'collection_complete'); assert.equal(r.explanationQualityVerified, false);
  collections[0].reasons = ['collection_analysis_failed', 'narrative_blocked_limit_reached'];
  const failed = pilotHealth({ observedAt: '2026-11-03T07:00:00Z', collections }); assert.equal(failed.state, 'needs_attention'); assert.equal(failed.failures.length, 1);
});
