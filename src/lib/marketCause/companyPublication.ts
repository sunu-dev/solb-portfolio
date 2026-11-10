import { requireServiceClient } from '../supabaseServer';
import { explainCompanyFacts } from './companyFacts';
import { explainCompanyNarrative } from './companyNarrative';
import type { ShadowSnapshot } from './shadowCycle';
import type { CompanyExplanationFeed } from './companyTypes';
import type { NarrativeRelease } from './narrativeRelease';
import { combineCompanyExplanations } from './companyStory';
/** One bounded service RPC. No collectors, models, user records or public writes. */
export async function readCompanyExplanations(now = new Date().toISOString()): Promise<CompanyExplanationFeed> {
  try {
    const { data, error } = await requireServiceClient().rpc('read_market_cause_companies');
    if (error || !data || data.enabled !== true || !Array.isArray(data.snapshots)) return { cards: [], warnings: [] };
    const cards: CompanyExplanationFeed['cards'] = [];
    for (const row of data.snapshots.slice(0, 16) as { symbol: string; kind: string; snapshot: ShadowSnapshot }[]) {
      try { cards.push(...(row.kind === 'facts' ? explainCompanyFacts(row.symbol, row.snapshot, now)
        : row.kind === 'sec' ? explainCompanyNarrative(row.symbol, row.snapshot, data.release as NarrativeRelease | null, now) : [])); }
      catch { /* A malformed company record cannot suppress other verified records. */ }
    }
    return { cards: combineCompanyExplanations(cards), warnings: [] };
  } catch { return { cards: [], warnings: [] }; }
}
