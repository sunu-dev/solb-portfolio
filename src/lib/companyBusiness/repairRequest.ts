import { createHash } from 'node:crypto';
export interface RepairManifest {
  policy: 'improvement-v1'; runId: string; engineVersion: string; observedAt: string;
  requests: {symbol:string;contentHash:string;evidenceHash:string}[]; id: string;
}
/** The bridge accepts identifiers and fingerprints only, never prose, SQL or approval flags. */
export function parseRepairManifest(value: unknown, now = Date.now()): RepairManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('repair_manifest_invalid');
  const m=value as RepairManifest;
  const keys=['policy','runId','engineVersion','observedAt','requests','id'];
  const at=Date.parse(m.observedAt);
  if(Object.keys(m).length!==keys.length||keys.some(k=>!Object.hasOwn(m,k))||m.policy!=='improvement-v1'
    || !/^[a-f0-9]{20}$/.test(m.runId)||!/^\d+\.\d+\.\d+$/.test(m.engineVersion)||!Number.isFinite(at)||at>now+60000||now-at>7*86400000
    ||!Array.isArray(m.requests)||m.requests.length>30||new Set(m.requests.map(r=>r?.symbol)).size!==m.requests.length
    ||m.requests.some(r=>!r||Object.keys(r).length!==3||!/^[A-Z0-9][A-Z0-9.^-]{0,19}$/.test(r.symbol)||!/^[a-f0-9]{64}$/.test(r.contentHash)||!/^[a-f0-9]{64}$/.test(r.evidenceHash))) throw new Error('repair_manifest_invalid');
  const payload={policy:m.policy,runId:m.runId,engineVersion:m.engineVersion,observedAt:m.observedAt,requests:m.requests};
  if(createHash('sha256').update(JSON.stringify(payload)).digest('hex')!==m.id)throw new Error('repair_manifest_tampered');
  return m;
}
