import { NextRequest, NextResponse } from 'next/server';
import { logServerApi } from '@/lib/serverLogger';

const YAHOO_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

export interface FundamentalData {
  per: number | null;        // PER (주가수익비율)
  eps: number | null;        // EPS (주당순이익)
  marketCap: number | null;  // 시가총액 ($)
  dividendYield: number | null; // 배당수익률 (%)
  week52High: number | null; // 52주 최고가
  week52Low: number | null;  // 52주 최저가
  sector: string | null;     // 섹터
  industry: string | null;   // 산업
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  try {
    // Yahoo Finance quoteSummary (key statistics + profile)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const r = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (!meta) {
      return NextResponse.json({ data: null });
    }

    // quoteSummary for PE, EPS, dividendYield, sector
    const summaryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics,summaryDetail,assetProfile`;
    let per: number | null = null;
    let eps: number | null = null;
    let dividendYield: number | null = null;
    let sector: string | null = null;
    let industry: string | null = null;
    let week52High: number | null = null;
    let week52Low: number | null = null;

    try {
      const sr = await fetch(summaryUrl, {
        headers: { 'User-Agent': YAHOO_UA },
        signal: AbortSignal.timeout(8000),
      });
      const sd = await sr.json();
      const result = sd?.quoteSummary?.result?.[0];

      if (result) {
        const stats = result.defaultKeyStatistics || {};
        const detail = result.summaryDetail || {};
        const profile = result.assetProfile || {};

        per = detail.trailingPE?.raw || stats.trailingPE?.raw || null;
        eps = stats.trailingEps?.raw || null;
        dividendYield = detail.dividendYield?.raw ? +(detail.dividendYield.raw * 100).toFixed(2) : null;
        week52High = detail.fiftyTwoWeekHigh?.raw || null;
        week52Low = detail.fiftyTwoWeekLow?.raw || null;
        sector = profile.sector || null;
        industry = profile.industry || null;
      }
    } catch { /* summary not available */ }

    const result: FundamentalData = {
      per,
      eps,
      marketCap: meta.marketCap || null,
      dividendYield,
      week52High,
      week52Low,
      sector,
      industry,
    };

    logServerApi('api_fundamentals', { symbol });

    return NextResponse.json(
      { data: result },
      { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' } }
    );
  } catch {
    return NextResponse.json({ data: null });
  }
}
