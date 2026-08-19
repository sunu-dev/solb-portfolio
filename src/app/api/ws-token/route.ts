import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getUserIdFromAuth, POLICIES } from '@/lib/rateLimiter';

/**
 * Finnhub 실시간 WebSocket 접속용 토큰.
 *
 * ⚠️ 이 라우트는 예전에 **인증·레이트리밋 없이** 키를 반환했다. 모든 방문자가 부팅 시
 * 호출해 localStorage에 영속시켰기 때문에, 사실상 공개 엔드포인트에서 유료 키를 배포하는
 * 상태였다(개인정보처리방침의 "API 키는 클라이언트에 노출되지 않는다" 기술과도 모순).
 *
 * 지금은 실시간 시세 WebSocket을 실제로 여는 로그인 사용자에게만 발급한다.
 * 시세·캔들 일반 조회는 서버 라우트(/api/quotes·/api/candle·/api/kr-quote)를 쓰므로
 * 이 토큰이 없어도 앱 전체가 정상 동작한다.
 *
 * 남은 한계: 브라우저가 wss://ws.finnhub.io에 직접 붙는 구조라 키는 여전히 인증된
 * 사용자의 브라우저까지는 도달한다. 완전히 없애려면 서버 WebSocket 프록시가 필요하다.
 * 그때까지 이 라우트의 역할은 노출면을 '인터넷 전체'에서 '로그인 사용자'로 좁히는 것이다.
 */
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromAuth(req);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const gate = await enforceRateLimit(req, '/api/ws-token', POLICIES.general);
  if (!gate.ok) return gate.response;

  const token = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
  if (!token) {
    await gate.finalize(503, 'realtime_unavailable');
    return NextResponse.json({ error: 'realtime unavailable' }, { status: 503 });
  }

  await gate.finalize(200);
  return NextResponse.json({ token }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
