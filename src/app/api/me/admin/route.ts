import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';

/**
 * 요청자가 관리자인지 여부만 알려준다.
 *
 * 관리자 화면(`/admin`, `/admin/chok-debug`)과 초대 게이트 우회 판정은 클라이언트 컴포넌트에서
 * 일어나는데, 예전에는 각 컴포넌트가 `ADMIN_EMAILS`/`ADMIN_IDS` 리터럴을 직접 들고 비교했다.
 * 그래서 파운더 이메일과 UUID가 클라이언트 번들 청크에 그대로 실렸다(2026-08-18 감사 확인).
 *
 * 이제 클라이언트는 **목록을 모르고 결과만** 받는다. 판정은 서버의 `adminAuth`가 단독으로 한다.
 * 이 응답은 사용자별이라 공유 캐시에 넣으면 안 된다.
 */
export const GET = defineRoute({
  name: '/api/me/admin',
  auth: 'optional',
  handler: async ({ isAdmin }) =>
    NextResponse.json({ isAdmin }, {
      headers: { 'Cache-Control': 'private, no-store' },
    }),
});
