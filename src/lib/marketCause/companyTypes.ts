export interface CompanyExplanation {
  id: string; symbol: string; name: string; title: string;
  kind: 'financial_comparison' | 'financial_story' | 'company_statement';
  summary: string; meaning: string; path: string; condition: string; next: string;
  publishedAt: string; checkedAt: string; corrected: boolean;
  sources: { label: string; url: string }[];
  comparison?: { label: string; current: string; previous: string; currentPeriod: string; previousPeriod: string; unit: string };
  comparisons?: NonNullable<CompanyExplanation['comparison']>[];
}
export interface CompanyExplanationFeed { cards: CompanyExplanation[]; warnings: string[] }
