'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import styles from './LoginModal.module.css';
import JoobiLockup from '@/components/brand/JoobiLockup';
import type { OAuthReturnFailure } from '@/lib/oauthRedirect';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKakaoLogin: () => Promise<boolean>;
  returnError?: OAuthReturnFailure | null;
}

export default function LoginModal({ isOpen, onClose, onKakaoLogin, returnError }: LoginModalProps) {
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // Identify the account first. AgeEligibilityGate reuses saved confirmations
  // and requests missing items after authentication.
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [inviteMode, setInviteMode] = useState<'loading' | 'required' | 'open' | 'unknown'>('loading');

  const switchMode = (next: 'login' | 'signup') => {
    if (isConnecting) return;
    setMode(next);
    setConnectError('');
    if (next === 'signup') setInviteMode('loading');
    requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  };

  const handleKakao = useCallback(async () => {
    if (isConnecting) return;
    setConnectError('');
    setIsConnecting(true);
    let started = false;
    try { started = await onKakaoLogin(); } catch { /* 연결 실패는 아래에서 안내한다. */ }
    if (started) return;
    setConnectError('카카오 연결을 시작하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.');
    setIsConnecting(false);
  }, [isConnecting, onKakaoLogin]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    titleRef.current?.focus({ preventScroll: true });
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== 'signup') return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => {
      controller.abort();
      if (active) setInviteMode('unknown');
    }, 9000);
    void fetch('/api/config', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('config unavailable');
      const { config } = await response.json();
      if (!active || controller.signal.aborted) return;
      if (typeof config?.service_mode !== 'string') setInviteMode('unknown');
      else if (config.service_mode !== 'beta' || config.invite_required === 'false') setInviteMode('open');
      else setInviteMode(config.invite_required === 'true' ? 'required' : 'unknown');
    }).catch(() => {
      if (active) setInviteMode('unknown');
    }).finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen, mode]);

  if (!isOpen) return null;

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="login-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={handleOverlayClick}>
      <div className={styles.card}>
        <div className={styles.brandPane}>
          <JoobiLockup variant="modal" />
          <div className={styles.intro}>
            <span className={styles.eyebrow}>내 투자를 이해하는 시간</span>
            <h1>내 주식,<br />{' '}오늘은 어때요?</h1>
            <p>가격과 소식을 한곳에서 확인해요.<br />{' '}시장의 변화가 내 투자에 닿는 길도 함께 살펴봐요.</p>
          </div>
          <div className={styles.illustration} aria-hidden="true" />
          <p className={styles.brandCaption}>시장 이야기에서 내 투자까지, 주비가 함께 읽어요.</p>
        </div>
        <div className={styles.formPane}>
          <button type="button" className={styles.close} onClick={onClose} aria-label={mode === 'login' ? '로그인 닫기' : '회원가입 닫기'}><X size={21} aria-hidden="true" /></button>
          <div className={styles.formHeading}>
            <span className={styles.formEyebrow}>{mode === 'login' ? '로그인' : '회원가입'}</span>
            <h2 id="login-title" ref={titleRef} tabIndex={-1}>{mode === 'login' ? '주비에 로그인' : '주비 시작하기'}</h2>
            <p>{mode === 'login' ? '가입한 카카오 계정으로 이어서 이용해요.' : '카카오 계정으로 간편하게 가입해요.'}</p>
          </div>
          {returnError && <p className={styles.connectError} role="alert">{returnError === 'cancelled'
            ? '카카오 로그인이 취소됐어요. 다시 시도하거나 로그인 없이 둘러볼 수 있어요.'
            : '카카오 로그인을 완료하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.'}</p>}
          <div className={styles.actions}>
            {connectError && <p className={styles.connectError} role="alert">{connectError}</p>}
            <button type="button" className={styles.kakao} onClick={() => void handleKakao()} disabled={isConnecting} aria-busy={isConnecting}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9 0.6C4.029 0.6 0 3.726 0 7.554c0 2.467 1.639 4.632 4.104 5.862l-1.04 3.822c-.092.337.293.605.584.407l4.574-3.03c.257.02.517.03.778.03 4.971 0 9-3.126 9-6.954C18 3.726 13.971 0.6 9 0.6z"
                fill="#191F28"
              />
            </svg>{isConnecting ? '카카오 연결 중…' : mode === 'login' ? '카카오로 로그인' : '카카오로 가입하기'}
            </button>
            {mode === 'signup' && <p className={styles.actionHint}>가입에 필요한 확인은 카카오 인증 후 진행해요.</p>}
            <p className={styles.modeSwitch}>
              <span>{mode === 'login' ? '처음이신가요?' : '이미 회원이신가요?'}</span>
              <button type="button" disabled={isConnecting} onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? '회원가입' : '로그인'}
              </button>
            </p>
            <button type="button" className={styles.guest} onClick={onClose}>먼저 둘러보기</button>
          </div>
          {mode === 'signup' && inviteMode !== 'open' && <aside className={styles.inviteNote} aria-live="polite">
            <strong>{inviteMode === 'required' ? '새 계정에는 초대 코드가 필요해요' : '가입 안내'}</strong>
            <p>{inviteMode === 'required'
              ? '처음 가입할 때 카카오 인증 후 입력해요.'
              : inviteMode === 'loading' ? '가입 조건을 확인하고 있어요.'
                : '가입 조건을 확인하지 못했어요. 새 계정에는 초대 코드가 필요할 수 있어요.'}</p>
          </aside>}
          <div className={styles.policyLinks}>
            <a href="/terms" target="_blank" rel="noopener noreferrer">이용약관<span className="sr-only"> (새 창)</span></a>
            <span aria-hidden="true">·</span>
            <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침<span className="sr-only"> (새 창)</span></a>
          </div>
          <footer className={styles.footer}>베타 무료 제공 중<span>·</span>투자 판단과 책임은 본인에게 있어요.</footer>
        </div>
      </div>
    </dialog>
  );
}
