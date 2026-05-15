'use client';

import { useCallback, useEffect, useState } from 'react';

const CONSENT_TERMS_VERSION = 'v2';
const CONSENT_PRIVACY_VERSION = 'v2';
export const CONSENT_STORAGE_KEY = 'solb_consent_pending';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleLogin: () => void;
  onKakaoLogin: () => void;
}

export default function LoginModal({ isOpen, onClose, onGoogleLogin, onKakaoLogin }: LoginModalProps) {
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // 9인 패널 BLOCKER #9·#10: 14세 게이트 + 동의 시점 DB 로깅
  const [age14, setAge14] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const allChecked = age14 && agreeTerms && agreePrivacy;

  const persistConsent = useCallback(() => {
    try {
      sessionStorage.setItem(
        CONSENT_STORAGE_KEY,
        JSON.stringify({
          age_14_plus: true,
          terms: CONSENT_TERMS_VERSION,
          privacy: CONSENT_PRIVACY_VERSION,
          ts: new Date().toISOString(),
        }),
      );
    } catch {
      // sessionStorage 실패 시 동의 INSERT는 누락되지만 OAuth는 계속 — 베타 사용자 차단보다 우선
    }
  }, []);

  const handleGoogle = useCallback(() => {
    if (!allChecked) return;
    persistConsent();
    onGoogleLogin();
  }, [allChecked, onGoogleLogin, persistConsent]);

  const handleKakao = useCallback(() => {
    if (!allChecked) return;
    persistConsent();
    onKakaoLogin();
  }, [allChecked, onKakaoLogin, persistConsent]);

  // Scroll lock when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.30)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: '#fff',
          borderRadius: '20px',
          padding: '48px 40px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          margin: '0 16px',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#EF4452"/>
            <path
              d="M 7 5 L 12 5 L 12 16 C 12 21 20 21 20 12"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <polygon points="20,8 22.5,13 17.5,13" fill="white"/>
          </svg>
          <span style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1,
            background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-hover) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            주비
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: '16px',
            color: '#8B95A1',
            textAlign: 'center',
            lineHeight: 1.5,
            marginBottom: '32px',
          }}
        >
          내 주식, 쉽게 읽어주는
          <br />
          주식 비서
        </p>

        {/* 동의 체크박스 — 14세·약관·개인정보 (필수) */}
        <div style={{
          width: '100%',
          background: '#F9FAFB',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <ConsentRow checked={age14} onChange={setAge14}>
            <strong style={{ fontWeight: 600, color: '#191F28' }}>(필수)</strong> 만 14세 이상입니다
          </ConsentRow>
          <ConsentRow checked={agreeTerms} onChange={setAgreeTerms}>
            <strong style={{ fontWeight: 600, color: '#191F28' }}>(필수)</strong>{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>이용약관</a>
            에 동의합니다
          </ConsentRow>
          <ConsentRow checked={agreePrivacy} onChange={setAgreePrivacy}>
            <strong style={{ fontWeight: 600, color: '#191F28' }}>(필수)</strong>{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>개인정보처리방침</a>
            에 동의합니다 (국외이전 포함)
          </ConsentRow>
        </div>

        {/* Google Button */}
        <button
          onClick={handleGoogle}
          disabled={!allChecked}
          style={{
            width: '100%',
            height: '48px',
            borderRadius: '12px',
            border: '1px solid #E5E8EB',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '15px',
            fontWeight: 600,
            color: '#191F28',
            cursor: allChecked ? 'pointer' : 'not-allowed',
            opacity: allChecked ? 1 : 0.5,
            marginBottom: '10px',
          }}
        >
          {/* Google icon SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          Google로 시작하기
        </button>

        {/* Kakao Button */}
        <button
          onClick={handleKakao}
          disabled={!allChecked}
          style={{
            width: '100%',
            height: '48px',
            borderRadius: '12px',
            border: 'none',
            background: '#FEE500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '15px',
            fontWeight: 600,
            color: '#191F28',
            cursor: allChecked ? 'pointer' : 'not-allowed',
            opacity: allChecked ? 1 : 0.5,
            marginBottom: '20px',
          }}
        >
          {/* Kakao icon SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9 0.6C4.029 0.6 0 3.726 0 7.554c0 2.467 1.639 4.632 4.104 5.862l-1.04 3.822c-.092.337.293.605.584.407l4.574-3.03c.257.02.517.03.778.03 4.971 0 9-3.126 9-6.954C18 3.726 13.971 0.6 9 0.6z"
              fill="#191F28"
            />
          </svg>
          카카오로 시작하기
        </button>

        {/* Skip link */}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '13px',
            color: '#8B95A1',
            cursor: 'pointer',
            marginBottom: '24px',
            padding: '4px 0',
          }}
        >
          로그인 없이 둘러보기 &rsaquo;
        </button>

        {/* Bottom note */}
        <p style={{ fontSize: '12px', color: '#B0B8C1', textAlign: 'center', lineHeight: 1.6 }}>
          로그인하면 어디서든 내 포트폴리오를
          <br />
          확인할 수 있어요.
        </p>

        {/* 면책 안내 */}
        <p style={{ fontSize: '11px', color: '#B0B8C1', textAlign: 'center', lineHeight: 1.6, marginTop: 12 }}>
          본 서비스는 투자 참고용이며, 투자 결과에 대한 책임은 이용자 본인에게 있습니다.
          <br />
          <strong style={{ color: 'var(--brand-primary)' }}>베타 단계로 무료 제공 중</strong>입니다.
        </p>
      </div>
    </div>
  );
}

// ─── 동의 체크박스 row 컴포넌트 ────────────────────────────────────────────
function ConsentRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12,
      color: '#4E5968',
      cursor: 'pointer',
      lineHeight: 1.5,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: 16,
          height: 16,
          accentColor: 'var(--brand-primary)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      />
      <span>{children}</span>
    </label>
  );
}
