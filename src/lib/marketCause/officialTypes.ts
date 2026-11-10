/** Public contract contains only official policy facts and edited conditional education. */
export type PolicyAuthority = 'fed' | 'bok';
export interface PolicyRelease {
  authority: PolicyAuthority;
  url: string;
  publishedAt: string;
  observedAt: string;
  contentHash: string;
  policy: string;
  action: 'hold' | 'raise' | 'cut';
  lower: string;
  upper: string;
  /** Kept privately for reproducible parsing, never rendered as HTML. */
  evidence: string;
}
export interface OfficialSnapshot {
  status: 'verified' | 'withheld' | 'source_unavailable';
  checkedAt: string;
  release: PolicyRelease | null;
  reason: string | null;
  corrected: boolean;
}
export interface OfficialPolicyCard {
  id: string;
  authority: PolicyAuthority;
  market: 'kr' | 'us';
  title: string;
  summary: string;
  meaning: string;
  path: string[];
  condition: string;
  watch: string;
  publishedAt: string;
  checkedAt: string;
  sourceUrl: string;
  corrected: boolean;
}
export interface OfficialPolicyFeed {
  cards: OfficialPolicyCard[];
  warnings: string[];
}
