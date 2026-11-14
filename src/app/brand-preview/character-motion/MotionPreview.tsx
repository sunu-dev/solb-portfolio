'use client';
import { useState, type CSSProperties } from 'react';
import AccountAccessStatus from '@/components/auth/AccountAccessStatus';
import DictionaryShortcut from '@/components/learning/DictionaryShortcut';
import JoobiAvatar from '@/components/learning/JoobiAvatar';
import styles from './preview.module.css';
export default function MotionPreview() {
  const [error, setError] = useState(false);
  const [dark, setDark] = useState(false);
  const [still, setStill] = useState(false);
  const [seconds, setSeconds] = useState(0);
  return <div className={`${styles.preview} ${dark ? 'dark' : ''}`} data-still={still} style={{'--pose-time': `-${seconds}s`} as CSSProperties}>
    <nav className={styles.toolbar} aria-label="검수 화면">
      <button onClick={() => setError(false)}>로딩</button><button onClick={() => setError(true)}>연결 오류</button>
      <button onClick={() => setDark(!dark)}>{dark ? '밝은 화면' : '어두운 화면'}</button>
      <button onClick={() => setStill(!still)}>{still ? '재생' : '프레임 확인'}</button>
      {still && <label>동작 시점 <input type="range" min="0" max="18" step=".1" value={seconds} onChange={e => setSeconds(Number(e.target.value))} />{seconds}초</label>}
    </nav>
    <header className={styles.header}><h2>내 투자</h2><span className={styles.chat}><JoobiAvatar /></span><DictionaryShortcut /></header>
    <AccountAccessStatus error={error} phase="session" onRetry={() => setError(false)} />
  </div>;
}
