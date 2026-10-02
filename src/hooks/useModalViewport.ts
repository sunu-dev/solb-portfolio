'use client';

import { useEffect, type RefObject } from 'react';
import { lockBodyScroll } from '@/lib/bodyScrollLock';

/** Follow the keyboard's visible viewport without rerendering the dialog on every resize. */
export function useModalViewport(active: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const panel = ref.current;
    const unlock = lockBodyScroll();
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const bottom = Math.max(0, window.innerHeight - height - (viewport?.offsetTop ?? 0));
      panel.style.setProperty('--modal-viewport-height', `${height}px`);
      panel.style.setProperty('--modal-viewport-bottom', `${bottom}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      panel.style.removeProperty('--modal-viewport-height');
      panel.style.removeProperty('--modal-viewport-bottom');
      unlock();
    };
  }, [active, ref]);
}
