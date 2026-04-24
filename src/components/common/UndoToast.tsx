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
  // 최신 콜백 참조 ref — 부모 리렌더로 onDismiss/onUndo가 새 인스턴스가 돼도
  // useEffect 의존성에서 제외해야 타이머가 리셋되지 않음
  const onDismissRef = useRef(onDismiss);
  const onUndoRef = useRef(onUndo);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);
  useEffect(() => { onUndoRef.current = onUndo; }, [onUndo]);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismissRef.current(), durationMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // durationMs만 의존 — 콜백은 ref로 최신값 참조
  }, [durationMs]);

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
          onUndoRef.current();
        }}
        aria-label="방금 해제한 알림 되돌리기"
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
