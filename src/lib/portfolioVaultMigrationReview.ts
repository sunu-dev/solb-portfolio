/** Pure review of explicitly owned sources. Callers must read raw cloud/local
 * records without the legacy normalizers (which prune history). This never
 * reads storage, chooses a newer timestamp, deletes a source or writes remotely.
 */
import { normalizeLosslessPortfolioVaultPayload, portfolioVaultPayloadSignature,
  type PortfolioVaultPayload } from './portfolioVaultPayload';

type SourceName = 'cloud' | 'local' | 'outbox';
interface Source { ownerId: string | null; payload: unknown }
export interface PortfolioMigrationReviewInput {
  ownerId: string;
  cloud: (Source & { updatedAt: string; settings?: unknown }) | null;
  local: Source | null;
  outbox: (Source & { baseUpdatedAt: string | null }) | null;
}
export type PortfolioMigrationReview =
  | { status: 'blocked'; reason: 'invalid_owner' | 'unowned_source' | 'different_owner'
    | 'unsupported_source' | 'missing_private_state' | 'no_sources'; source?: SourceName }
  | { status: 'conflict'; sources: SourceName[] }
  | { status: 'ready'; payload: PortfolioVaultPayload; expectedUpdatedAt: string | null; sources: SourceName[] };

/** A ready result is a content comparison, NOT rollout authorization or proof
 * that every local side copy has been collected. Capture/recheck the source
 * inventory and satisfy the separate notification/backup gates before commit.
 */
export function reviewPortfolioVaultMigration(input: PortfolioMigrationReviewInput): PortfolioMigrationReview {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.ownerId)) {
    return { status: 'blocked', reason: 'invalid_owner' };
  }
  const sources: Array<{ name: SourceName; payload: PortfolioVaultPayload }> = [];
  for (const name of ['cloud', 'local', 'outbox'] as const) {
    const source = input[name];
    if (!source) continue;
    if (!source.ownerId) return { status: 'blocked', reason: 'unowned_source', source: name };
    if (source.ownerId !== input.ownerId) return { status: 'blocked', reason: 'different_owner', source: name };
    const payload = normalizeLosslessPortfolioVaultPayload(source.payload);
    if (!payload) return { status: 'blocked', reason: 'unsupported_source', source: name };
    sources.push({ name, payload });
  }
  if (!sources.length) return { status: 'blocked', reason: 'no_sources' };
  const settings = input.cloud?.settings;
  if (settings !== undefined && settings !== null
    && (typeof settings !== 'object' || Array.isArray(settings) || Object.keys(settings).length !== 0)) {
    return { status: 'blocked', reason: 'unsupported_source', source: 'cloud' };
  }
  if (input.cloud && (typeof input.cloud.updatedAt !== 'string' || !Number.isFinite(Date.parse(input.cloud.updatedAt)))) {
    return { status: 'blocked', reason: 'unsupported_source', source: 'cloud' };
  }
  if (input.outbox && input.outbox.baseUpdatedAt !== null
    && (typeof input.outbox.baseUpdatedAt !== 'string' || !Number.isFinite(Date.parse(input.outbox.baseUpdatedAt)))) {
    return { status: 'blocked', reason: 'unsupported_source', source: 'outbox' };
  }
  const names = sources.map(source => source.name);
  // A pending copy referring to a disappeared server row needs explicit review.
  if (input.outbox?.baseUpdatedAt && !input.cloud) return { status: 'conflict', sources: names };
  const baseSignature = (payload: PortfolioVaultPayload) => portfolioVaultPayloadSignature({
    stocks: payload.stocks, snapshots: payload.snapshots, history: payload.history,
  });
  const first = baseSignature(sources[0].payload);
  if (sources.some(source => baseSignature(source.payload) !== first)) return { status: 'conflict', sources: names };
  // Legacy cloud/outbox may omit device-only fields. At least one complete
  // owned source must supply them; absence is never replaced by empty defaults.
  const complete = sources.filter(source => source.payload.privateState !== undefined);
  if (!complete.length) return { status: 'blocked', reason: 'missing_private_state' };
  const signature = portfolioVaultPayloadSignature(complete[0].payload);
  if (complete.some(source => portfolioVaultPayloadSignature(source.payload) !== signature)) {
    return { status: 'conflict', sources: names };
  }
  return { status: 'ready', payload: JSON.parse(JSON.stringify(complete[0].payload)) as PortfolioVaultPayload,
    expectedUpdatedAt: input.cloud?.updatedAt ?? null, sources: names };
}
