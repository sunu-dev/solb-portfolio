import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import JoobiLockup from '@/components/brand/JoobiLockup';

describe('주비 공통 워드마크', () => {
  it('선택한 9번 Sunflower를 로고에만 적용한다', () => {
    const css = readFileSync('src/app/globals.css', 'utf8');
    const lockup = css.match(/\.joobi-lockup \{([^}]+)\}/)?.[1];
    expect(lockup).toContain("font-family: 'Joobi Sunflower'");
    expect(lockup).toContain('font-weight: 700');
    expect(lockup).toContain('letter-spacing: -0.03em');
  });
  it.each(['header', 'modal', 'loading', 'hero'] as const)('%s는 주비와 장식용 차트 심볼을 표시한다', (variant) => {
    const html = renderToStaticMarkup(createElement(JoobiLockup, { variant }));
    expect(html).toContain('주비');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).toContain('joobi-lockup__line');
    expect(html).toContain('joobi-lockup__tip');
    expect(html).not.toContain('joobi-lockup__dot');
    expect(html).not.toContain('나만의');
    expect(html).not.toContain('minor-letter');
    expect(html).not.toContain('<img');
  });
  it('움직임 허용 시에만 1회 재생하며 정지 상태도 완성된 선이다', () => {
    const css = readFileSync('src/app/globals.css', 'utf8');
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(css).toContain('joobi-brand-draw 850ms ease-out 1 both');
    expect(css).toContain('joobi-brand-settle 300ms ease-out 700ms 1 both');
    expect(css).toContain('stroke-dasharray: 1; stroke-dashoffset: 0;');
  });
  it('메인과 소개 페이지 상단에 이전 빨간 심볼을 붙이지 않는다', () => {
    for (const file of ['src/components/layout/Header.tsx', 'src/app/landing/page.tsx']) {
      expect(readFileSync(file, 'utf8')).not.toContain('/icon-192.png');
    }
  });
  it('주기적 움직임은 가시성과 접근성 설정을 확인하고 정리한다', () => {
    const code = readFileSync('src/components/brand/JoobiLockup.tsx', 'utf8');
    expect(code).toContain('setInterval(bounce, 30_000)');
    expect(code).toContain('duration: 600');
    expect(code).toContain('motion.matches || document.hidden || !visible');
    expect(code).toContain('observer.disconnect()');
    expect(code).toContain("motion.removeEventListener('change', sync)");
    expect(code).toContain("document.removeEventListener('visibilitychange', sync)");
  });
});
