import { NextResponse } from 'next/server';

// Finnhub API 키를 서버 환경변수에서만 반환 (클라이언트 번들 노출 방지)
export async function GET() {
  const token = process.env.FINNHUB_API_KEY || '';
  return NextResponse.json({ token });
}
