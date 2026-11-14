'use client';

import { useId } from 'react';
import { useJoobiCharacter } from '@/hooks/useJoobiCharacter';
import JoobiAvatar from './JoobiAvatar';
import styles from './JoobiLoadingCharacter.module.css';

/** The existing portrait is articulated at render time; no timers or account requests. */
export default function JoobiLoadingCharacter({ error = false, consent = false }: { error?: boolean; consent?: boolean }) {
  const character = useJoobiCharacter();
  const id = useId().replace(/:/g, '');
  const ref = (name: string) => `url(#${id}-${name})`;
  const portrait = <image href="/illustrations/joobi/sprout-avatar-v1.png" width="1254" height="1254" />;
  if (character !== 'sprout') return <JoobiAvatar size={112} mood={error ? 'retry' : consent ? 'privacy' : 'checking'} />;
  return <span className={styles.character} data-state={error ? 'error' : 'pending'} data-mood={error ? 'retry' : consent ? 'privacy' : 'checking'} aria-hidden="true">
    <svg viewBox="0 0 1254 1254" focusable="false">
      <defs>
        <clipPath id={`${id}-body`}><path d="M0 480L560 480L650 460L760 465L1254 480V1254H0Z" /></clipPath>
        <clipPath id={`${id}-left`}><path d="M0 0H665L680 480H0Z" /></clipPath>
        <clipPath id={`${id}-right`}><path d="M665 0H1254V465L680 480L665 400Z" /></clipPath>
        <radialGradient id={`${id}-face`} cx="52%" cy="32%" r="75%"><stop stopColor="#f9ecda" /><stop offset=".65" stopColor="#f1e1c9" /><stop offset="1" stopColor="#deceb3" /></radialGradient>
        <linearGradient id={`${id}-eye`} x2=".6" y2="1"><stop stopColor="#645341" /><stop offset="1" stopColor="#42392d" /></linearGradient>
      </defs>
      <ellipse className={styles.shadow} cx="635" cy="1130" rx="235" ry="24" />
      <g className={styles.body}>
        <g className={styles.leftLeaf}><g clipPath={ref('left')}>{portrait}</g></g>
        <g className={styles.rightLeaf}><g clipPath={ref('right')}>{portrait}</g></g>
        <g clipPath={ref('body')}>{portrait}</g>
        <path d="M363 797C363 669 531 567 690 567C843 567 946 675 943 790C942 910 812 1001 650 1001C484 1001 358 936 363 797Z" fill={ref('face')} />
        <g className={styles.face} fill={ref('eye')}>
          <g className={styles.eyes}>
            <ellipse className={styles.leftEye} cx="551" cy="761" rx="28" ry="50" />
            <ellipse className={styles.rightEye} cx="781" cy="761" rx="28" ry="50" />
          </g>
          <path className={styles.smile} d="M635 824Q666 855 699 824" fill="none" stroke={ref('eye')} strokeWidth="18" strokeLinecap="round" />
          <path className={styles.worry} d="M640 842Q666 824 692 842" fill="none" stroke={ref('eye')} strokeWidth="15" strokeLinecap="round" />
          <g className={styles.brows} fill="none" stroke={ref('eye')} strokeWidth="12" strokeLinecap="round"><path d="M521 694L560 681" /><path d="M771 681L810 694" /></g>
        </g>
      </g>
    </svg>
  </span>;
}
