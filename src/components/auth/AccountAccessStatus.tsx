'use client';

import JoobiLockup from '@/components/brand/JoobiLockup';
import styles from './AccountAccessStatus.module.css';

export default function AccountAccessStatus({ error, onRetry, onSwitchAccount }: {
  error: boolean; onRetry: () => void; onSwitchAccount?: () => void;
}) {
  return <main className={styles.page}>
    <section className={styles.content} aria-labelledby="access-title">
      <div className={styles.brand}><JoobiLockup variant="loading" /></div>
      <h1 id="access-title">{error ? '가입 정보를 확인하지 못했어요' : '주비에 연결하고 있어요'}</h1>
      <p role="status">{error ? '연결 상태를 확인하고 다시 시도해주세요.' : '계정 정보를 확인하고 있어요. 잠시만 기다려주세요.'}</p>
      <div className={styles.actions}>
        {error && <button type="button" className={styles.retry} onClick={onRetry}>다시 확인하기</button>}
        {onSwitchAccount && <button type="button" className={styles.secondary} onClick={onSwitchAccount}>다른 계정으로 로그인</button>}
      </div>
    </section>
  </main>;
}
