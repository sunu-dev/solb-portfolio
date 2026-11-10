import { randomUUID } from 'node:crypto';
import { requireServiceClient } from './supabaseServer';
import { collectMarketWatch } from './marketWatchCollector';
import { noticeHistory } from './marketWatchAnalysis';
import { trackWatchSources } from './watchSourceHealth';
import { sendCronAlert } from './cronAlert';
import { buildMarketFlowBriefs } from './marketFlowEngine';
import { mergeWatchEvent, sortWatchEvents, type WatchEvent, type WatchFeed, type WatchRun, type WatchScope } from './marketWatch';

export async function readMarketWatch(now = Date.now()): Promise<WatchFeed> {
  const db = requireServiceClient();
  const [events, runs] = await Promise.all([
    db.from('market_watch_events').select('payload').gte('last_observed_at', new Date(now - 30 * 86400000).toISOString()).order('last_observed_at', { ascending: false }).limit(500),
    db.from('market_watch_runs').select('scope,last_run,last_error'),
  ]);
  if (events.error || runs.error) throw new Error('Market watch storage unavailable');
  const observed = (events.data ?? []).map(row => row.payload as WatchEvent);
  const observedRuns = (runs.data ?? []).flatMap(row => row.last_run ? [{ ...(row.last_run as WatchRun),
      warnings: [...((row.last_run as WatchRun).warnings ?? []), ...(row.last_error ? ['최근 갱신을 완료하지 못해 마지막 확인 기록을 보여드려요.'] : [])],
    }] : []);
  return {
    events: sortWatchEvents(observed, now), runs: observedRuns, servedAt: new Date(now).toISOString(),
    // Include quiet observations in the denominator; the display list omits
    // them and would otherwise exaggerate the breadth of market declines.
    briefs: buildMarketFlowBriefs(observed, observedRuns, now),
  };
}

/** Scheduled collection only. Public readers never trigger source calls, generation, or writes. */
export async function refreshMarketWatch(scope: WatchScope) {
  const db = requireServiceClient(); const owner = randomUUID();
  const claim = await db.rpc('claim_market_watch', { p_scope: scope, p_owner: owner });
  if (claim.error) throw new Error('Could not claim market watch');
  if (claim.data !== true) return { skipped: true, reason: 'already-running' };
  try {
    const previous = await db.from('market_watch_events').select('id,payload').eq('scope', scope).limit(500);
    if (previous.error) throw new Error('Could not read prior observations');
    const old = new Map((previous.data ?? []).map(row => [row.id as string, row.payload as WatchEvent]));
    const now = Date.now(); const checkedAt = new Date(now).toISOString();
    const collection = await collectMarketWatch(scope, now);
    if (!collection.coverage.some(item => item.available > 0)) throw new Error('All market watch sources unavailable');
    const events = collection.candidates.map(candidate => {
      const event = mergeWatchEvent(candidate, old.get(candidate.id), checkedAt);
      if (candidate.kind === 'circuit-breaker' || candidate.kind === 'sidecar') {
        const history = [...(old.get(candidate.id)?.history ?? []), ...noticeHistory(candidate)];
        event.history = [...new Map(history.map(item => [`${item.asOf}:${item.status}`, item])).values()]
          .sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf)).slice(-20);
      }
      return event;
    });
    const priorRun = await db.from('market_watch_runs').select('last_run').eq('scope', scope).maybeSingle();
    if (priorRun.error) throw new Error('Could not read source health');
    const health = trackWatchSources(collection.coverage, priorRun.data?.last_run?.coverage || [], checkedAt);
    const run: WatchRun = { scope, checkedAt, coverage: health.coverage, warnings: collection.warnings };
    const published = await db.rpc('publish_market_watch', { p_scope: scope, p_owner: owner, p_events: events, p_run: run });
    if (published.error || published.data !== true) throw new Error('Could not publish market watch');
    if (health.alerts.length) await sendCronAlert({ jobName: `market-watch-${scope}`, stage: 'source-degraded',
      error: 'Sources have remained partially unavailable for at least 30 minutes', context: { sources: health.alerts } });
    return { skipped: false, count: events.length, ...run };
  } catch (error) {
    await db.rpc('publish_market_watch', { p_scope: scope, p_owner: owner, p_events: [], p_run: null, p_error: 'collection_failed' });
    throw error;
  }
}
