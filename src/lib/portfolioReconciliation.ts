import {
  BROKER_LABELS,
  type Broker,
  type PortfolioStocks,
  type StockItem,
} from '@/config/constants';
import {
  getStockCurrency,
  getStockIdentityKey,
} from '@/utils/stockCurrency';

export type PortfolioCategoryKey = keyof PortfolioStocks;
export type ReconciliationStatus = 'new' | 'changed' | 'unchanged' | 'needs_review';
export type ReconciliationReason =
  | 'new_holding'
  | 'values_changed'
  | 'same_values'
  | 'missing_values'
  | 'broker_required'
  | 'duplicate_in_upload'
  | 'multiple_existing_matches'
  | 'unassigned_existing_match'
  | 'category_change'
  | 'sold_position_match';

export interface ImportHoldingDraft {
  symbol: string;
  name?: string;
  avgCost: number | null;
  shares: number | null;
  currency: 'KRW' | 'USD';
}

export interface ExistingHoldingMatch {
  category: PortfolioCategoryKey;
  index: number;
  stock: StockItem;
}

export interface HoldingFieldChange {
  field: 'avgCost' | 'shares';
  before: number;
  after: number;
}

export interface ReconciliationRow {
  inputIndex: number;
  status: ReconciliationStatus;
  reason: ReconciliationReason;
  draft: ImportHoldingDraft;
  match?: ExistingHoldingMatch;
  candidates: ExistingHoldingMatch[];
  changes: HoldingFieldChange[];
}

export interface ReconciliationSummary {
  added: number;
  updated: number;
  unchanged: number;
  needsReview: number;
  skippedLimit: number;
}

export interface PortfolioImportResult {
  stocks: PortfolioStocks;
  summary: ReconciliationSummary;
}

export interface PortfolioImportCheckpoint {
  id: string;
  createdAt: string;
  source: string;
  stocks: PortfolioStocks;
}

export interface PortfolioVersionChange {
  kind: 'added' | 'updated';
  symbol: string;
  name?: string;
  broker?: Broker;
  category: PortfolioCategoryKey;
  currency: 'KRW' | 'USD';
  avgCost: number | null;
  shares: number | null;
  fields: HoldingFieldChange[];
}

export interface PortfolioImportCommitMeta {
  summary: ReconciliationSummary;
  changes: PortfolioVersionChange[];
  /** 정책 제한·매도 완료 행처럼 reconciliation summary 밖에서 제외된 항목 수 */
  excludedCount?: number;
}

export interface PortfolioVersionEntry extends PortfolioImportCheckpoint {
  kind: 'import' | 'restore';
  summary: ReconciliationSummary;
  changes: PortfolioVersionChange[];
  excludedCount: number;
  restoredAt?: string;
}

export interface PortfolioImportChangeContext {
  broker: Broker | '';
  targetCategory: 'investing' | 'watching';
}

export const MAX_PORTFOLIO_VERSIONS = 20;

export function clonePortfolioStocks(stocks: PortfolioStocks): PortfolioStocks {
  const cloneStock = (stock: StockItem): StockItem => ({
    ...stock,
    buyZones: stock.buyZones ? [...stock.buyZones] : undefined,
    notes: stock.notes ? stock.notes.map((note) => ({ ...note })) : undefined,
  });
  return {
    investing: stocks.investing.filter((stock) => !stock.demo).map(cloneStock),
    watching: stocks.watching.filter((stock) => !stock.demo).map(cloneStock),
    sold: stocks.sold.filter((stock) => !stock.demo).map(cloneStock),
  };
}

export function emptyReconciliationSummary(): ReconciliationSummary {
  return {
    added: 0,
    updated: 0,
    unchanged: 0,
    needsReview: 0,
    skippedLimit: 0,
  };
}

export function buildPortfolioImportChanges<Row extends ReconciliationRow>(
  rows: Row[],
  selectedInputIndices: ReadonlySet<number>,
  resolveContext: (row: Row) => PortfolioImportChangeContext,
): PortfolioVersionChange[] {
  return rows.flatMap((row) => {
    if (!selectedInputIndices.has(row.inputIndex)
      || (row.status !== 'new' && row.status !== 'changed')) {
      return [];
    }

    const context = resolveContext(row);
    const hasPosition = isPositive(row.draft.avgCost) && isPositive(row.draft.shares);
    const category = row.match?.category
      ?? (hasPosition ? context.targetCategory : 'watching');

    return [{
      kind: row.status === 'new' ? 'added' as const : 'updated' as const,
      symbol: normalizedSymbol(row.draft.symbol),
      name: row.draft.name?.trim() || row.match?.stock.name || undefined,
      broker: context.broker || row.match?.stock.broker || undefined,
      category,
      currency: row.draft.currency,
      avgCost: row.draft.avgCost,
      shares: row.draft.shares,
      fields: row.changes.map((change) => ({ ...change })),
    }];
  });
}

function isPortfolioStocks(value: unknown): value is PortfolioStocks {
  if (!value || typeof value !== 'object') return false;
  const stocks = value as Partial<PortfolioStocks>;
  const validStock = (stock: unknown): stock is StockItem => {
    if (!stock || typeof stock !== 'object') return false;
    const candidate = stock as Partial<StockItem>;
    return typeof candidate.symbol === 'string'
      && Number.isFinite(candidate.avgCost)
      && Number.isFinite(candidate.shares)
      && Number.isFinite(candidate.targetReturn)
      && (candidate.broker === undefined
        || (typeof candidate.broker === 'string' && candidate.broker in BROKER_LABELS));
  };
  return Array.isArray(stocks.investing)
    && Array.isArray(stocks.watching)
    && Array.isArray(stocks.sold)
    && stocks.investing.every(validStock)
    && stocks.watching.every(validStock)
    && stocks.sold.every(validStock);
}

/**
 * localStorage/DB에서 읽은 버전 기록을 신뢰 경계에서 정규화한다.
 * 손상된 항목 하나 때문에 현재 포트폴리오까지 하이드레이션 실패하지 않도록 한다.
 */
export function normalizePortfolioVersions(value: unknown): PortfolioVersionEntry[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const entry = candidate as Partial<PortfolioVersionEntry>;
    if (typeof entry.id !== 'string'
      || typeof entry.createdAt !== 'string'
      || typeof entry.source !== 'string'
      || !isPortfolioStocks(entry.stocks)) {
      return [];
    }

    const count = (number: unknown) => Math.max(0, Number(number) || 0);
    const summary = entry.summary && typeof entry.summary === 'object'
      ? {
          added: count(entry.summary.added),
          updated: count(entry.summary.updated),
          unchanged: count(entry.summary.unchanged),
          needsReview: count(entry.summary.needsReview),
          skippedLimit: count(entry.summary.skippedLimit),
        }
      : emptyReconciliationSummary();

    const changes = Array.isArray(entry.changes)
      ? entry.changes.flatMap((rawChange) => {
          if (!rawChange || typeof rawChange !== 'object') return [];
          const change = rawChange as Partial<PortfolioVersionChange>;
          if (typeof change.symbol !== 'string'
            || (change.kind !== 'added' && change.kind !== 'updated')
            || !['investing', 'watching', 'sold'].includes(change.category || '')
            || (change.currency !== 'KRW' && change.currency !== 'USD')) {
            return [];
          }
          const broker = change.broker && change.broker in BROKER_LABELS
            ? change.broker
            : undefined;
          const fields = Array.isArray(change.fields)
            ? change.fields.filter((field): field is HoldingFieldChange =>
                Boolean(field)
                && (field.field === 'avgCost' || field.field === 'shares')
                && Number.isFinite(field.before)
                && Number.isFinite(field.after))
              .map((field) => ({ ...field }))
            : [];
          return [{
            kind: change.kind,
            symbol: change.symbol.trim().toUpperCase(),
            name: typeof change.name === 'string' ? change.name.slice(0, 120) : undefined,
            broker,
            category: change.category as PortfolioCategoryKey,
            currency: change.currency,
            avgCost: Number.isFinite(change.avgCost) ? change.avgCost as number : null,
            shares: Number.isFinite(change.shares) ? change.shares as number : null,
            fields,
          }];
        }).slice(0, 100)
      : [];

    return [{
      id: entry.id,
      createdAt: entry.createdAt,
      source: entry.source.slice(0, 80),
      stocks: clonePortfolioStocks(entry.stocks),
      kind: entry.kind === 'restore' ? 'restore' as const : 'import' as const,
      summary,
      changes,
      excludedCount: Math.max(0, Number(entry.excludedCount) || 0),
      restoredAt: typeof entry.restoredAt === 'string' ? entry.restoredAt : undefined,
    }];
  }).slice(0, MAX_PORTFOLIO_VERSIONS);
}

export function prependPortfolioVersion(
  history: PortfolioVersionEntry[],
  entry: PortfolioVersionEntry,
): PortfolioVersionEntry[] {
  return normalizePortfolioVersions([entry, ...history]);
}

function normalizedSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function isPositive(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function nearlyEqual(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= scale * 1e-9;
}

function allExistingMatches(stocks: PortfolioStocks, symbol: string): ExistingHoldingMatch[] {
  const matches: ExistingHoldingMatch[] = [];
  const identity = getStockIdentityKey(symbol);
  (Object.keys(stocks) as PortfolioCategoryKey[]).forEach((category) => {
    stocks[category].forEach((stock, index) => {
      if (!stock.demo && getStockIdentityKey(stock.symbol) === identity) {
        matches.push({ category, index, stock });
      }
    });
  });
  return matches;
}

function importIdentity(draft: ImportHoldingDraft, broker: Broker | ''): string {
  return `${getStockIdentityKey(draft.symbol)}::${broker || 'unknown'}`;
}

export function reconcilePortfolioImport(
  drafts: ImportHoldingDraft[],
  stocks: PortfolioStocks,
  broker: Broker | '',
  targetCategory: 'investing' | 'watching' = 'investing',
): ReconciliationRow[] {
  const identityCounts = new Map<string, number>();
  drafts.forEach((draft) => {
    const identity = importIdentity(draft, broker);
    identityCounts.set(identity, (identityCounts.get(identity) || 0) + 1);
  });

  return drafts.map((draft, inputIndex) => {
    const symbol = normalizedSymbol(draft.symbol);
    const currency = getStockCurrency(symbol, draft.currency);
    const candidates = allExistingMatches(stocks, symbol);
    const identity = importIdentity(draft, broker);
    const base = {
      inputIndex,
      draft: { ...draft, symbol, currency },
      candidates,
      changes: [] as HoldingFieldChange[],
    };

    if ((identityCounts.get(identity) || 0) > 1) {
      return { ...base, status: 'needs_review', reason: 'duplicate_in_upload' };
    }

    if (targetCategory === 'investing' && (!isPositive(draft.shares) || !isPositive(draft.avgCost))) {
      return { ...base, status: 'needs_review', reason: 'missing_values' };
    }
    if (targetCategory === 'investing' && !broker) {
      return { ...base, status: 'needs_review', reason: 'broker_required' };
    }

    const matchingCandidates = broker
      ? candidates.filter((candidate) => candidate.stock.broker === broker)
      : candidates;

    if (matchingCandidates.length > 1) {
      return { ...base, status: 'needs_review', reason: 'multiple_existing_matches' };
    }

    if (!broker && candidates.length > 1) {
      return { ...base, status: 'needs_review', reason: 'multiple_existing_matches' };
    }

    if (broker && matchingCandidates.length === 0
      && candidates.some((candidate) => !candidate.stock.broker)) {
      return { ...base, status: 'needs_review', reason: 'unassigned_existing_match' };
    }

    const match = matchingCandidates[0];
    if (!match) {
      return { ...base, status: 'new', reason: 'new_holding' };
    }

    if (match.category === 'sold') {
      return { ...base, match, status: 'needs_review', reason: 'sold_position_match' };
    }
    if (match.category !== targetCategory) {
      return { ...base, match, status: 'needs_review', reason: 'category_change' };
    }

    const changes: HoldingFieldChange[] = [];
    if (isPositive(draft.avgCost) && !nearlyEqual(match.stock.avgCost, draft.avgCost)) {
      changes.push({ field: 'avgCost', before: match.stock.avgCost, after: draft.avgCost });
    }
    if (isPositive(draft.shares) && !nearlyEqual(match.stock.shares, draft.shares)) {
      changes.push({ field: 'shares', before: match.stock.shares, after: draft.shares });
    }

    if (changes.length === 0) {
      return { ...base, match, status: 'unchanged', reason: 'same_values' };
    }
    return { ...base, match, changes, status: 'changed', reason: 'values_changed' };
  });
}

export function applyPortfolioReconciliation(
  stocks: PortfolioStocks,
  rows: ReconciliationRow[],
  selectedInputIndices: ReadonlySet<number>,
  broker: Broker | '',
  targetCategory: 'investing' | 'watching' = 'investing',
  maxHoldings = 50,
): PortfolioImportResult {
  const next = clonePortfolioStocks(stocks);
  const summary: ReconciliationSummary = {
    added: 0,
    updated: 0,
    unchanged: rows.filter((row) => row.status === 'unchanged').length,
    needsReview: rows.filter((row) => row.status === 'needs_review').length,
    skippedLimit: 0,
  };

  rows.forEach((row) => {
    if (!selectedInputIndices.has(row.inputIndex)) return;

    if (row.status === 'new') {
      const total = next.investing.length + next.watching.length + next.sold.length;
      if (total >= maxHoldings) {
        summary.skippedLimit += 1;
        return;
      }
      const hasPosition = isPositive(row.draft.avgCost) && isPositive(row.draft.shares);
      const category = hasPosition ? targetCategory : 'watching';
      const currency = getStockCurrency(row.draft.symbol, row.draft.currency);
      next[category].push({
        symbol: normalizedSymbol(row.draft.symbol),
        name: row.draft.name?.trim() || undefined,
        currency,
        avgCost: row.draft.avgCost || 0,
        shares: row.draft.shares || 0,
        targetReturn: hasPosition ? 10 : 0,
        purchaseRate: currency === 'USD' ? undefined : 0,
        buyBelow: category === 'watching' ? 0 : undefined,
        broker: broker || undefined,
      });
      summary.added += 1;
      return;
    }

    if (row.status === 'changed' && row.match) {
      const existing = next[row.match.category][row.match.index];
      if (!existing) return;
      const update: StockItem = {
        ...existing,
        currency: getStockCurrency(row.draft.symbol, row.draft.currency),
      };
      row.changes.forEach((change) => {
        update[change.field] = change.after;
      });
      next[row.match.category][row.match.index] = update;
      summary.updated += 1;
    }
  });

  return { stocks: next, summary };
}
