import { describe, expect, it } from 'vitest';
import { resolveOAuthRedirect } from '@/lib/oauthRedirect';

describe('OAuth 로그인 복귀 주소', () => {
  it('관리자 로그인은 같은 도메인의 관리자 화면으로 돌아온다', () => {
    expect(resolveOAuthRedirect('https://joobi.kr', '/admin')).toBe('https://joobi.kr/admin');
  });

  it('외부 주소처럼 해석될 수 있는 경로는 홈으로 제한한다', () => {
    expect(resolveOAuthRedirect('https://joobi.kr', '//evil.example/admin')).toBe('https://joobi.kr/');
    expect(resolveOAuthRedirect('https://joobi.kr', 'https://evil.example/admin')).toBe('https://joobi.kr/');
  });
});
