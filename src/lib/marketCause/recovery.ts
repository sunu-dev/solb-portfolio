import { requireServiceClient } from '../supabaseServer';
import { runSecShadowPilot } from './pilot';
import { collectPolicyRelease } from './policyCollector';
import { runExplanationQuality } from './qualityCycle';
/** Bounded scheduled recovery, with the same DB leases and model reservations.
 * A failed/unknown provider call never releases its unconfirmed cost reservation. */
export async function recoverMarketCause(group:string|null=null) {
  const { data, error } = await requireServiceClient().rpc('market_cause_recovery_queue',{p_group:group});
  if (error || !Array.isArray(data) || data.length > 2) throw new Error('recovery_queue_unavailable');
  const results: { event: string; status: string; collectionStatus?: string }[] = [];
  const start = Date.now();
  for (const item of data) {
    if (results.length >= 1 || Date.now() - start > 140000) break;
    const event = typeof item?.event_key === 'string' ? item.event_key : '';
    const match = event.match(/^collection:(INTC|NVDA|AMD|AMZN|GOOGL|MSFT|META|AAPL):(\d{4}-\d{2}-\d{2})$/);
    if (match) {
      const r = await runSecShadowPilot(match[1], undefined, match[2]);
      results.push({ event, status: r.status, collectionStatus: r.collection?.status });
    } else if (event === 'official:fed' || event === 'official:bok') {
      const r = await collectPolicyRelease(event === 'official:fed' ? 'fed' : 'bok');
      results.push({ event, status: r.status, collectionStatus: r.sourceStatus });
    }
  }
  const quality = await runExplanationQuality();
  return { status: 'checked', results, quality };
}
