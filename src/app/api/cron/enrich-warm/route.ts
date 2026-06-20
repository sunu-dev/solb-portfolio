import { NextRequest, NextResponse } from 'next/server';
import { enrichUniverse } from '@/utils/chokDataEnricher';

/**
 * AI 촉 enrich 캐시 워밍 cron.
 *
 * 목적: '늦게 뜸'의 실제 원인 제거. AI 촉 마운트(intent='fetch')는 AI를 안 쓰지만,
 *   캐시 풀미스 시 enrichUniverse()(Finnhub 배치)가 임계경로에서 돌아 첫 유저가 지연을 떠안는다.
 *   세션 경계(국장 아침/미장 저녁) 직전에 enrich L2 캐시(전역 공유 row, TTL 1h)를 선갱신해
 *   콜드 풀미스를 ~0에 수렴시킨다. (4렌즈 만장일치 A안 — docs 회의 결론 / project_personalized_digest_strategy)
 *
 * ⚠️ 절대 원칙: 이 cron은 enrichUniverse(객관 데이터 캐시)만 데운다. Gemini generate는 호출하지 않는다
 *    (사용자 명시 동작 없이 AI quota 차감·자문 트리거 금지 — §6/한도 정책).
 *
 * 등록: vercel.json crons — '50 21 * * *'(06:50 KST 아침)·'50 12 * * *'(21:50 KST 저녁).
 * 인증: CRON_SECRET Bearer (다른 cron과 동일).
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

function verifyCronAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const t0 = Date.now();
  try {
    const enriched = await enrichUniverse();
    return NextResponse.json({
      ok: true,
      warmed: enriched.length,
      ms: Date.now() - t0,
      note: 'enrich L2 캐시 선갱신 — Gemini 미호출',
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
