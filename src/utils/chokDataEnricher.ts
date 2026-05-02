/**
 * AI 촉 universe 데이터 enricher.
 *
 * 목적: AI에 실시간 객관 수치(가격, PER, 52주 위치, 모멘텀)를 주입해
 *      "데이터 없는 저평가" 환각을 차단.
 *
 * 데이터 소스: Finnhub /stock/metric (free tier).
 * 캐시 계층:
 *   L1 — 모듈 레벨 in-memory (같은 인스턴스, TTL 1h)
 *   L2 — Supabase ai_chok_cache (인스턴스 간 공유, TTL 1h)
 *        Vercel 서버리스에서 콜드 스타트마다 Finnhub 58종목 재호출을 방지.
 * 호출 비용: Finnhub 58종목 × 2 call = 116. 무료 tier 60/min 안전.
 */

import { createClient } from '@supabase/supabase-js';
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
  /** 오늘 변동률 % */
  todayChangePct: number | null;
  /** 오늘 변동 절대값 (USD) */
  todayChange: number | null;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h (오늘 변동률 반영 위해 단축)
let cache: { data: EnrichedStockData[]; ts: number } | null = null;

// ─── Supabase L2 캐시 (인스턴스 간 공유) ────────────────────────────────────
const L2_KEY = '__enrich_universe__';
const L2_DATE = 'persistent';

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function readL2(): Promise<EnrichedStockData[] | null> {
  const sb = makeSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from('ai_chok_cache')
      .select('picks')
      .eq('user_key', L2_KEY)
      .eq('date', L2_DATE)
      .maybeSingle();
    if (!data?.picks) return null;
    const p = data.picks as { ts: number; items: EnrichedStockData[] };
    if (!p?.ts || !Array.isArray(p.items)) return null;
    if (Date.now() - p.ts > CACHE_TTL_MS) return null;
    return p.items;
  } catch { return null; }
}

function writeL2(items: EnrichedStockData[]) {
  const sb = makeSupabase();
  if (!sb) return;
  sb.from('ai_chok_cache').upsert(
    { user_key: L2_KEY, date: L2_DATE, picks: { ts: Date.now(), items }, use_count: 0 },
    { onConflict: 'user_key,date' }
  ).then(() => {}, () => {}); // fire-and-forget
}

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
  c?: number;   // current
  pc?: number;  // previous close
  d?: number;   // 변동 절대값
  dp?: number;  // 변동률 %
}

async function fetchOne(symbol: string, apiKey: string): Promise<EnrichedStockData> {
  const fallback: EnrichedStockData = {
    symbol,
    currentPrice: null, peRatio: null,
    weekHigh52: null, weekLow52: null, week52Position: null,
    yearReturn: null, month1Return: null,
    todayChange: null, todayChangePct: null,
  };
  try {
    const [metricRes, quoteRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`, { cache: 'no-store' }),
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`, { cache: 'no-store' }),
    ]);
    if (!metricRes.ok && metricRes.status === 429) {
      console.warn(`[CHOK ENRICH] ${symbol} metric rate-limited (429)`);
    }
    const metric = metricRes.ok ? (await metricRes.json()) as FinnhubMetric : {};
    const quote = quoteRes.ok ? (await quoteRes.json()) as FinnhubQuote : {};

    const m = metric.metric || {};
    const currentPrice = typeof quote?.c === 'number' && quote.c > 0 ? quote.c : null;
    const todayChange = typeof quote?.d === 'number' ? quote.d : null;
    const todayChangePct = typeof quote?.dp === 'number' ? quote.dp : null;
    // 강화된 검증: > 0 명시
    const high52 = typeof m['52WeekHigh'] === 'number' && m['52WeekHigh'] > 0 ? m['52WeekHigh'] : null;
    const low52 = typeof m['52WeekLow'] === 'number' && m['52WeekLow'] > 0 ? m['52WeekLow'] : null;
    let position52: number | null = null;
    if (currentPrice && high52 && low52 && high52 > low52) {
      position52 = ((currentPrice - low52) / (high52 - low52)) * 100;
      // 정상 범위 검증 — 가끔 데이터 stale로 100% 초과 가능
      if (position52 < -5 || position52 > 105) position52 = null;
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
      todayChange,
      todayChangePct,
    };
  } catch (e) {
    console.warn(`[CHOK ENRICH] ${symbol} fetch failed:`, e instanceof Error ? e.message : 'unknown');
    return fallback;
  }
}

/**
 * Universe 전체 enriched 데이터 반환. 24h 캐시.
 * apiKey 없으면 모든 필드 null인 stub 반환 → AI는 데이터 없음 모드로 동작.
 */
export async function enrichUniverse(): Promise<EnrichedStockData[]> {
  const now = Date.now();

  // L1: 같은 인스턴스 내 (가장 빠름)
  if (cache && now - cache.ts < CACHE_TTL_MS) return cache.data;

  // L2: Supabase — 콜드 스타트 인스턴스도 캐시 히트 가능
  const l2 = await readL2();
  if (l2) {
    cache = { data: l2, ts: now };
    return l2;
  }

  const apiKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
  if (!apiKey) {
    return CHOK_UNIVERSE.map(u => ({
      symbol: u.symbol,
      currentPrice: null, peRatio: null,
      weekHigh52: null, weekLow52: null, week52Position: null,
      yearReturn: null, month1Return: null,
      todayChange: null, todayChangePct: null,
    }));
  }

  // L3: Finnhub 직접 호출 — 10개씩 batch, 50ms 간격 (rate limit 여유)
  const BATCH = 10;
  const results: EnrichedStockData[] = [];
  for (let i = 0; i < CHOK_UNIVERSE.length; i += BATCH) {
    const slice = CHOK_UNIVERSE.slice(i, i + BATCH);
    const batchResults = await Promise.all(slice.map(s => fetchOne(s.symbol, apiKey)));
    results.push(...batchResults);
    if (i + BATCH < CHOK_UNIVERSE.length) {
      await new Promise(r => setTimeout(r, 50));
    }
  }

  // 진단 — 어떤 필드가 얼마나 채워졌는지 한 번 로깅 (캐시 갱신 시점)
  const counts = {
    total: results.length,
    price: results.filter(r => r.currentPrice !== null).length,
    pe: results.filter(r => r.peRatio !== null).length,
    week52: results.filter(r => r.week52Position !== null).length,
    yearReturn: results.filter(r => r.yearReturn !== null).length,
  };
  console.log('[CHOK ENRICH] coverage', JSON.stringify(counts));

  cache = { data: results, ts: now };
  writeL2(results); // fire-and-forget: L2 갱신
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
