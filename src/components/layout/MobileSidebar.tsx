'use client';

import RightSidebar from './RightSidebar';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: Props) {
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
          background: 'white',
          borderRadius: '20px 20px 0 0',
          zIndex: 70,
          overflowY: 'auto',
          padding: '20px 20px 80px',
          animation: 'slideUp 0.3s ease-out',
        }}
        className="mobile-sidebar-sheet"
      >
        <div style={{ width: 40, height: 4, background: '#E5E8EB', borderRadius: 2, margin: '0 auto 20px' }} />
        <RightSidebar />
      </div>
    </>
  );
}