import { NextRequest, NextResponse } from 'next/server';

// Korean stock symbol mapping
const KR_STOCKS: Record<string, { yahoo: string; name: string }> = {
  '삼성전자': { yahoo: '005930.KS', name: '삼성전자' },
  '005930': { yahoo: '005930.KS', name: '삼성전자' },
  'SK하이닉스': { yahoo: '000660.KS', name: 'SK하이닉스' },
  '000660': { yahoo: '000660.KS', name: 'SK하이닉스' },
  'LG에너지솔루션': { yahoo: '373220.KS', name: 'LG에너지솔루션' },
  '373220': { yahoo: '373220.KS', name: 'LG에너지솔루션' },
  '삼성바이오로직스': { yahoo: '207940.KS', name: '삼성바이오로직스' },
  '207940': { yahoo: '207940.KS', name: '삼성바이오로직스' },
  '현대자동차': { yahoo: '005380.KS', name: '현대자동차' },
  '005380': { yahoo: '005380.KS', name: '현대자동차' },
  'NAVER': { yahoo: '035420.KS', name: 'NAVER' },
  '035420': { yahoo: '035420.KS', name: 'NAVER' },
  '카카오': { yahoo: '035720.KS', name: '카카오' },
  '035720': { yahoo: '035720.KS', name: '카카오' },
  '셀트리온': { yahoo: '068270.KS', name: '셀트리온' },
  '068270': { yahoo: '068270.KS', name: '셀트리온' },
  '기아': { yahoo: '000270.KS', name: '기아' },
  '000270': { yahoo: '000270.KS', name: '기아' },
  'POSCO홀딩스': { yahoo: '005490.KS', name: 'POSCO홀딩스' },
  '005490': { yahoo: '005490.KS', name: 'POSCO홀딩스' },
  'KB금융': { yahoo: '105560.KS', name: 'KB금융' },
  '105560': { yahoo: '105560.KS', name: 'KB금융' },
  '삼성SDI': { yahoo: '006400.KS', name: '삼성SDI' },
  '006400': { yahoo: '006400.KS', name: '삼성SDI' },
  'LG화학': { yahoo: '051910.KS', name: 'LG화학' },
  '051910': { yahoo: '051910.KS', name: 'LG화학' },
  '현대모비스': { yahoo: '012330.KS', name: '현대모비스' },
  '012330': { yahoo: '012330.KS', name: '현대모비스' },
  '신한지주': { yahoo: '055550.KS', name: '신한지주' },
  '055550': { yahoo: '055550.KS', name: '신한지주' },
};

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'symbol parameter required' }, { status: 400 });
  }

  // Find Yahoo symbol
  let yahooSymbol = symbol;
  let stockName = symbol;

  const mapped = KR_STOCKS[symbol];
  if (mapped) {
    yahooSymbol = mapped.yahoo;
    stockName = mapped.name;
  } else if (/^\d{6}$/.test(symbol)) {
    // 6-digit code → KRX
    yahooSymbol = `${symbol}.KS`;
  } else if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) {
    yahooSymbol = symbol;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=5d&interval=1d`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
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

  for (const [key, val] of Object.entries(KR_STOCKS)) {
    if (key.toLowerCase().includes(q) || val.name.toLowerCase().includes(q) || val.yahoo.includes(q)) {
      // Avoid duplicates
      if (!results.find(r => r.yahoo === val.yahoo)) {
        results.push({ symbol: val.yahoo, name: val.name, yahoo: val.yahoo });
      }
    }
  }

  return NextResponse.json({ results: results.slice(0, 10) });
}
