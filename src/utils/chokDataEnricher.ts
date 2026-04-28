/**
 * AI 촉 universe 데이터 enricher.
 *
 * 목적: AI에 실시간 객관 수치(가격, PER, 52주 위치, 모멘텀)를 주입해
 *      "데이터 없는 저평가" 환각을 차단.
 *
 * 데이터 소스: Finnhub /stock/metric (free tier).
 * 캐시: 모듈 레벨 in-memory, TTL 24h (PER/52w는 분 단위로 안 변함).
 * 호출 비용: 43종목 × 1 API call = 43 calls. 무료 tier 60/min 안전.
 */

import { CHOK_UNIVERSE } from '@/config/chokUniverse';

export interface EnrichedStockData {
  symbol: string;
  /** 현재가 (USD) — null이면 데이터 없음 */
  currentPrice: number | null;
  /** TTM PER — null이면 음수/없음 */
  peRatio: number | null;
  /** 52주 최고/최저 */
  weekHigh52: number | null;
  weekLow52: number | null;
  /** 52주 위치 0~100 (저점 0, 고점 100) */
  week52Position: number | null;
  /** 1년 수익률 % */
  yearReturn: number | null;
  /** 30일 모멘텀 % (Finnhub priceReturnDaily 기반) */
  month1Return: number | null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
let cache: { data: EnrichedStockData[]; ts: number } | null = null;

interface FinnhubMetric {
  metric?: {
    '52WeekHigh'?: number;
    '52WeekLow'?: number;
    '52WeekPriceReturnDaily'?: number;
    'monthToDatePriceReturnDaily'?: number;
    '13WeekPriceReturnDaily'?: number;
    'peTTM'?: number;
    'peBasicExclExtraTTM'?: number;
    'peNormalizedAnnual'?: number;
  };
}

interface FinnhubQuote {
  c?: number;
  pc?: number;
}

async function fetchOne(symbol: string, apiKey: string): Promise<EnrichedStockData> {
  const fallback: EnrichedStockData = {
    symbol,
    currentPrice: null, peRatio: null,
    weekHigh52: null, weekLow52: null, week52Position: null,
    yearReturn: null, month1Return: null,
  };
  try {
    const [metricRes, quoteRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`, { cache: 'no-store' }),
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`, { cache: 'no-store' }),
    ]);
    const metric = (await metricRes.json()) as FinnhubMetric;
    const quote = (await quoteRes.json()) as FinnhubQuote;

    const m = metric.metric || {};
    const currentPrice = typeof quote?.c === 'number' && quote.c > 0 ? quote.c : null;
    const high52 = typeof m['52WeekHigh'] === 'number' ? m['52WeekHigh'] : null;
    const low52 = typeof m['52WeekLow'] === 'number' ? m['52WeekLow'] : null;
    let position52: number | null = null;
    if (currentPrice && high52 && low52 && high52 > low52) {
      position52 = ((currentPrice - low52) / (high52 - low52)) * 100;
    }
    const peRaw = m['peTTM'] ?? m['peBasicExclExtraTTM'] ?? m['peNormalizedAnnual'];
    const peRatio = typeof peRaw === 'number' && peRaw > 0 && peRaw < 1000 ? peRaw : null;
    const yearReturn = typeof m['52WeekPriceReturnDaily'] === 'number' ? m['52WeekPriceReturnDaily'] : null;
    const month1Return = typeof m['monthToDatePriceReturnDaily'] === 'number' ? m['monthToDatePriceReturnDaily'] : null;

    return {
      symbol,
      currentPrice,
      peRatio,
      weekHigh52: high52,
      weekLow52: low52,
      week52Position: position52,
      yearReturn,
      month1Return,
    };
  } catch {
    return fallback;
  }
}

/**
 * Universe 전체 enriched 데이터 반환. 24h 캐시.
 * apiKey 없으면 모든 필드 null인 stub 반환 → AI는 데이터 없음 모드로 동작.
 */
export async function enrichUniverse(): Promise<EnrichedStockData[]> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS) return cache.data;

  const apiKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
  if (!apiKey) {
    return CHOK_UNIVERSE.map(u => ({
      symbol: u.symbol,
      currentPrice: null, peRatio: null,
      weekHigh52: null, weekLow52: null, week52Position: null,
      yearReturn: null, month1Return: null,
    }));
  }

  // 동시 12개씩 batch — Finnhub 60/min 제한 안전 (총 ~7s)
  const BATCH = 12;
  const results: EnrichedStockData[] = [];
  for (let i = 0; i < CHOK_UNIVERSE.length; i += BATCH) {
    const slice = CHOK_UNIVERSE.slice(i, i + BATCH);
    const batchResults = await Promise.all(slice.map(s => fetchOne(s.symbol, apiKey)));
    results.push(...batchResults);
  }

  cache = { data: results, ts: now };
  return results;
}

/** 프롬프트용 한 줄 요약 — 종목당 1줄로 압축 */
export function formatStockLine(
  data: EnrichedStockData,
  krName: string,
  sector: string,
  sectorLabelKr: string,
): string {
  const parts: string[] = [`${data.symbol}(${krName}/${sectorLabelKr})`];
  if (data.currentPrice !== null) parts.push(`$${data.currentPrice.toFixed(2)}`);
  if (data.peRatio !== null) parts.push(`PER ${data.peRatio.toFixed(1)}`);
  else parts.push('PER N/A');
  if (data.week52Position !== null) parts.push(`52w ${data.week52Position.toFixed(0)}%위치`);
  if (data.yearReturn !== null) {
    const sign = data.yearReturn >= 0 ? '+' : '';
    parts.push(`1Y ${sign}${data.yearReturn.toFixed(0)}%`);
  }
  void sector;  // 영어 sector는 줄에 안 넣음 (KR로 표기)
  return parts.join(' · ');
}
