import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import LoginModal from '@/components/auth/LoginModal';

function render(isOpen = true, returnError: 'cancelled' | 'failed' | null = null) {
  return renderToStaticMarkup(createElement(LoginModal, {
    isOpen, onClose: vi.fn(), onKakaoLogin: vi.fn(async () => true), returnError,
  }));
}

describe('로그인 화면 기본 상태', () => {
  it('닫힌 화면은 렌더링하지 않는다', () => {
    expect(render(false)).toBe('');
  });
  it('카카오 인증은 생년월일이나 동의 입력 없이 시작할 수 있다', () => {
    const html = render();
    expect(html).toContain('카카오로 로그인');
    expect(html).not.toContain('Google');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<fieldset');
  });
  it('로그인 상단은 단순한 주비 워드마크와 짧은 문구를 사용한다', () => {
    const html = render();
    expect(html).toContain('joobi-lockup--modal');
    expect(html).toContain('오늘은 어때요?');
    expect(html).toContain('가격과 소식을 한곳에서 확인해요.');
  });
  it('로그인과 회원가입 진입을 구분하고 로그인에는 가입 조건을 표시하지 않는다', () => {
    const html = render();
    expect(html).toContain('주비에 로그인');
    expect(html).toContain('처음이신가요?');
    expect(html).toContain('회원가입</button>');
    expect(html).not.toContain('초대 코드');
    expect(html).not.toContain('생년월일');
    expect(html).not.toContain('필수 항목 모두 동의');
  });
  it('이름 있는 네이티브 대화상자와 별도 약관 링크를 제공한다', () => {
    const html = render();
    expect(html).toContain('<dialog');
    expect(html).toContain('aria-labelledby="login-title"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('개인정보처리방침');
    expect(html).not.toContain('국외이전 포함');
  });
  it('카카오 인증이 취소되어 돌아오면 재시도와 둘러보기 경로를 안내한다', () => {
    const html = render(true, 'cancelled');
    expect(html).toContain('카카오 로그인이 취소됐어요.');
    expect(html).toContain('먼저 둘러보기');
  });
});
