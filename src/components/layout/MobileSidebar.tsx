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
        <RightSidebar />
        <BadgeSection />
      </div>
    </>
  );
}