import { describe, expect, it } from 'vitest';
import { parseOAuthReturnFailure, resolveOAuthRedirect } from '@/lib/oauthRedirect';

describe('OAuth 로그인 복귀 주소', () => {
  it('관리자 로그인은 같은 도메인의 관리자 화면으로 돌아온다', () => {
    expect(resolveOAuthRedirect('https://joobi.kr', '/admin')).toBe('https://joobi.kr/admin');
  });

  it('외부 주소처럼 해석될 수 있는 경로는 홈으로 제한한다', () => {
    expect(resolveOAuthRedirect('https://joobi.kr', '//evil.example/admin')).toBe('https://joobi.kr/');
    expect(resolveOAuthRedirect('https://joobi.kr', 'https://evil.example/admin')).toBe('https://joobi.kr/');
  });

  it('취소된 인증 복귀를 구분하고 기존 딥링크를 남긴다', () => {
    expect(parseOAuthReturnFailure('https://joobi.kr/?stock=NVDA#error=access_denied&error_description=denied'))
      .toEqual({ failure: 'cancelled', cleanPath: '/?stock=NVDA' });
  });

  it('인증 오류의 원문은 주소에서 제거하고 재시도 상태만 반환한다', () => {
    expect(parseOAuthReturnFailure('https://joobi.kr/?guide=fx&error=server_error&error_description=internal'))
      .toEqual({ failure: 'failed', cleanPath: '/?guide=fx' });
    expect(parseOAuthReturnFailure('https://joobi.kr/?stock=NVDA')).toBeNull();
  });
});
