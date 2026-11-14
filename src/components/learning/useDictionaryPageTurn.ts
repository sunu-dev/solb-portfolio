'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { dictionaryCaptureStyles } from '@/lib/dictionaryCaptureStyles';
import { dictionaryCaptureFont } from '@/lib/dictionaryCaptureFont';
import { printDictionaryPaper } from '@/lib/dictionaryPaper';
import type { createDictionaryLeaf } from '@/lib/dictionaryLeafRenderer';

/** Animate only a temporary visual copy; storage and accessible content stay in React. */
export function useDictionaryPageTurn(page: RefObject<HTMLElement | null>, canvas: RefObject<HTMLCanvasElement | null>, snapshot: RefObject<HTMLDivElement | null>) {
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const locked = useRef(false);
  const frame = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderer = useRef<ReturnType<typeof createDictionaryLeaf>>(null);
  
  const cleanup = () => {
    cancelAnimationFrame(frame.current);
    if (timeout.current) clearTimeout(timeout.current);
    renderer.current?.dispose(); renderer.current = null;
    if (canvas.current) canvas.current.style.opacity = '0';
    if (snapshot.current) { snapshot.current.style.opacity = '0'; snapshot.current.style.backgroundImage = ''; }
    locked.current = false;
  };
  useEffect(() => { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) void dictionaryCaptureFont().catch(() => undefined); }, []);
  useEffect(() => () => { sequence.current++; cleanup(); }, []); // refs own the transient drawing resources

  const turn = async (commit: () => void, reverse: boolean) => {
    if (locked.current) return;
    const node = page.current?.parentElement, surface = canvas.current;
    if (!node || !surface || matchMedia('(prefers-reduced-motion: reduce)').matches) { commit(); return; }
    locked.current = true; setBusy(true);
    const token = ++sequence.current;
    let committed = false;
    const apply = () => { if (!committed) { committed = true; flushSync(commit); if (page.current) page.current.scrollTop = 0; } };
    const finish = () => {
      if (sequence.current !== token) return;
      sequence.current++; cleanup(); apply(); setBusy(false);
    };
    // A slow font/image capture must never block navigation indefinitely.
    timeout.current = setTimeout(() => { if (process.env.NODE_ENV === 'development') console.warn('Dictionary leaf capture exceeded 2200ms'); finish(); }, 2200);
    try {
      const [{ toCanvas }, { createDictionaryLeaf }] = await Promise.all([import('html-to-image'), import('@/lib/dictionaryLeafRenderer')]);
      if (sequence.current !== token) return;
      const options = {
        includeStyleProperties: dictionaryCaptureStyles,
        pixelRatio: Math.min(devicePixelRatio || 1, 2), fontEmbedCSS: await dictionaryCaptureFont(),
        style: { margin: '0', position: 'relative' as const, inset: 'auto', transform: 'none', backgroundColor: 'transparent', borderColor: 'transparent', boxShadow: 'none' },
        filter: (element: HTMLElement) => !element.hasAttribute?.('data-turn-overlay') && !element.hasAttribute?.('data-book-surface') && element.tagName !== 'NAV',
      };
      if (sequence.current !== token) return;
      const spread = matchMedia('(min-width: 651px)').matches;
      const paper = getComputedStyle(node).getPropertyValue('--dict-paper').trim();
      const from = printDictionaryPaper(await toCanvas(node, options), paper, spread);
      if (sequence.current !== token) return;
      surface.width = from.width; surface.height = from.height;
      // WebGL owns the canvas context. The old HTML stays visible during capture.
      if (snapshot.current) {
        snapshot.current.style.backgroundImage = `url(${from.toDataURL()})`;
        snapshot.current.style.opacity = '1';
      }
      apply();
      const to = printDictionaryPaper(await toCanvas(node, options), paper, spread);
      if (sequence.current !== token) return;
      renderer.current = createDictionaryLeaf(surface, from, to, reverse, spread);
      if (!renderer.current) { finish(); return; }
      if (timeout.current) clearTimeout(timeout.current);
      renderer.current.draw(0); surface.style.opacity = '1';
      if (snapshot.current) snapshot.current.style.opacity = '0';
      const started = performance.now();
      const duration = process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).has('slowTurn') ? 12000 : 950;
      const draw = (now: number) => {
        if (sequence.current !== token) return;
        const progress = Math.min(1, (now - started) / duration);
        renderer.current?.draw(progress * progress * (3 - 2 * progress));
        if (progress < 1) frame.current = requestAnimationFrame(draw);
        else finish();
      };
      frame.current = requestAnimationFrame(draw);
      timeout.current = setTimeout(finish, duration + 500);
    } catch (error) { if (process.env.NODE_ENV === 'development') console.warn('Dictionary leaf capture failed', error); finish(); }
  };
  return { turn, busy, cancel: () => { sequence.current++; cleanup(); setBusy(false); } };
}
