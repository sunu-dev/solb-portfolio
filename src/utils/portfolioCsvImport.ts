import {
  BROKER_LABELS,
  type Broker,
  type PortfolioStocks,
} from '@/config/constants';
import {
  applyPortfolioReconciliation,
  clonePortfolioStocks,
  reconcilePortfolioImport,
  type ImportHoldingDraft,
  type ReconciliationRow,
  type ReconciliationSummary,
} from '@/lib/portfolioReconciliation';

export type CsvTargetCategory = 'investing' | 'watching';

export interface PortfolioCsvRow {
  rowNumber: number;
  draft: ImportHoldingDraft;
  broker: Broker | '';
  category: CsvTargetCategory | null;
}

export interface PortfolioCsvIssue {
  rowNumber?: number;
  message: string;
}

export interface PortfolioCsvParseResult {
  rows: PortfolioCsvRow[];
  issues: PortfolioCsvIssue[];
  skippedSold: number;
}

export interface PortfolioCsvReconciliationRow extends ReconciliationRow {
  csvRowNumber: number;
  broker: Broker | '';
  targetCategory: CsvTargetCategory;
}

export interface PortfolioCsvApplyResult {
  stocks: PortfolioStocks;
  summary: ReconciliationSummary;
}

const MAX_IMPORT_ROWS = 100;

const HEADER_ALIASES = {
  category: ['구분', '상태', 'category'],
  symbol: ['종목코드', '종목코드티커', '티커', 'symbol', 'ticker'],
  name: ['종목명', '이름', 'name'],
  broker: ['증권사', '계좌', 'broker'],
  shares: ['수량', '보유수량', '주식수', 'shares', 'quantity', 'qty'],
  avgCost: ['평균단가', '평균매수가', '평단가', '평단', 'avgcost', 'averagecost'],
} as const;

type HeaderKey = keyof typeof HEADER_ALIASES;

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '');
}

function parseCsvTable(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell.trim() === '') {
      cell = '';
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (quoted) {
    throw new Error('따옴표가 닫히지 않은 셀이 있어요.');
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function findHeaderIndexes(headers: string[]): Partial<Record<HeaderKey, number>> {
  const normalizedHeaders = headers.map(normalizeHeader);
  const indexes: Partial<Record<HeaderKey, number>> = {};

  (Object.keys(HEADER_ALIASES) as HeaderKey[]).forEach((key) => {
    const aliases = new Set(HEADER_ALIASES[key].map(normalizeHeader));
    const index = normalizedHeaders.findIndex((header) => aliases.has(header));
    if (index >= 0) indexes[key] = index;
  });

  return indexes;
}

function readCell(row: string[], index: number | undefined): string {
  return index == null ? '' : (row[index] || '').trim();
}

function parseNonNegativeNumber(value: string): number | null | 'invalid' {
  if (!value.trim()) return null;
  const normalized = value
    .trim()
    .replace(/[,\s]/g, '')
    .replace(/^[₩$]/, '')
    .replace(/[원주]$/, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 'invalid';
  return parsed;
}

function parseCategory(value: string): CsvTargetCategory | 'sold' | 'invalid' | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  if (['보유', '투자중', '투자', 'investing', 'holding', 'holdings'].includes(normalized)) {
    return 'investing';
  }
  if (['관심', '관심종목', 'watching', 'watchlist'].includes(normalized)) {
    return 'watching';
  }
  if (['정리', '매도', '매도완료', 'sold', 'closed'].includes(normalized)) {
    return 'sold';
  }
  return 'invalid';
}

const BROKER_BY_NAME = new Map<string, Broker>(
  (Object.entries(BROKER_LABELS) as [Broker, string][])
    .flatMap(([broker, label]) => [
      [normalizeHeader(broker), broker] as const,
      [normalizeHeader(label), broker] as const,
      [normalizeHeader(label.replace('증권', '')), broker] as const,
    ]),
);

function parseBroker(value: string): Broker | '' | 'invalid' {
  const normalized = normalizeHeader(value);
  if (!normalized) return '';
  return BROKER_BY_NAME.get(normalized) || 'invalid';
}

function inferCurrency(symbol: string): 'KRW' | 'USD' {
  return /^\d{6}(?:\.(?:KS|KQ))?$/i.test(symbol) ? 'KRW' : 'USD';
}

function normalizeSymbol(value: string): string {
  const trimmed = value.trim();
  const withoutFormulaEscape = trimmed.startsWith("'") ? trimmed.slice(1) : trimmed;
  return withoutFormulaEscape.replace(/\s/g, '').toUpperCase();
}

export function parsePortfolioImportCsv(source: string): PortfolioCsvParseResult {
  const table = parseCsvTable(source.replace(/^\uFEFF/, ''));
  if (table.length === 0) throw new Error('CSV 파일이 비어 있어요.');

  const indexes = findHeaderIndexes(table[0]);
  if (indexes.symbol == null || indexes.shares == null || indexes.avgCost == null) {
    throw new Error('종목코드, 수량, 평균단가 열이 필요해요.');
  }

  const dataRows = table.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`한 번에 최대 ${MAX_IMPORT_ROWS}개 종목까지 가져올 수 있어요.`);
  }

  const rows: PortfolioCsvRow[] = [];
  const issues: PortfolioCsvIssue[] = [];
  let skippedSold = 0;

  dataRows.forEach((row, dataIndex) => {
    const rowNumber = dataIndex + 2;
    const symbol = normalizeSymbol(readCell(row, indexes.symbol));
    const rawShares = readCell(row, indexes.shares);
    const rawAvgCost = readCell(row, indexes.avgCost);
    const shares = parseNonNegativeNumber(rawShares);
    const avgCost = parseNonNegativeNumber(rawAvgCost);
    const category = parseCategory(readCell(row, indexes.category));
    const broker = parseBroker(readCell(row, indexes.broker));

    if (!symbol) {
      issues.push({ rowNumber, message: '종목코드가 없어 제외했어요.' });
      return;
    }
    if (shares === 'invalid' || avgCost === 'invalid') {
      issues.push({ rowNumber, message: '수량 또는 평균단가가 올바른 숫자가 아니어서 제외했어요.' });
      return;
    }
    if (category === 'invalid') {
      issues.push({ rowNumber, message: '구분 값이 보유·관심·정리 중 하나가 아니어서 제외했어요.' });
      return;
    }
    if (category === 'sold') {
      skippedSold += 1;
      issues.push({ rowNumber, message: '정리 종목은 실수로 재등록되지 않도록 제외했어요.' });
      return;
    }

    const resolvedBroker: Broker | '' = broker === 'invalid' ? '' : broker;
    if (broker === 'invalid') {
      issues.push({ rowNumber, message: '증권사를 인식하지 못했어요. 아래에서 증권사를 선택해주세요.' });
    }

    rows.push({
      rowNumber,
      broker: resolvedBroker,
      category,
      draft: {
        symbol,
        name: readCell(row, indexes.name) || undefined,
        shares,
        avgCost,
        currency: inferCurrency(symbol),
      },
    });
  });

  if (rows.length === 0) {
    throw new Error(issues[0]?.message || '가져올 수 있는 종목이 없어요.');
  }

  return { rows, issues, skippedSold };
}

interface ResolvedCsvContext {
  broker: Broker | '';
  targetCategory: CsvTargetCategory;
}

function resolveContext(
  row: PortfolioCsvRow,
  fallbackBroker: Broker | '',
  fallbackCategory: CsvTargetCategory,
): ResolvedCsvContext {
  return {
    broker: row.broker || fallbackBroker,
    targetCategory: row.category || fallbackCategory,
  };
}

function contextKey(context: ResolvedCsvContext): string {
  return `${context.broker || 'unknown'}::${context.targetCategory}`;
}

export function reconcilePortfolioCsvImport(
  csvRows: PortfolioCsvRow[],
  stocks: PortfolioStocks,
  fallbackBroker: Broker | '',
  fallbackCategory: CsvTargetCategory = 'investing',
): PortfolioCsvReconciliationRow[] {
  const groups = new Map<string, Array<{ csvRow: PortfolioCsvRow; inputIndex: number; context: ResolvedCsvContext }>>();
  const identityCounts = new Map<string, number>();

  csvRows.forEach((csvRow, inputIndex) => {
    const context = resolveContext(csvRow, fallbackBroker, fallbackCategory);
    const key = contextKey(context);
    const group = groups.get(key) || [];
    group.push({ csvRow, inputIndex, context });
    groups.set(key, group);
    const identity = `${csvRow.draft.symbol.trim().toUpperCase()}::${context.broker || 'unknown'}`;
    identityCounts.set(identity, (identityCounts.get(identity) || 0) + 1);
  });

  const reconciled: PortfolioCsvReconciliationRow[] = [];
  groups.forEach((group) => {
    const { broker, targetCategory } = group[0].context;
    const rows = reconcilePortfolioImport(
      group.map(({ csvRow }) => csvRow.draft),
      stocks,
      broker,
      targetCategory,
    );
    rows.forEach((row, groupIndex) => {
      const source = group[groupIndex];
      reconciled.push({
        ...row,
        inputIndex: source.inputIndex,
        csvRowNumber: source.csvRow.rowNumber,
        broker,
        targetCategory,
      });
    });
  });

  return reconciled
    .map((row) => {
      const identity = `${row.draft.symbol.trim().toUpperCase()}::${row.broker || 'unknown'}`;
      if ((identityCounts.get(identity) || 0) <= 1) return row;
      return {
        ...row,
        status: 'needs_review' as const,
        reason: 'duplicate_in_upload' as const,
        match: undefined,
        changes: [],
      };
    })
    .sort((left, right) => left.inputIndex - right.inputIndex);
}

export function applyPortfolioCsvImport(
  stocks: PortfolioStocks,
  rows: PortfolioCsvReconciliationRow[],
  selectedInputIndices: ReadonlySet<number>,
  maxHoldings = 50,
): PortfolioCsvApplyResult {
  let next = clonePortfolioStocks(stocks);
  const summary: ReconciliationSummary = {
    added: 0,
    updated: 0,
    unchanged: 0,
    needsReview: 0,
    skippedLimit: 0,
  };
  const groups = new Map<string, PortfolioCsvReconciliationRow[]>();

  rows.forEach((row) => {
    const key = contextKey({ broker: row.broker, targetCategory: row.targetCategory });
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  });

  groups.forEach((group) => {
    const { broker, targetCategory } = group[0];
    const result = applyPortfolioReconciliation(
      next,
      group,
      selectedInputIndices,
      broker,
      targetCategory,
      maxHoldings,
    );
    next = result.stocks;
    summary.added += result.summary.added;
    summary.updated += result.summary.updated;
    summary.unchanged += result.summary.unchanged;
    summary.needsReview += result.summary.needsReview;
    summary.skippedLimit += result.summary.skippedLimit;
  });

  return { stocks: next, summary };
}

export function buildPortfolioImportTemplateCsv(): string {
  return '\uFEFF"구분","종목코드","종목명","증권사","수량","평균단가"\r\n';
}
