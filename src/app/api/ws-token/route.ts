import { NextResponse } from 'next/server';

// 서버 전용 키 우선, fallback으로 NEXT_PUBLIC_ 사용 (클라이언트 번들에는 포함 안 됨)
export async function GET() {
  const token = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
  return NextResponse.json({ token });
}
