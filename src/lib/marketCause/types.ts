/** Server-owned observations. Never deserialize a model response into these types. */
export type Metric = 'revenue' | 'net_income' | 'operating_cash_flow' | 'capital_expenditure' | 'eps' | 'policy_rate';
export type Unit = 'USD' | 'KRW' | 'USD/share' | 'percent';
export type FactRole = 'actual' | 'consensus' | 'guidance';
export interface SourceDocument {
  id: string;
  sourceId: string;
  url: string;
  hash: string;
  publishedAt: string | null;
  precision: 'instant' | 'day' | 'unknown';
  firstSeenAt: string;
  retrievedAt: string;
  status: 'active' | 'withdrawn' | 'superseded';
  /** Exact decoded structured cells, supplied by a source adapter, not an LLM. */
  cells: Record<string, string>;
}
export interface FactInput {
  id: string; documentId: string; locator: string;
  entityId: string; metric: Metric; unit: Unit;
  rawValue: string; scale: 0 | 3 | 6 | 8 | 9 | 12;
  periodStart: string; periodEnd: string;
  basis: 'gaap' | 'adjusted' | 'not_applicable';
  role: FactRole;
  /** Corporate scope and definition are adapter-controlled, not inferred from a label. */
  scope: 'consolidated'; definition: string;
}
export interface NormalizedFact extends FactInput {
  value: string;
  provenanceHash: string;
}
export type Candidate =
  | { id: string; kind: 'fact'; factId: string }
  | { id: string; kind: 'versus_consensus'; actualId: string; expectedId: string }
  | { id: string; kind: 'mechanism'; rule: 'capital_spending_cash'; factIds: string[] };
export interface Context {
  asOf: string;
  /** Events are bounded, with explicit observation interval, not a generic today. */
  windowStart: string;
  entityIds: string[];
}
export interface CheckedClaim {
  id: string;
  kind: Candidate['kind'];
  text: string;
  factIds: string[];
  documentIds: string[];
  interpretation: boolean;
}
export interface PublicationDecision {
  disposition: 'facts_only' | 'explained' | 'conflicting' | 'withdrawn';
  claims: CheckedClaim[];
  rejected: { id: string; reasons: string[] }[];
  reasonCodes: string[];
  /** Hash binds decision to the exact evidence, policy and event context. */
  inputHash: string;
  policyVersion: string;
}
