import { NextRequest, NextResponse } from 'next/server';
import { buildMoverNote } from '@/lib/moverNote';

/**
 * 사이드바 '오늘 한 줄' — 관심 top mover의 RAG-grounded descriptive 해설(방향0).
 *
 * §6/변호사 게이트: buildMoverNote가 DIGEST_RAG_EXPLANATION!=='on'이면 항상 null을 반환하므로,
 * 이 라우트도 플래그 off 상태에선 {note:null} = 무노출(dormant). 약관 v4 변호사 검토 후 on.
 * 클라이언트는 env 플래그를 못 읽으므로 서버 라우트로 게이트를 강제한다.
 */
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') || '';
  const note = await buildMoverNote(name);
  return NextResponse.json(
    { note: note ?? null },
    // note 있을 때만 15분 캐시(중복 호출·뉴스 API 부하 억제), 없으면 no-store(빈 응답 CDN 박제 방지)
    { headers: { 'Cache-Control': note ? 's-maxage=900, stale-while-revalidate=1800' : 'no-store' } },
  );
}
