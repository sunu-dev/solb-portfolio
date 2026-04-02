'use client';

import { useEffect } from 'react';
import RightSidebar from './RightSidebar';
import BadgeSection from '@/components/portfolio/BadgeSection';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: Props) {
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
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 60 }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '80vh',
          background: 'var(--surface, white)',
          borderRadius: '20px 20px 0 0',
          zIndex: 70,
          overflowY: 'auto',
          paddingTop: 20,
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
          animation: 'slideUp 0.3s ease-out',
        }}
        className="mobile-sidebar-sheet"
      >
        <div style={{ width: 40, height: 4, background: 'var(--border-light, #E5E8EB)', borderRadius: 2, margin: '0 auto 20px' }} />
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('toggle-settings'));
            onClose();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '14px 12px',
            marginBottom: 12,
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--text-primary, #191F28)',
            background: 'var(--bg-subtle, #F2F4F6)',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          설정
        </button>
        <RightSidebar />
        <BadgeSection />
      </div>
    </>
  );
}