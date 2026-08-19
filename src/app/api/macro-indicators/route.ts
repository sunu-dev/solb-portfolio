import { NextResponse } from 'next/server';
import { defineRoute, POLICIES } from '@/lib/apiRoute';
import { fetchUsMacro, type UsMacroData } from '@/lib/usMacro';
import { fetchUsTreasury10Y, type UsTreasury10Y } from '@/lib/usTreasury';

export interface MacroIndicatorsResponse extends UsMacroData {
  us10y: UsTreasury10Y | null;
}

export const GET = defineRoute({
  name: '/api/macro-indicators',
  auth: 'public',
  rateLimit: POLICIES.general,
  handler: async () => {
    // 소스 3계열(재무부·FRED·BLS)을 병렬로 — 각자 내부 캐시·개별 실패 처리
    const [macro, us10y] = await Promise.all([fetchUsMacro(), fetchUsTreasury10Y()]);
    const body: MacroIndicatorsResponse = { ...macro, us10y };

    const hasAny = !!(body.fed || body.cpi || body.jobs || body.us10y);
    if (!hasAny) {
      // 전 소스 실패 — 빈 응답은 no-store (CDN 전파 금지)
      return NextResponse.json(
        { error: 'unavailable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    // 부분 실패 응답을 오래 캐시하면, 소스가 즉시 복구돼도 그 시간 내내 지표 행이
    // 숨는다. 전 지표가 모인 응답만 길게 캐시하고 반쪽은 짧게 둬 곧 재검증되게 한다.
    const complete = !!(body.fed && body.cpi && body.jobs && body.us10y);
    return NextResponse.json(body, {
      headers: {
        'Cache-Control': complete
          ? 's-maxage=1800, stale-while-revalidate=86400'
          : 's-maxage=120, stale-while-revalidate=600',
      },
    });
  },
});
