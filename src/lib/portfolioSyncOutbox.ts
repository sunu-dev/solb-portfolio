import type { PortfolioStocks, StockItem } from '@/config/constants';
import {
  clonePortfolioStocks,
  emptyReconciliationSummary,
  normalizePortfolioVersions,
  prependPortfolioVersion,
  type PortfolioVersionEntry,
} from '@/lib/portfolioReconciliation';
import {
  pruneForLongTerm,
  type DailySnapshot,
  type StockSnapshot,
} from '@/utils/dailySnapshot';

export const PORTFOLIO_SYNC_OUTBOX_PREFIX = 'solb_portfolio_sync_outbox_v1:';
const OUTBOX_SCHEMA = 'joobi-portfolio-sync-outbox-v1';

export interface PortfolioSyncPayload {
  stocks: PortfolioStocks;
  snapshots: DailySnapshot[];
  history: PortfolioVersionEntry[];
}

export interface PortfolioSyncOutbox {
  schema: typeof OUTBOX_SCHEMA;
  userId: string;
  queuedAt: string;
  baseUpdatedAt: string | null;
  payload: PortfolioSyncPayload;
}

export type PortfolioRecoveryChoice = 'remote' | 'outbox' | 'conflict';

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function browserStorage(): StorageLike | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function isStockItem(value: unknown): value is StockItem {
  if (!value || typeof value !== 'object') return false;
  const stock = value as Partial<StockItem>;
  return typeof stock.symbol === 'string'
    && Number.isFinite(stock.avgCost)
    && Number.isFinite(stock.shares)
    && Number.isFinite(stock.targetReturn);
}

function isPortfolioStocks(value: unknown): value is PortfolioStocks {
  if (!value || typeof value !== 'object') return false;
  const stocks = value as Partial<PortfolioStocks>;
  return Array.isArray(stocks.investing)
    && stocks.investing.every(isStockItem)
    && Array.isArray(stocks.watching)
    && stocks.watching.every(isStockItem)
    && Array.isArray(stocks.sold)
    && stocks.sold.every(isStockItem);
}

function isStockSnapshot(value: unknown): value is StockSnapshot {
  if (!value || typeof value !== 'object') return false;
  const stock = value as Partial<StockSnapshot>;
  return typeof stock.symbol === 'string'
    && Number.isFinite(stock.avgCost)
    && Number.isFinite(stock.shares)
    && Number.isFinite(stock.currentPrice);
}

function isDailySnapshot(value: unknown): value is DailySnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<DailySnapshot>;
  return typeof snapshot.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)
    && Number.isFinite(snapshot.totalValue)
    && Number.isFinite(snapshot.totalCost)
    && Array.isArray(snapshot.stocks)
    && snapshot.stocks.every(isStockSnapshot);
}

export function normalizePortfolioSyncPayload(value: unknown): PortfolioSyncPayload | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Partial<PortfolioSyncPayload>;
  if (!isPortfolioStocks(payload.stocks)
    || !Array.isArray(payload.snapshots)
    || !payload.snapshots.every(isDailySnapshot)
    || !Array.isArray(payload.history)) {
    return null;
  }
  return {
    stocks: clonePortfolioStocks(payload.stocks),
    snapshots: payload.snapshots.map((snapshot) => ({
      ...snapshot,
      stocks: snapshot.stocks.map((stock) => ({ ...stock })),
    })),
    history: normalizePortfolioVersions(payload.history),
  };
}

function canonicalStringify(value: unknown): string {
  const canonicalize = (child: unknown): unknown => {
    if (Array.isArray(child)) return child.map(canonicalize);
    if (!child || typeof child !== 'object') return child;
    return Object.fromEntries(
      Object.entries(child as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  };
  return JSON.stringify(canonicalize(value));
}

export function portfolioSyncPayloadSignature(payload: PortfolioSyncPayload): string {
  return canonicalStringify(normalizePortfolioSyncPayload(payload));
}

function outboxKey(userId: string): string {
  return `${PORTFOLIO_SYNC_OUTBOX_PREFIX}${userId}`;
}

export function readPortfolioSyncOutbox(
  userId: string,
  storage: StorageLike | null = browserStorage(),
): PortfolioSyncOutbox | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(outboxKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PortfolioSyncOutbox>;
    const payload = normalizePortfolioSyncPayload(parsed.payload);
    if (parsed.schema !== OUTBOX_SCHEMA
      || parsed.userId !== userId
      || typeof parsed.queuedAt !== 'string'
      || (parsed.baseUpdatedAt !== null && typeof parsed.baseUpdatedAt !== 'string')
      || !payload) {
      storage.removeItem(outboxKey(userId));
      return null;
    }
    return {
      schema: OUTBOX_SCHEMA,
      userId,
      queuedAt: parsed.queuedAt,
      baseUpdatedAt: parsed.baseUpdatedAt,
      payload,
    };
  } catch {
    try { storage.removeItem(outboxKey(userId)); } catch { /* ignore */ }
    return null;
  }
}

export function writePortfolioSyncOutbox(
  userId: string,
  payload: PortfolioSyncPayload,
  baseUpdatedAt: string | null,
  storage: StorageLike | null = browserStorage(),
): PortfolioSyncOutbox | null {
  if (!storage) return null;
  const normalized = normalizePortfolioSyncPayload(payload);
  if (!normalized) return null;
  const outbox: PortfolioSyncOutbox = {
    schema: OUTBOX_SCHEMA,
    userId,
    queuedAt: new Date().toISOString(),
    baseUpdatedAt,
    payload: normalized,
  };
  try {
    storage.setItem(outboxKey(userId), JSON.stringify(outbox));
    return outbox;
  } catch {
    return null;
  }
}

export function rebasePortfolioSyncOutbox(
  userId: string,
  baseUpdatedAt: string | null,
  storage: StorageLike | null = browserStorage(),
): PortfolioSyncOutbox | null {
  const outbox = readPortfolioSyncOutbox(userId, storage);
  if (!outbox || !storage) return null;
  const rebased = { ...outbox, baseUpdatedAt };
  try {
    storage.setItem(outboxKey(userId), JSON.stringify(rebased));
    return rebased;
  } catch {
    return null;
  }
}

export function clearPortfolioSyncOutbox(
  userId: string,
  expectedPayload?: PortfolioSyncPayload,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (!storage) return false;
  const current = readPortfolioSyncOutbox(userId, storage);
  if (!current) return true;
  if (expectedPayload
    && portfolioSyncPayloadSignature(current.payload)
      !== portfolioSyncPayloadSignature(expectedPayload)) {
    return false;
  }
  try {
    storage.removeItem(outboxKey(userId));
    return true;
  } catch {
    return false;
  }
}

export function choosePortfolioRecovery(
  outbox: PortfolioSyncOutbox | null,
  remoteUpdatedAt: string | null,
  remotePayload: PortfolioSyncPayload,
): PortfolioRecoveryChoice {
  if (!outbox) return 'remote';
  if (portfolioSyncPayloadSignature(outbox.payload)
    === portfolioSyncPayloadSignature(remotePayload)) {
    return 'remote';
  }
  if (outbox.baseUpdatedAt === remoteUpdatedAt) return 'outbox';
  return 'conflict';
}

/**
 * 충돌에서 사용자가 로컬 변경 유지를 선택해도 원격 기록을 조용히 버리지 않는다.
 * 원격 종목은 복구 지점으로 남기고, 스냅샷과 기존 복구 이력은 합친 뒤 저장한다.
 */
export function mergeLocalChoiceWithRemote(
  local: PortfolioSyncPayload,
  remote: PortfolioSyncPayload,
  options: { checkpointId?: string; createdAt?: string } = {},
): PortfolioSyncPayload {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const histories = normalizePortfolioVersions([
    ...local.history,
    ...remote.history,
  ]);
  const stocksDiffer = canonicalStringify(local.stocks)
    !== canonicalStringify(remote.stocks);
  const history = stocksDiffer
    ? prependPortfolioVersion(histories, {
        id: options.checkpointId
          ?? `conflict-cloud-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt,
        source: '충돌 전 클라우드 기록',
        stocks: remote.stocks,
        kind: 'restore',
        summary: emptyReconciliationSummary(),
        changes: [],
        excludedCount: 0,
      })
    : histories;

  return {
    stocks: clonePortfolioStocks(local.stocks),
    snapshots: pruneForLongTerm([
      ...remote.snapshots,
      ...local.snapshots,
    ]),
    history,
  };
}
