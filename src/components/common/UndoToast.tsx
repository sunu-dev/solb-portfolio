'use client';

import { useEffect, useRef } from 'react';

interface Props {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
  bottom?: number; // 기본 80, 바텀시트 위에 띄울 때는 더 높게
}

export default function UndoToast({ message, onUndo, onDismiss, durationMs = 5000, bottom = 80 }: Props) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, durationMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [durationMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--text-primary, #191F28)',
        color: '#FFFFFF',
        padding: '12px 20px',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 1100,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        fontSize: 13,
        fontWeight: 500,
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <span>{message}</span>
      <button
        onClick={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          onUndo();
        }}
        style={{
          background: 'none',
          border: 'none',
          color: '#3182F6',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          padding: '4px 8px',
        }}
      >
        되돌리기
      </button>
    </div>
  );
}
