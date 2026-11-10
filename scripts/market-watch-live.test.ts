import { mkdir, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { collectMarketWatch } from '../src/lib/marketWatchCollector';
import { mergeWatchEvent, type WatchFeed } from '../src/lib/marketWatch';

describe.skipIf(process.env.MARKET_WATCH_LIVE !== '1')('live public market sources (read-only)', () => {
  it('collects exchange measures, price comparisons, economic releases and the entire industry registry', async () => {
    const now = Date.now(); const at = new Date(now).toISOString();
    const [market, industries] = await Promise.all([collectMarketWatch('market', now), collectMarketWatch('industries', now)]);
    const feed: WatchFeed = { servedAt: at, events: [...market.candidates, ...industries.candidates].map(event => mergeWatchEvent(event, undefined, at)),
      runs: [{ scope: 'market', checkedAt: at, coverage: market.coverage, warnings: market.warnings },
        { scope: 'industries', checkedAt: at, coverage: industries.coverage, warnings: industries.warnings }] };
    await mkdir('artifacts/market-watch-20261015', { recursive: true });
    await writeFile('artifacts/market-watch-20261015/live-feed.json', JSON.stringify(feed, null, 2));
    console.log(JSON.stringify({ runs: feed.runs, exchange: feed.events.filter(event => ['circuit-breaker', 'sidecar'].includes(event.kind)).map(event => ({ title: event.title, asOf: event.asOf, sources: event.sources })) }));
    expect(market.coverage.find(item => item.id === 'krx')?.available).toBe(1);
    expect(market.coverage.find(item => item.id === 'quotes')!.available).toBeGreaterThan(0);
    expect(industries.coverage[0].available).toBeGreaterThan(0);
  }, 120000);
});
