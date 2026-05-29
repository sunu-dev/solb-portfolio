import { NextRequest, NextResponse } from 'next/server';
import { KOREAN_UNIVERSE_DEDUPED } from '@/config/koreanUniverse';

// ==========================================
// 검색 카탈로그 — 9인 패널 P0 (2026-05-29): 검색 커버리지 30 → 110+종
// ==========================================
//
// 기반: KOREAN_UNIVERSE(KOSPI 70 + KOSDAQ 30, 시총 객관 기준 SSOT)를 재활용.
// 기존 30종 손맵(KR_STOCKS)을 제거하고 분산을 줄임.
//
// 보강(KR_SEARCH_EXTRA): 토스 검색 격차로 드러난 우선주·인기 ETF.
//   - KOREAN_UNIVERSE는 '오늘 주목 종목' feature 전용(보통주만)이므로
//     우선주/ETF를 거기 넣으면 그 feature가 오염된다 → 검색 전용으로 분리.
//   - 우선주 코드: 구형우선주(보통주코드+5) 규칙으로 검증 가능한 것만.
//   - ETF: 코드 확정된 플래그십만. 나머지는 KRX 마스터 CSV(V1.2)로 확장.

const KR_SEARCH_EXTRA: { symbol: string; name: string }[] = [
  // 우선주 (구형우선주 = 보통주코드 + 5)
  { symbol: '005935.KS', name: '삼성전자우' },
  { symbol: '005385.KS', name: '현대차우' },
  { symbol: '006405.KS', name: '삼성SDI우' },
  { symbol: '009155.KS', name: '삼성전기우' },
  { symbol: '051915.KS', name: 'LG화학우' },
  { symbol: '051905.KS', name: 'LG생활건강우' },
  { symbol: '090435.KS', name: '아모레퍼시픽우' },
  { symbol: '000815.KS', name: '삼성화재우' },
  // 인기 ETF (코드 확정 플래그십)
  { symbol: '069500.KS', name: 'KODEX 200' },
  { symbol: '102110.KS', name: 'TIGER 200' },
  { symbol: '133690.KS', name: 'TIGER 미국나스닥100' },
  { symbol: '360750.KS', name: 'TIGER 미국S&P500' },
  { symbol: '379800.KS', name: 'KODEX 미국S&P500' },
];

// 검색 카탈로그 = universe(100) + 보강(우선주·ETF). symbol 기준 중복 제거.
const KR_CATALOG: { symbol: string; name: string }[] = (() => {
  const seen = new Set<string>();
  const out: { symbol: string; name: string }[] = [];
  for (const s of [
    ...KOREAN_UNIVERSE_DEDUPED.map(u => ({ symbol: u.symbol, name: u.krName })),
    ...KR_SEARCH_EXTRA,
  ]) {
    if (seen.has(s.symbol)) continue;
    seen.add(s.symbol);
    out.push(s);
  }
  return out;
})();

// symbol(.KS/.KQ) → 한국어 종목명 (GET 시세 응답 표시명 fallback)
const KR_NAME_BY_SYMBOL: Record<string, string> = Object.fromEntries(
  KR_CATALOG.map(s => [s.symbol, s.name]),
);

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'symbol parameter required' }, { status: 400 });
  }

  // Find Yahoo symbol
  let yahooSymbol = symbol;
  let stockName = symbol;

  if (/^\d{6}$/.test(symbol)) {
    // 6-digit code → KRX (KOSPI 기본)
    yahooSymbol = `${symbol}.KS`;
  } else if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) {
    yahooSymbol = symbol;
  }
  // 카탈로그에 있으면 한국어 표시명 사용 (없으면 Yahoo meta 이름으로 fallback)
  if (KR_NAME_BY_SYMBOL[yahooSymbol]) {
    stockName = KR_NAME_BY_SYMBOL[yahooSymbol];
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=5d&interval=1d`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      signal: AbortSignal.timeout(8000),
    });
    const data = await resp.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 });
    }

    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close || [];
    const prevClose = meta.previousClose || closes[closes.length - 2] || meta.regularMarketPrice;
    const price = meta.regularMarketPrice;
    const change = price - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    return NextResponse.json({
      symbol: yahooSymbol,
      name: meta.longName || meta.shortName || stockName,
      c: price,
      d: change,
      dp: changePercent,
      h: meta.regularMarketDayHigh || meta.fiftyTwoWeekHigh,
      l: meta.regularMarketDayLow || meta.fiftyTwoWeekLow,
      pc: prevClose,
      currency: meta.currency,
      exchange: meta.exchangeName,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// Search Korean stocks
export async function POST(req: NextRequest) {
  const { query } = await req.json();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const results: { symbol: string; name: string; yahoo: string }[] = [];
  const q = query.toLowerCase();

  for (const s of KR_CATALOG) {
    const code = s.symbol.replace(/\.K[SQ]$/, ''); // "005930.KS" → "005930"
    if (
      s.name.toLowerCase().includes(q) ||
      s.symbol.toLowerCase().includes(q) ||
      code.includes(q)
    ) {
      results.push({ symbol: s.symbol, name: s.name, yahoo: s.symbol });
    }
  }

  return NextResponse.json({ results: results.slice(0, 12) });
}
