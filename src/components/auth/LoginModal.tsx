'use client';

import { useCallback, useEffect } from 'react';

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
          <span style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
            <span style={{ background: 'linear-gradient(135deg, #1B6B3A 0%, #3182F6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>솔</span><span style={{ color: '#191F28' }}>비서</span>
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
          투자 비서
        </p>

        {/* Google Button */}
        <button
          onClick={onGoogleLogin}
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
            cursor: 'pointer',
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
          onClick={onKakaoLogin}
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
            cursor: 'pointer',
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
        <p style={{ fontSize: '12px', color: '#B0B8C1', textAlign: 'center', lineHeight: 1.5 }}>
          로그인하면 어디서든 내 포트폴리오를
          <br />
          확인할 수 있어요.
        </p>
      </div>
    </div>
  );
}
