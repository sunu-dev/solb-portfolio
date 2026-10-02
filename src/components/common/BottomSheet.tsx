'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useModalViewport } from '@/hooks/useModalViewport';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: string;
  paddingBottom?: string;
  /** lg+(데스크톱)에서 풀폭 바텀시트 대신 중앙 모달로 표현(토스/카카오 '전체' 데스크톱 패턴). */
  desktopVariant?: boolean;
}

export default function BottomSheet({ isOpen, onClose, children, maxHeight = '80vh', paddingBottom, desktopVariant = false }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useModalViewport(isOpen, sheetRef);
  useFocusTrap(isOpen, sheetRef, onClose);

  // Swipe-down-to-dismiss with passive:false so preventDefault works
  useEffect(() => {
    const sheet = sheetRef.current;
    const handle = handleRef.current;
    if (!sheet || !handle || !isOpen) return;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    let startY = 0;
    let isDragging = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || (e.target as Element).closest('button')) return;
      startY = e.touches[0].clientY;
      isDragging = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { sheet.style.transform = ''; return; }
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
        closeTimer = setTimeout(() => onCloseRef.current(), 240);
      } else {
        sheet.style.transform = '';
        sheet.style.transition = 'transform 0.3s ease-out';
      }
    };

    handle.addEventListener('touchstart', onTouchStart, { passive: true });
    handle.addEventListener('touchmove', onTouchMove, { passive: false });
    handle.addEventListener('touchend', onTouchEnd, { passive: true });
    const onTouchCancel = () => {
      isDragging = false;
      sheet.style.transform = '';
      sheet.style.transition = '';
    };
    handle.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      if (closeTimer) clearTimeout(closeTimer);
      onTouchCancel();
      handle.removeEventListener('touchcancel', onTouchCancel);
      handle.removeEventListener('touchstart', onTouchStart);
      handle.removeEventListener('touchmove', onTouchMove);
      handle.removeEventListener('touchend', onTouchEnd);
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

      {/* 데스크톱 모달 변형 — desktopVariant일 때 lg+에서 중앙 모달로 전환 */}
      {desktopVariant && (
        <style>{`
          @keyframes bottomsheetFadeScale {
            from { opacity: 0; transform: translateX(-50%) scale(0.97); }
            to   { opacity: 1; transform: translateX(-50%) scale(1); }
          }
          @media (min-width: 1024px) {
            .bottomsheet-desktop {
              left: 50% !important;
              right: auto !important;
              bottom: auto !important;
              top: 64px !important;
              width: 440px !important;
              max-width: calc(100vw - 32px) !important;
              max-height: 78vh !important;
              transform: translateX(-50%);
              border-radius: 20px !important;
              box-shadow: 0 12px 40px rgba(0,0,0,0.18) !important;
              animation: bottomsheetFadeScale 0.2s ease-out !important;
            }
            /* 드래그 그립은 데스크톱에선 무의미 → 숨기되 핸들의 상단 여백은 유지(헤더가 천장에 붙지 않게) */
            .bottomsheet-desktop .bottomsheet-grip { display: none !important; }
            .bottomsheet-desktop .bottomsheet-handle { padding-top: 16px !important; padding-bottom: 4px !important; cursor: default !important; }
            /* 데스크톱 모달엔 닫기(X) — Esc·배경 외 명시적 닫기 어포던스 */
            .bottomsheet-desktop .bottomsheet-close { display: flex !important; }
          }
        `}</style>
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="상세 메뉴"
        tabIndex={-1}
        className={`mobile-sidebar-sheet${desktopVariant ? ' bottomsheet-desktop' : ''}`}
        style={{
          position: 'fixed',
          bottom: 'var(--modal-viewport-bottom, 0px)',
          left: 0,
          right: 0,
          maxHeight: `min(${maxHeight}, calc(var(--modal-viewport-height, 100dvh) - 16px))`,
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
        {/* Drag handle (모바일) / 상단 여백+닫기 바 (데스크톱) */}
        <div ref={handleRef} className="bottomsheet-handle" style={{
          position: 'sticky', top: 0, zIndex: 2,
          background: 'var(--surface, white)',
          paddingTop: 12, paddingBottom: 8,
          cursor: 'grab',
        }}>
          <div className="bottomsheet-grip" style={{ width: 40, height: 4, background: 'var(--border-light, #E5E8EB)', borderRadius: 2, margin: '0 auto' }} />
          {desktopVariant && (
            <button
              className="bottomsheet-close"
              onClick={onClose}
              aria-label="닫기"
              style={{
                display: 'none', position: 'absolute', top: 10, right: 12,
                width: 32, height: 32, borderRadius: 8,
                alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-subtle, #F2F4F6)', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary, #8B95A1)',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {children}
      </div>
    </>
  );
}
