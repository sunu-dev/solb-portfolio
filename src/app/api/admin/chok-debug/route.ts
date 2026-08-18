import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { enrichUniverse } from '@/utils/chokDataEnricher';
import { CHOK_UNIVERSE, sectorLabel } from '@/config/chokUniverse';

/**
 * AI 촉 데이터 진단 엔드포인트 — 관리자 전용.
 *
 * 사용:
 *   GET /api/admin/chok-debug
 *   Authorization: Bearer <supabase access token>
 *
 * 반환:
 *   - universe 통계 (필드별 채움 카운트)
 *   - 종목별 raw enriched data
 *   - 섹터별 분포
 *
 * 목적: Finnhub free tier에서 PER/52w가 실제로 들어오는지 확인.
 */

export const GET = defineRoute({
  name: '/api/admin/chok-debug',
  auth: 'admin',
  handler: async () => {
  try {
    const enriched = await enrichUniverse();

    const coverage = {
      total: enriched.length,
      currentPrice: enriched.filter(e => e.currentPrice !== null).length,
      peRatio: enriched.filter(e => e.peRatio !== null).length,
      week52Position: enriched.filter(e => e.week52Position !== null).length,
      yearReturn: enriched.filter(e => e.yearReturn !== null).length,
      month1Return: enriched.filter(e => e.month1Return !== null).length,
    };

    // 섹터별 분포
    const sectorDist: Record<string, number> = {};
    for (const u of CHOK_UNIVERSE) {
      const lbl = sectorLabel(u.sector);
      sectorDist[lbl] = (sectorDist[lbl] || 0) + 1;
    }

    // 종목별 상세 (universe 매핑)
    const enrichedMap = new Map(enriched.map(e => [e.symbol, e]));
    const detail = CHOK_UNIVERSE.map(u => {
      const e = enrichedMap.get(u.symbol);
      return {
        symbol: u.symbol,
        krName: u.krName,
        sectorTag: u.sector,
        sectorLabel: sectorLabel(u.sector),
        currentPrice: e?.currentPrice ?? null,
        peRatio: e?.peRatio ?? null,
        week52Position: e?.week52Position ?? null,
        yearReturn: e?.yearReturn ?? null,
        todayChangePct: e?.todayChangePct ?? null,
      };
    });

    // Today movers — 오늘 변동률 기준 상위·하위 5종
    const withToday = detail.filter(d => d.todayChangePct !== null);
    const sorted = [...withToday].sort((a, b) => (b.todayChangePct! - a.todayChangePct!));
    const topGainers = sorted.slice(0, 5);
    const topLosers = sorted.slice(-5).reverse();

    // 가장 부족한 필드 우선 노출
    const missingPe = detail.filter(d => d.peRatio === null).map(d => d.symbol);
    const missing52w = detail.filter(d => d.week52Position === null).map(d => d.symbol);

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      coverage,
      coveragePct: {
        currentPrice: ((coverage.currentPrice / coverage.total) * 100).toFixed(1) + '%',
        peRatio: ((coverage.peRatio / coverage.total) * 100).toFixed(1) + '%',
        week52Position: ((coverage.week52Position / coverage.total) * 100).toFixed(1) + '%',
      },
      sectorDistribution: sectorDist,
      missingPeSymbols: missingPe,
      missing52wSymbols: missing52w,
      todayGainers: topGainers,
      todayLosers: topLosers,
      detail,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
},
});
