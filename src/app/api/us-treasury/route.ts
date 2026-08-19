import { NextResponse } from 'next/server';
import { defineRoute, POLICIES } from '@/lib/apiRoute';
import { fetchUsTreasury10Y, type UsTreasury10Y } from '@/lib/usTreasury';

export interface UsTreasuryResponse extends UsTreasury10Y {
  source: 'treasury.gov';
}

export const GET = defineRoute({
  name: '/api/us-treasury',
  auth: 'public',
  rateLimit: POLICIES.general,
  handler: async () => {
    const data = await fetchUsTreasury10Y();
    if (!data) {
      // 빈 응답은 no-store — 실패가 CDN에 박히면 복구 후에도 전파된다
      return NextResponse.json(
        { error: 'unavailable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { ...data, source: 'treasury.gov' } satisfies UsTreasuryResponse,
      // 일별 데이터 — CDN 30분, 만료 후 하루까지 stale 서빙하며 백그라운드 재검증
      { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=86400' } },
    );
  },
});
