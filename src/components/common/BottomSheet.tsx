'use client';

import { useEffect, useRef, ReactNode } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: string;
  paddingBottom?: string;
}

export default function BottomSheet({ isOpen, onClose, children, maxHeight = '80vh', paddingBottom }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // iOS-safe body scroll lock: position fixed preserves background scroll position
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Swipe-down-to-dismiss with passive:false so preventDefault works
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !isOpen) return;

    let startY = 0;
    let isDragging = false;

    const onTouchStart = (e: TouchEvent) => {
      if (sheet.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      isDragging = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || sheet.scrollTop > 0) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { isDragging = false; return; }
      e.preventDefault();
      sheet.style.transform = `translateY(${dy}px)`;
      sheet.style.transition = 'none';
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isDragging) return;
      isDragging = false;
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > 120) {
        sheet.style.transform = `translateY(100%)`;
        sheet.style.transition = 'transform 0.25s ease-out';
        setTimeout(() => onCloseRef.current(), 240);
      } else {
        sheet.style.transform = '';
        sheet.style.transition = 'transform 0.3s ease-out';
      }
    };

    sheet.addEventListener('touchstart', onTouchStart, { passive: true });
    sheet.addEventListener('touchmove', onTouchMove, { passive: false });
    sheet.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      sheet.removeEventListener('touchstart', onTouchStart);
      sheet.removeEventListener('touchmove', onTouchMove);
      sheet.removeEventListener('touchend', onTouchEnd);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 60 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="mobile-sidebar-sheet"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight,
          background: 'var(--surface, white)',
          borderRadius: '20px 20px 0 0',
          zIndex: 70,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          animation: 'slideUp 0.3s ease-out',
          paddingBottom: paddingBottom ?? `calc(20px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        {/* Drag handle */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          background: 'var(--surface, white)',
          paddingTop: 12, paddingBottom: 8,
          cursor: 'grab',
        }}>
          <div style={{ width: 40, height: 4, background: 'var(--border-light, #E5E8EB)', borderRadius: 2, margin: '0 auto' }} />
        </div>

        {children}
      </div>
    </>
  );
}
