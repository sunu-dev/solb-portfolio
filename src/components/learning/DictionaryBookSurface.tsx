import { useId } from 'react';
import styles from './DictionaryBookSurface.module.css';
import { leftPaper as left, rightPaper as right } from '@/lib/dictionaryPaper';

/** Decorative geometry only: the readable and interactive layer remains HTML. */
export default function DictionaryBookSurface() {
  const id = useId().replace(/:/g, '');
  return <svg data-book-surface className={styles.surface} viewBox="0 0 1000 610" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <filter id={`${id}-shadow`} x="-10%" y="-10%" width="120%" height="140%"><feGaussianBlur stdDeviation="7" /></filter>
      <linearGradient id={`${id}-left`}>
        <stop offset="0" className={styles.paperStop} />
        <stop offset=".66" className={styles.paperStop} />
        <stop offset=".88" className={styles.lightStop} />
        <stop offset=".986" className={styles.paperStop} />
        <stop offset="1" className={styles.darkStop} />
      </linearGradient>
      <linearGradient id={`${id}-right`}>
        <stop offset="0" className={styles.darkStop} />
        <stop offset=".018" className={styles.paperStop} />
        <stop offset=".13" className={styles.lightStop} />
        <stop offset=".35" className={styles.paperStop} />
        <stop offset="1" className={styles.paperStop} />
      </linearGradient>
      <pattern id={`${id}-grain`} width="256" height="256" patternUnits="userSpaceOnUse"><image href="/textures/dictionary-paper.svg" width="256" height="256" /></pattern>
    </defs>
    <path filter={`url(#${id}-shadow)`} className={styles.shadow} d="M19 46 Q268 23 500 52 Q737 27 981 46 L982 587 Q734 599 500 589 Q248 599 18 586Z" />
    <path className={styles.cover} d="M21 32 C150 32 365 10 468 26 Q490 29 500 41 Q514 28 538 26 C665 12 847 31 979 32 L979 580 C841 584 695 588 558 574 C531 574 518 584 500 584 C482 584 469 574 442 574 C305 588 130 584 21 580 Z" />
    {[6, 4, 2].map(offset => <g key={offset} transform={`translate(0 ${offset})`} className={styles.edges}><path d={left} /><path d={right} /></g>)}
    <path d={left} className={styles.paper} /><path d={right} className={styles.paper} />
    <path d={left} fill={`url(#${id}-left)`} /><path d={right} fill={`url(#${id}-right)`} />
    <path d={left} fill={`url(#${id}-grain)`} /><path d={right} fill={`url(#${id}-grain)`} />
    <path d="M500 39 C497 172 498 439 500 575" className={styles.binding} />
  </svg>;
}
