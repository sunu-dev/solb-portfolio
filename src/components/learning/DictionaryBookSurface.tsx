import { useId } from 'react';
import styles from './DictionaryBookSurface.module.css';

/** Decorative geometry only: the readable and interactive layer remains HTML. */
export default function DictionaryBookSurface() {
  const id = useId().replace(/:/g, '');
  const left = 'M24 30 C150 30 365 8 468 24 Q490 27 500 39 L500 575 Q480 560 449 563 C305 585 130 575 24 571 Z';
  const right = 'M500 39 Q514 26 538 24 C665 10 847 29 976 30 L976 571 C841 580 676 582 548 564 Q519 560 500 575 Z';
  return <svg className={styles.surface} viewBox="0 0 1000 610" preserveAspectRatio="none" aria-hidden="true" focusable="false">
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
    <path className={styles.cover} d="M18 34 Q261 14 482 35 Q500 46 518 35 Q744 16 982 34 L983 584 Q754 600 520 583 Q500 594 480 583 Q252 600 17 584Z" />
    {[8, 5, 2].map(offset => <g key={offset} transform={`translate(0 ${offset})`} className={styles.edges}><path d={left} /><path d={right} /></g>)}
    <path d={left} className={styles.paper} /><path d={right} className={styles.paper} />
    <path d={left} fill={`url(#${id}-left)`} /><path d={right} fill={`url(#${id}-right)`} />
    <path d={left} fill={`url(#${id}-grain)`} /><path d={right} fill={`url(#${id}-grain)`} />
    <path d="M500 39 C497 172 498 439 500 575" className={styles.binding} />
  </svg>;
}
