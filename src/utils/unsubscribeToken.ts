/**
 * 이메일 unsubscribe 토큰
 *
 * 정책 SSOT: docs/NOTIFICATION_POLICY.md §7
 *
 * RFC 8058 List-Unsubscribe-Post를 충족하기 위한 stateless 토큰.
 * HMAC-SHA256(secret, `${userId}:${kind}`)을 base64url로 인코딩.
 *
 * 검증은 동일 secret으로 재계산해 비교 — DB 조회 없음, 빠르고 stateless.
 *
 * secret = `EMAIL_UNSUB_SECRET` 환경변수 (없으면 `CRON_SECRET`로 fallback).
 */

import crypto from 'node:crypto';

export type UnsubKind = 'morning_brief' | 'monthly_d3' | 'all';

function getSecret(): string {
  return process.env.EMAIL_UNSUB_SECRET
    || process.env.CRON_SECRET
    || 'dev-fallback-do-not-use-in-prod';
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** unsubscribe 토큰 생성 — 이메일 링크에 첨부 */
export function makeUnsubToken(userId: string, kind: UnsubKind): string {
  const payload = `${userId}:${kind}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest();
  return `${b64url(Buffer.from(payload))}.${b64url(sig)}`;
}

/** 검증 — 토큰이 유효하면 { userId, kind } 반환, 아니면 null */
export function verifyUnsubToken(token: string): { userId: string; kind: UnsubKind } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const [payloadB64, sigB64] = parts;
    // base64url → base64
    const toStd = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    const payload = Buffer.from(toStd(payloadB64), 'base64').toString('utf8');
    const sig = Buffer.from(toStd(sigB64), 'base64');

    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest();
    if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null;

    const [userId, kind] = payload.split(':');
    if (!userId || !kind) return null;
    if (kind !== 'morning_brief' && kind !== 'monthly_d3' && kind !== 'all') return null;
    return { userId, kind: kind as UnsubKind };
  } catch {
    return null;
  }
}

/** unsubscribe URL 빌드 */
export function buildUnsubUrl(opts: { appUrl: string; userId: string; kind: UnsubKind }): string {
  const token = makeUnsubToken(opts.userId, opts.kind);
  return `${opts.appUrl}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
}
