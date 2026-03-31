import { NextResponse } from 'next/server';

/**
 * 클라이언트에 필요한 설정값을 서버에서 안전하게 제공
 * NEXT_PUBLIC_ 접두어 없이 서버 환경변수에서 가져옴
 */
export async function GET() {
  return NextResponse.json({
    wsKey: process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '',
  }, {
    headers: {
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200',
    },
  });
}
