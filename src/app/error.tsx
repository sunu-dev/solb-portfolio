'use client';

import appUI from '../components/ui/AppUI.module.css';

import { useEffect } from 'react';
import { logError } from '@/lib/errorLogger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError('error-boundary', error.message, { digest: error.digest, stack: error.stack?.substring(0, 300) });
  }, [error]);
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg, #FFFFFF)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>🌧️</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 8 }}>
        일시적인 문제가 발생했어요
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary, #8B95A1)', marginBottom: 24, textAlign: 'center', lineHeight: 1.6 }}>
        잠시 후 다시 시도해주세요.
        <br />
        문제가 계속되면 새로고침 해주세요.
      </p>
      <button className={appUI.primaryButton}
        onClick={reset}

      >
        다시 시도
      </button>
      {process.env.NODE_ENV === 'development' && (
        <pre style={{ marginTop: 24, fontSize: 11, color: '#EF4452', maxWidth: 400, overflow: 'auto' }}>
          {error.message}
        </pre>
      )}
    </div>
  );
}
