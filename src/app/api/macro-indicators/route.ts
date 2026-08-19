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
    // 저빈도 데이터(일별·월별) — CDN 30분, 만료 후 하루까지 stale 서빙
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=86400' },
    });
  },
});
