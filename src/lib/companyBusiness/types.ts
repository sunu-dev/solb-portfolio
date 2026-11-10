export const BUSINESS_POLICY = 'business-v2';
export const BUSINESS_FIELDS = ['summary', 'customers', 'revenue', 'watch'] as const;
export type BusinessField = typeof BUSINESS_FIELDS[number];
export interface IssuerIdentity {
  symbol: string; name: string; market: 'US' | 'KR'; provider: 'sec' | 'dart'; issuerId: string;
  verifiedAt: string; identityUrl: string;
}
export interface BusinessEvidence {
  identity: IssuerIdentity; documentId: string; url: string; title: string;
  publishedAt: string; retrievedAt: string; bodyHash: string;
  /** Full document with executable scripts removed; bodyHash retains the original bytes. */
  contentHash?: string;
  passages: { id: string; text: string; hash: string; role?: 'overview' | 'detail' }[];
}
export interface CitedStatement { text: string; citations: { passageId: string; quote: string }[] }
export interface BusinessDraft {
  policy: typeof BUSINESS_POLICY; symbol: string; evidenceHash: string;
  sections: Record<BusinessField, CitedStatement>;
}
export interface BusinessReview {
  policy: typeof BUSINESS_POLICY; draftHash: string; evidenceHash: string;
  checks: { field: BusinessField; supported: boolean; complete: boolean; beginnerFriendly: boolean; issue: string }[];
  identityMatches: boolean; noUnsupportedClaims: boolean;
}
export interface BusinessPublicProfile {
  policy: typeof BUSINESS_POLICY; version: string; symbol: string; name: string;
  summary: string; customers: string; revenue: string; watch: string;
  sources: { label: string; url: string; reviewedAt: string }[];
  sourcePublishedAt: string; checkedAt: string; validUntil: string;
}
export interface BusinessSnapshot {
  evidence: BusinessEvidence | null; draft: BusinessDraft | null; review: BusinessReview | null;
  repair?: { attempts: number; feedback: BusinessReview | null };
}
export type BusinessState = 'queued' | 'collecting' | 'review_pending' | 'approval_pending' | 'published' | 'blocked';
export interface BusinessJob {
  symbol: string; owner: string; fence: number; snapshot: BusinessSnapshot;
}
export interface BusinessPort {
  claim(owner: string): Promise<BusinessJob | null>;
  checkpoint(job: BusinessJob, snapshot: BusinessSnapshot, state: BusinessState, reason: string): Promise<boolean>;
}
