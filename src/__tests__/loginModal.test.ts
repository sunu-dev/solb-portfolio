import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import LoginModal from '@/components/auth/LoginModal';

function render(isOpen = true) {
  return renderToStaticMarkup(createElement(LoginModal, {
    isOpen, onClose: vi.fn(), onKakaoLogin: vi.fn(),
  }));
}

describe('로그인 화면 기본 상태', () => {
  it('닫힌 화면은 렌더링하지 않는다', () => {
    expect(render(false)).toBe('');
  });
  it('카카오만 제시하고 동의 전 로그인 버튼을 비활성화한다', () => {
    const html = render();
    expect(html).toContain('카카오로 시작하기');
    expect(html).not.toContain('Google');
    expect((html.match(/disabled=""/g) ?? []).length).toBe(1);
    expect(html).not.toContain('checked=""');
  });
  it('로그인 상단은 단순한 주비 워드마크와 짧은 문구를 사용한다', () => {
    const html = render();
    expect(html).toContain('joobi-lockup--modal');
    expect(html).toContain('오늘은 어때요?');
    expect(html).toContain('가격과 소식을 한곳에서 확인해요.');
  });
  it('날짜 달력 대신 라벨이 연결된 숫자 입력을 제공한다', () => {
    const html = render();
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('maxLength="8"');
    expect(html).toContain('for="login-birth"');
    expect(html).not.toContain('type="date"');
  });
  it('이름 있는 네이티브 대화상자와 별도 약관 링크를 제공한다', () => {
    const html = render();
    expect(html).toContain('<dialog');
    expect(html).toContain('aria-labelledby="login-title"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('국외이전 포함');
  });
});
