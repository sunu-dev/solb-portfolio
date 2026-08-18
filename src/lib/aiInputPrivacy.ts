export interface PublicAiAnalysisInput {
  symbol: string;
  koreanName?: string;
  currency?: 'KRW' | 'USD';
  price: number;
  change?: number;
  changePercent: number;
  rsi?: number | string;
  trend?: string;
  cross?: string;
  pattern?: string;
  bollingerStatus?: string;
  macdStatus?: string;
  volRatio?: number;
  recentNews?: string;
  mentorId?: string;
  per?: number;
  eps?: number;
  week52High?: number;
  week52Low?: number;
  sector?: string;
  description?: string;
  timeSeriesContext?: string;
}

export const PRIVATE_AI_ANALYSIS_FIELDS = [
  'avgCost',
  'shares',
  'targetReturn',
  'stopLoss',
  'stopLossPct',
  'weight',
  'buyBelow',
  'purchaseRate',
  'currentUsdKrw',
  'category',
  'investorType',
  'userNotes',
] as const;

const optionalNumberFields = [
  'change',
  'volRatio',
  'per',
  'eps',
  'week52High',
  'week52Low',
] as const;

const optionalStringLimits = {
  koreanName: 100,
  trend: 100,
  cross: 100,
  pattern: 100,
  bollingerStatus: 100,
  macdStatus: 100,
  recentNews: 12_000,
  mentorId: 64,
  sector: 100,
  description: 300,
  timeSeriesContext: 12_000,
} as const;

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function limitedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

/**
 * 무료 AI 서비스로 보낼 수 있는 공개 시장 데이터만 allowlist로 복사한다.
 * 개인 보유 정보와 사용자 메모는 입력에 있어도 결과 객체에 포함되지 않는다.
 */
export function toPublicAiAnalysisInput(input: unknown): PublicAiAnalysisInput | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const symbol = limitedString(raw.symbol, 32);
  if (!symbol || !finiteNumber(raw.price) || !finiteNumber(raw.changePercent)) return null;

  const result: PublicAiAnalysisInput = {
    symbol,
    price: raw.price,
    changePercent: raw.changePercent,
  };
  if (raw.currency !== undefined) {
    if (raw.currency !== 'KRW' && raw.currency !== 'USD') return null;
    result.currency = raw.currency;
  }

  for (const field of optionalNumberFields) {
    const value = raw[field];
    if (value !== undefined && !finiteNumber(value)) return null;
    if (finiteNumber(value)) result[field] = value;
  }

  const rsi = raw.rsi;
  if (finiteNumber(rsi)) {
    result.rsi = rsi;
  } else {
    const normalizedRsi = limitedString(rsi, 20);
    if (normalizedRsi) result.rsi = normalizedRsi;
  }

  for (const [field, maxLength] of Object.entries(optionalStringLimits) as Array<
    [keyof typeof optionalStringLimits, number]
  >) {
    const value = limitedString(raw[field], maxLength);
    if (value) result[field] = value;
  }

  return result;
}
