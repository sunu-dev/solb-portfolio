import { NextResponse, type NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';

/**
 * 관리자 신원 SSOT — **서버 전용**.
 *
 * 왜 필요한가: 2026-08-18 감사에서 `ADMIN_EMAILS`/`ADMIN_IDS`가 **15개 파일에 리터럴로 복제**돼 있었다.
 *  1. 관리자를 추가·회수하려면 15곳을 고쳐야 하고, 한 곳만 놓치면 권한이 남거나 빠진다.
 *     실제로 `src/app/page.tsx`는 이메일을 안 보고 ID만 검사하는 변종이었다.
 *  2. 그중 3곳이 클라이언트 컴포넌트(`page.tsx`·`admin/page.tsx`·`admin/chok-debug/page.tsx`)라
 *     **파운더 이메일 2개와 UUID가 빌드 산출물 청크에 그대로 실려** 모든 방문자에게 노출됐다.
 *
 * 그래서 목록은 이 파일에만 두고, 클라이언트는 값을 알 필요 없이 `/api/me/admin`으로 **결과(boolean)만** 받는다.
 *
 * 운영 팁: 값은 환경변수로 덮어쓸 수 있다(`ADMIN_EMAILS`·`ADMIN_IDS`, 쉼표 구분).
 * 관리자 교체 시 재배포 없이 Vercel 환경변수만 바꾸면 된다. 미설정이면 아래 기본값을 쓴다.
 */

const DEFAULT_ADMIN_EMAILS = ['soonooya@gmail.com', 'sunu.develop@gmail.com'];
const DEFAULT_ADMIN_IDS = ['8d5fc5d7-978c-4365-a647-af90c237222b'];

/**
 * 파운더 — 관리자와 **다른 개념**이다. 초대코드 사용 횟수 무제한 같은 특례에만 쓴다.
 * 목록이 흩어지는 걸 막기 위해 같은 파일에 두되, 판정 함수는 분리한다.
 */
const DEFAULT_FOUNDER_EMAILS = ['sunu.develop@gmail.com'];

function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  const parsed = raw.split(',').map(v => v.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function adminEmails(): string[] {
  return parseList(process.env.ADMIN_EMAILS, DEFAULT_ADMIN_EMAILS).map(e => e.toLowerCase());
}

function adminIds(): string[] {
  return parseList(process.env.ADMIN_IDS, DEFAULT_ADMIN_IDS);
}

export interface AdminIdentity {
  id: string;
  email?: string | null;
}

/** 신원이 관리자 허용목록에 있는지. 이메일 비교는 대소문자 무시. */
export function isAdminIdentity(user: AdminIdentity | null | undefined): boolean {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  return adminEmails().includes(email) || adminIds().includes(user.id);
}

export interface ResolvedUser {
  id: string;
  email: string | null;
}

/**
 * Bearer 토큰으로 요청자 신원을 확인한다.
 *
 * 토큰 검증에는 service-role 클라이언트를 쓴다(`auth.getUser(token)`은 키 종류와 무관하게
 * 토큰 자체를 검증하며, 여기서는 클라이언트 재사용으로 커넥션을 아낀다).
 * 토큰이 없거나 무효면 null.
 */
export async function resolveUser(req: NextRequest): Promise<ResolvedUser | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const supabase = getServiceClient();
  if (!supabase) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
    if (error || !user) return null;
    return { id: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}

/**
 * 핸들러가 여러 개라 `defineRoute`로 감싸기 부담스러운 라우트용 가드.
 *
 * `defineRoute({ auth: 'admin' })`와 **같은 판정**을 쓰되, early-return 스타일을 유지한다:
 *
 * ```ts
 * const auth = await requireAdmin(req);
 * if (!auth.ok) return auth.res;
 * // auth.userId 사용 가능
 * ```
 *
 * 새 라우트는 `defineRoute`를 우선 쓰고, 이 헬퍼는 기존 다중 핸들러 라우트 이관용으로 둔다.
 */
export async function requireAdmin(
  req: NextRequest,
): Promise<{ ok: true; userId: string; email: string | null } | { ok: false; res: NextResponse }> {
  const user = await resolveUser(req);
  if (!user) {
    return { ok: false, res: NextResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 }) };
  }
  if (!isAdminIdentity(user)) {
    return { ok: false, res: NextResponse.json({ error: 'forbidden', code: 'forbidden' }, { status: 403 }) };
  }
  return { ok: true, userId: user.id, email: user.email };
}

/** 파운더 특례 판정 (초대코드 무제한 등). 관리자 권한과 혼동하지 말 것. */
export function isFounderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = parseList(process.env.FOUNDER_EMAILS, DEFAULT_FOUNDER_EMAILS).map(e => e.toLowerCase());
  return list.includes(email.toLowerCase());
}
