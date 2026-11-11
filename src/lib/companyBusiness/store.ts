import { getServiceClient, requireServiceClient } from '../supabaseServer';
import { getStoredIndustry } from '../storedIndustry';
import type { BusinessPort, BusinessSnapshot, BusinessPublicProfile } from './types';
import { evidenceHash, hash, publicProjection } from './validation';
export function createBusinessPort(market: 'US' | 'KR' | 'all', symbol?: string): BusinessPort {
  const db = requireServiceClient();
  return {
    async claim(owner) {
      const { data, error } = await db.rpc('claim_company_business', { p_owner: owner, p_market: market, p_symbol: symbol ?? null });
      if (error) throw new Error('business_queue_unavailable'); return data ?? null;
    },
    async checkpoint(job, snapshot, state, reason) {
      const { data, error } = await db.rpc('checkpoint_company_business', { p_symbol: job.symbol, p_owner: job.owner, p_fence: job.fence, p_snapshot: snapshot,
        p_state: state, p_reason: reason, p_evidence_hash: snapshot.evidence ? evidenceHash(snapshot.evidence) : null, p_draft_hash: snapshot.draft ? hash(snapshot.draft) : null });
      if (error) throw new Error('business_checkpoint_unavailable'); return data === true;
    },
  };
}
type BusinessRow = { withheld?: boolean; snapshot?: unknown; approval?: { kind?: string; draftHash?: string; evidenceHash?: string } } | null;
const BUSINESS_READ_BUDGET_MS = 3000, BUSINESS_READ_HEDGE_MS = 350;
/** 읽기 전용 호출 하나가 몇 초씩 멈추는 일이 있다(2026-11-11 실측: 60회 중 1회 2.7초, 중앙값 0.1초).
 * 멈춘 호출이 시간 초과되기를 기다리지 않고, 0.35초 안에 답이 없으면 같은 읽기를 하나 더 보내 먼저 온 성공을 쓴다.
 * 빠르게 실패한 경우에도 한 번은 다시 읽는다. 전체 한도는 이전과 같은 3초이고, 둘 다 실패하면 null이다. */
function readBusinessRow(db: NonNullable<ReturnType<typeof getServiceClient>>, symbol: string): Promise<{ data: BusinessRow } | null> {
  const started = Date.now();
  const read = () => db.rpc('read_company_business', { p_symbol: symbol }).abortSignal(AbortSignal.timeout(Math.max(1, BUSINESS_READ_BUDGET_MS - (Date.now() - started))))
    .then(result => result.error ? null : { data: result.data as BusinessRow }, () => null);
  return new Promise(resolve => {
    let attempts = 0, failures = 0, settled = false;
    const start = () => {
      attempts++;
      void read().then(value => {
        if (settled) return;
        if (value) { settled = true; clearTimeout(hedge); resolve(value); return; }
        failures++;
        if (attempts < 2 && Date.now() - started < BUSINESS_READ_BUDGET_MS) { clearTimeout(hedge); start(); }
        else if (failures === attempts) { settled = true; clearTimeout(hedge); resolve(null); }
      });
    };
    const hedge = setTimeout(() => { if (!settled && attempts < 2) start(); }, BUSINESS_READ_HEDGE_MS);
    start();
  });
}
export type PublishedBusiness = { status: 'published'; profile: BusinessPublicProfile } | { status: 'withheld' | 'none' | 'unavailable' };
export async function readPublishedBusiness(symbol: string, now = new Date().toISOString()): Promise<PublishedBusiness> {
  const resolved = getStoredIndustry(symbol);
  if (['etp', 'instrument', 'shell', 'conflict'].includes(resolved.status)) return { status: 'none' };
  const db = getServiceClient(); if (!db) return { status: 'unavailable' };
  try {
    // Leave room inside the client's 5-second deadline for the database round trip
    // and a cold function connection. A failure still hides any previously withdrawn story.
    const row = await readBusinessRow(db, resolved.symbol);
    if (!row) return { status: 'unavailable' };
    const data = row.data;
    if (!data) return { status: 'none' };
    if (data.withheld === true) return { status: 'withheld' };
    const snapshot = data.snapshot as BusinessSnapshot;
    if (!snapshot?.evidence || !snapshot.draft || !snapshot.review || snapshot.evidence.identity.symbol !== resolved.symbol
      || data.approval?.kind !== 'editorial' || data.approval?.draftHash !== hash(snapshot.draft)
      || data.approval?.evidenceHash !== evidenceHash(snapshot.evidence)) return { status: 'withheld' };
    return { status: 'published', profile: publicProjection(snapshot.evidence, snapshot.draft, snapshot.review, now) };
  } catch { return { status: 'unavailable' }; }
}
