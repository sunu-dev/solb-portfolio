import { NextResponse } from 'next/server';

/** 구버전 클라이언트에도 공용 공급자 키를 반환하지 않는다. */
export async function GET() {
  return NextResponse.json({ error: 'Direct realtime access is retired', code: 'realtime_retired' }, {
    status: 410, headers: { 'Cache-Control': 'no-store' },
  });
}
