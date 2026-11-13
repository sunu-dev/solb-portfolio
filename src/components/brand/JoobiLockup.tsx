'use client';

import { useEffect, useRef } from 'react';
import { getJoobiCharacter } from '@/config/joobiCharacters';
import { useJoobiCharacter } from '@/hooks/useJoobiCharacter';
import styles from './JoobiLockup.module.css';

interface Props {
  variant?: 'header' | 'hero' | 'modal' | 'loading';
  greet?: boolean;
}

export default function JoobiLockup({ variant = 'header', greet = false }: Props) {
  const character = getJoobiCharacter(useJoobiCharacter());
  const guestRef = useRef<SVGGElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mark = markRef.current;
    if (!mark) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let animation: Animation | undefined;
    let greetingTimer: ReturnType<typeof setTimeout> | undefined;
    let greeted = false;
    let lastGreeting = -Infinity;
    const bounce = () => {
      if (motion.matches || document.hidden || !visible || animation?.playState === 'running') return;
      if (greet) {
        if (!guestRef.current || performance.now() - lastGreeting < 30_000) return;
        lastGreeting = performance.now();
        greeted = true;
        animation = guestRef.current.animate([
          { transform: 'translate(7px, 31px) scale(.8)', opacity: 0, offset: 0 },
          { transform: 'translate(7px, 31px) scale(1)', opacity: 1, offset: .1 },
          { transform: 'translate(11px, 10px) rotate(-8deg)', opacity: 1, offset: .24 },
          { transform: 'translate(15px, 20px) scale(1.08, .9)', opacity: 1, offset: .36 },
          { transform: 'translate(19px, 8px) rotate(6deg)', opacity: 1, offset: .49 },
          { transform: 'translate(22px, 24px) scale(1.08, .9)', opacity: 1, offset: .61 },
          { transform: 'translate(28px, 0px) rotate(-8deg)', opacity: 1, offset: .75 },
          { transform: 'translate(33px, 10px) scale(1.08, .9)', opacity: 1, offset: .87 },
          { transform: 'translate(33px, 10px)', opacity: 0, offset: 1 },
        ], { duration: 2400, easing: 'ease-in-out', iterations: 1 });
        return;
      }
      animation = mark.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(-2px)', offset: 0.45 },
        { transform: 'translateY(0)' },
      ], { duration: 600, easing: 'ease-in-out', iterations: 1 });
    };
    const sync = () => {
      clearInterval(timer);
      clearTimeout(greetingTimer);
      animation?.cancel();
      if (visible && !document.hidden && !motion.matches) {
        if (greet) {
          if (!greeted) greetingTimer = setTimeout(bounce, 1200);
        } else timer = setInterval(bounce, 30_000);
      }
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
      clearTimeout(greetingTimer);
      animation?.cancel();
      observer.disconnect();
      lockup?.removeEventListener('pointerenter', hover);
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
    };
  }, [greet]);

  return (
    <span className={`joobi-lockup joobi-lockup--${variant}`} style={variant === 'loading' ? {
      // The initial HTML must stay legible even when the stylesheet fails to load.
      display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 32,
      fontFamily: "'Joobi Sunflower', 'Pretendard Variable', Pretendard, sans-serif",
      fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap',
    } : undefined}>
      <span ref={markRef} className="joobi-lockup__motion" aria-hidden="true">
      <svg className={`joobi-lockup__symbol ${greet ? styles.stage : ''}`} color="#EF4658" width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
        <path className="joobi-lockup__line" d="M7 31 L15 20 L22 24 L33 10" pathLength="1" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle className="joobi-lockup__tip" cx="33" cy="10" r="3.2" fill="currentColor" />
        {greet && <g ref={guestRef} className={styles.guest}>
          <image href={character.image} x="-8" y="-16" width="16" height="16" />
        </g>}
      </svg>
      </span>
      <span>주비</span>
    </span>
  );
}
