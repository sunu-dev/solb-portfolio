import { NextRequest, NextResponse } from 'next/server';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query) {
    return NextResponse.json({ result: [] });
  }

  const apiKey = process.env.FINNHUB_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ result: [] });
  }

  try {
    const r = await fetch(
      `${FINNHUB_BASE}/search?q=${encodeURIComponent(query)}&token=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const d = await r.json();
    const results = (d.result || [])
      .filter((item: { type: string }) => item.type === 'Common Stock' || item.type === 'ETP')
      .slice(0, 8)
      .map((item: { symbol: string; description: string }) => ({
        symbol: item.symbol,
        description: item.description,
      }));

    return NextResponse.json({ result: results }, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
    });
  } catch {
    return NextResponse.json({ result: [] });
  }
}
