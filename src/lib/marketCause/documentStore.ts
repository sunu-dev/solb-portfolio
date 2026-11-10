import { documentHash, instant } from './normalizeFacts';
import type { SourceDocument } from './types';

/** Immutable document-version reconciliation, usable behind a transactional store.
 * A collector retry cannot rewrite firstSeenAt or resurrect revoked evidence.
 * Missing fetch results do not delete previously observed documents.
 */
export function reconcileDocuments(previous:SourceDocument[],incoming:SourceDocument[]):SourceDocument[] {
  const documents=new Map(previous.map(d=>[d.id,structuredClone(d)]));
  if(documents.size!==previous.length||new Set(incoming.map(d=>d.id)).size!==incoming.length)throw new Error('duplicate_document_id');
  for(const next of incoming) {
    if(next.hash!==documentHash(next.cells)||!Number.isFinite(instant(next.firstSeenAt))||!Number.isFinite(instant(next.retrievedAt))
      ||instant(next.firstSeenAt)>instant(next.retrievedAt))throw new Error('invalid_document_version');
    const old=documents.get(next.id);
    if(!old){documents.set(next.id,structuredClone(next));continue;}
    if(old.hash!==next.hash||old.url!==next.url||old.sourceId!==next.sourceId||old.publishedAt!==next.publishedAt||old.precision!==next.precision)throw new Error('immutable_document_changed');
    if(instant(next.firstSeenAt)<instant(old.firstSeenAt))throw new Error('retroactive_availability');
    // Revocation wins over late arrivals; only a new version ID can restore evidence.
    const status=old.status==='withdrawn'||next.status==='withdrawn'?'withdrawn'
      :old.status==='superseded'||next.status==='superseded'?'superseded':'active';
    documents.set(next.id,{...old,status,retrievedAt:instant(next.retrievedAt)>instant(old.retrievedAt)?next.retrievedAt:old.retrievedAt});
  }
  return [...documents.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
export interface PublishedDependency {versionId:string;documentIds:string[];disposition:string}
/** Reverse dependency selection only. Persistent invalidation must use CAS in the repository. */
export function affectedReports(reports:PublishedDependency[],revokedDocumentIds:string[]):string[] {
  const revoked=new Set(revokedDocumentIds);
  return [...new Set(reports.filter(r=>r.disposition!=='withdrawn'&&r.documentIds.some(id=>revoked.has(id))).map(r=>r.versionId))].sort();
}
