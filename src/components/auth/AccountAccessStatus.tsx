'use client';

import JoobiLoadingCharacter from '@/components/learning/JoobiLoadingCharacter';
import readingUI from '../ui/ReadingUI.module.css';
import styles from './AccountAccessStatus.module.css';

/** One character and layout across loading, delayed loading and recovery. */
export default function AccountAccessStatus({ error = false, message, phase, onRetry, onSwitchAccount }: {
  error?: boolean; message?: string; onRetry?: () => void; onSwitchAccount?: () => void;
  phase?: 'session' | 'invite' | 'consent';
}) {
  const progress = phase === 'session' ? '로그인 상태를 확인하고 있어요.'
    : phase === 'invite' ? '계정의 이용 권한을 확인하고 있어요.'
      : phase === 'consent' ? '이용 동의 내역을 확인하고 있어요.' : '잠시 후 내 주식과 궁금한 이야기를 이어가요.';
  const actions = <div className={styles.actions}>
    {onRetry ? <button type="button" className={styles.retry} onClick={onRetry}>다시 연결하기</button>
      : <form action="/" method="get"><button type="submit" className={styles.retry}>새로고침</button></form>}
    {onSwitchAccount && <button type="button" className={styles.secondary} onClick={onSwitchAccount}>다른 계정으로 로그인</button>}
  </div>;

  return <main data-startup-screen data-startup-phase={phase} data-loading-design="joobi-recovery" data-state={error ? 'error' : 'pending'} className={styles.page}>
    <section className={styles.content} aria-labelledby="access-title">
      <p className={styles.brand}>주비 <span>내 주식비서</span></p>
      <div className={styles.portrait}><JoobiLoadingCharacter key={String(error)} error={error} consent={phase === 'consent'} /></div>
      <h1 id="access-title" className={styles.title}>{error ? (phase ? '지금 계정을 확인할 수 없어요' : '화면을 불러오지 못했어요') : '화면을 불러오고 있어요'}</h1>
      {error ? <>
        <p className={styles.message} role="alert">{message ?? (phase ? '서버 응답을 받지 못했어요. 잠시 뒤 다시 시도해주세요.' : '연결이 끊겼거나 응답이 늦어지고 있어요. 다시 연결해 주세요.')}</p>
        {actions}
      </> : <>
        <p className={styles.message}>{progress}</p>
        <p className={styles.status} role="status"><span className={styles.dots} aria-hidden="true"><i /><i /><i /></span><span className={styles.srOnly}>연결 중</span></p>
        {/* Remains usable before hydration; recovery appears after six seconds. */}
        <details className={styles.help}>
          <summary className={`${readingUI.disclosure} ${styles.helpSummary}`}>오래 기다리고 있나요?</summary>
          <p className={styles.hint}>계속 열리지 않으면 다시 연결해 주세요.</p>
          {actions}
        </details>
      </>}
    </section>
  </main>;
}
