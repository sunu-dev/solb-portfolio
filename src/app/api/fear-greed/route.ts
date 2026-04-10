import { NextResponse } from 'next/server';

export interface FearGreedData {
  score: number;
  rating: string;        // 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed'
  ratingKr: string;
  previousClose: number | null;
  source: 'cnn' | 'unavailable';
}

function scoreToKr(rating: string): string {
  switch (rating) {
    case 'Extreme Fear': return '극도의 공포';
    case 'Fear':         return '공포';
    case 'Neutral':      return '중립';
    case 'Greed':        return '탐욕';
    case 'Extreme Greed': return '극도의 탐욕';
    default:             return rating;
  }
}

export async function GET() {
  // CNN Fear & Greed Index (unofficial but widely used endpoint)
  try {
    const res = await fetch(
      'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Referer': 'https://edition.cnn.com/',
        },
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      }
    );

    if (!res.ok) throw new Error(`CNN status ${res.status}`);

    const json = await res.json() as {
      fear_and_greed?: {
        score: number;
        rating: string;
        previous_close?: number;
      };
    };

    const fg = json.fear_and_greed;
    if (!fg?.score || !fg.rating) throw new Error('invalid CNN response');

    const data: FearGreedData = {
      score: Math.round(fg.score),
      rating: fg.rating,
      ratingKr: scoreToKr(fg.rating),
      previousClose: fg.previous_close ? Math.round(fg.previous_close) : null,
      source: 'cnn',
    };

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (e) {
    console.error('[fear-greed] CNN fetch failed:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'unavailable' } satisfies { error: string },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
