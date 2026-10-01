'use client';

import { useEffect, useRef } from 'react';

interface Props {
  variant?: 'header' | 'hero' | 'modal' | 'loading';
}

export default function JoobiLockup({ variant = 'header' }: Props) {
  const markRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mark = markRef.current;
    if (!mark) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let animation: Animation | undefined;
    const bounce = () => {
      if (motion.matches || document.hidden || !visible || animation?.playState === 'running') return;
      animation = mark.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(-2px)', offset: 0.45 },
        { transform: 'translateY(0)' },
      ], { duration: 600, easing: 'ease-in-out', iterations: 1 });
    };
    const sync = () => {
      clearInterval(timer);
      animation?.cancel();
      if (visible && !document.hidden && !motion.matches) timer = setInterval(bounce, 30_000);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    const hover = (event: PointerEvent) => { if (event.pointerType === 'mouse') bounce(); };
    observer.observe(mark);
    const lockup = mark.parentElement;
    lockup?.addEventListener('pointerenter', hover);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    return () => {
      clearInterval(timer);
      animation?.cancel();
      observer.disconnect();
      lockup?.removeEventListener('pointerenter', hover);
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
    };
  }, []);

  return (
    <span className={`joobi-lockup joobi-lockup--${variant}`}>
      <span ref={markRef} className="joobi-lockup__motion" aria-hidden="true">
      <svg className="joobi-lockup__symbol" viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
        <path className="joobi-lockup__line" d="M7 31 L15 20 L22 24 L33 10" pathLength="1" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle className="joobi-lockup__tip" cx="33" cy="10" r="3.2" fill="currentColor" />
      </svg>
      </span>
      <span>주비</span>
    </span>
  );
}
