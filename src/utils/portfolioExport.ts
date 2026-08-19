import {
  BROKER_LABELS,
  type PortfolioStocks,
  type StockCategory,
  type StockItem,
} from '@/config/constants';
import {
  normalizePortfolioSyncPayload,
  type PortfolioSyncPayload,
} from '@/lib/portfolioSyncOutbox';
import type { PortfolioVersionEntry } from '@/lib/portfolioReconciliation';
import { pruneForLongTerm, type DailySnapshot } from '@/utils/dailySnapshot';

const CATEGORY_LABELS: Record<Exclude<StockCategory, 'all'>, string> = {
  investing: '보유',
  watching: '관심',
  sold: '정리',
};

const CSV_HEADERS = [
  '구분',
  '종목코드',
  '종목명',
  '증권사',
  '수량',
  '평균단가',
  '매수시환율',
  '사용자설정목표수익률',
  '메모',
] as const;

function neutralizeSpreadsheetFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number | null | undefined): string {
  const safe = neutralizeSpreadsheetFormula(value == null ? '' : String(value));
  return `"${safe.replaceAll('"', '""')}"`;
}

function noteText(stock: StockItem): string {
  return (stock.notes || []).map((note) => `${note.date} ${note.emoji} ${note.text}`).join(' | ');
}

export function buildPortfolioCsv(stocks: PortfolioStocks): string {
  const rows: string[][] = [];
  for (const category of ['investing', 'watching', 'sold'] as const) {
    for (const stock of stocks[category] || []) {
      if (stock.demo) continue;
      rows.push([
        CATEGORY_LABELS[category],
        stock.symbol,
        stock.name || '',
        stock.broker ? BROKER_LABELS[stock.broker] : '',
        String(stock.shares || 0),
        String(stock.avgCost || 0),
        stock.purchaseRate == null ? '' : String(stock.purchaseRate),
        String(stock.targetReturn || 0),
        noteText(stock),
      ]);
    }
  }

  return `\uFEFF${[CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

export interface ParsedPortfolioBackup {
  sourceSchema: 'joobi-portfolio-export-v1' | 'joobi-portfolio-backup-v2';
  payload: PortfolioSyncPayload;
}

export function buildPortfolioJson(
  stocks: PortfolioStocks,
  dailySnapshots: DailySnapshot[] = [],
  portfolioImportHistory: PortfolioVersionEntry[] = [],
): string {
  const withoutDemo: PortfolioStocks = {
    investing: (stocks.investing || []).filter((stock) => !stock.demo),
    watching: (stocks.watching || []).filter((stock) => !stock.demo),
    sold: (stocks.sold || []).filter((stock) => !stock.demo),
  };
  return JSON.stringify({
    schema: 'joobi-portfolio-backup-v2',
    exportedAt: new Date().toISOString(),
    stocks: withoutDemo,
    dailySnapshots: pruneForLongTerm(dailySnapshots),
    portfolioImportHistory,
  }, null, 2);
}

export function parsePortfolioBackupJson(text: string): ParsedPortfolioBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('JSON 파일 형식이 올바르지 않아요.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('주비 기록 파일을 확인할 수 없어요.');
  }
  const record = parsed as Record<string, unknown>;
  const schema = record.schema;
  if (schema !== 'joobi-portfolio-backup-v2'
    && schema !== 'joobi-portfolio-export-v1') {
    throw new Error('지원하지 않는 주비 기록 파일이에요.');
  }

  const payload = normalizePortfolioSyncPayload({
    stocks: record.stocks,
    snapshots: schema === 'joobi-portfolio-backup-v2'
      ? record.dailySnapshots
      : [],
    history: schema === 'joobi-portfolio-backup-v2'
      ? record.portfolioImportHistory
      : [],
  });
  if (!payload) {
    throw new Error('종목이나 장기 기록이 손상되어 복원할 수 없어요.');
  }
  return {
    sourceSchema: schema,
    payload,
  };
}
