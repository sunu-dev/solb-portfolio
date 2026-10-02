import { afterEach, expect, it, vi } from 'vitest';
import { lockBodyScroll } from '@/lib/bodyScrollLock';
import { runMenuAction } from '@/lib/menuRegistry';

afterEach(() => vi.unstubAllGlobals());

it('moves focus and scroll to desktop alerts after the closing menu restores the page', () => {
  const sequence: string[] = [];
  const frames: FrameRequestCallback[] = [];
  let scrollY = 420;
  const target = {
    focus: vi.fn(() => sequence.push('focus-alerts')),
    scrollIntoView: vi.fn(() => { scrollY = 960; sequence.push('scroll-alerts'); }),
  };
  const body = { style: { position: '', top: '', width: '', overflow: '' } };
  vi.stubGlobal('document', { body, getElementById: (id: string) => id === 'solb-alert-center' ? target : null });
  vi.stubGlobal('window', {
    innerWidth: 1280,
    scrollY,
    scrollTo: ({ top }: { top: number }) => { scrollY = top; sequence.push('restore-page'); },
    matchMedia: () => ({ matches: true }),
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));

  const closeMenuScrollLock = lockBodyScroll();
  try {
    runMenuAction({ kind: 'alert-center' }, {
      setCurrentSection: vi.fn(), setCurrentTab: vi.fn(),
      onNavigate: () => sequence.push('close-menu'),
    });
    // React has received the close request, but the menu cleanup has not run yet.
    expect(body.style.position).toBe('fixed');
    expect(target.focus).not.toHaveBeenCalled();
    expect(target.scrollIntoView).not.toHaveBeenCalled();

    closeMenuScrollLock();
    frames.splice(0).forEach(callback => callback(0));

    expect(scrollY).toBe(960);
    expect(sequence).toEqual(['close-menu', 'restore-page', 'focus-alerts', 'scroll-alerts']);
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
  } finally {
    closeMenuScrollLock();
  }
});
