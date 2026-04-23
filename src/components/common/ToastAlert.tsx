'use client';

import { useEffect, useState, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { Alert } from '@/utils/alertsEngine';
import { isAlertSuppressed } from '@/utils/alertLearning';

const TOAST_ICON: Record<Alert['type'], string> = {
  urgent: '🚨',
  risk: '⚠️',
  opportunity: '💡',
  insight: '✨',
  celebrate: '🎉',
};

const TOAST_COLOR: Record<Alert['type'], string> = {
  urgent: '#EF4452',
  risk: '#FF9500',
  opportunity: '#00C6BE',
  insight: '#3182F6',
  celebrate: '#AF52DE',
};

export default function ToastAlert() {
  const { alerts, dismissedAlerts, dismissAlert } = usePortfolioStore();
  const [currentToast, setCurrentToast] = useState<Alert | null>(null);
  const [visible, setVisible] = useState(false);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const cooldownRef = useRef(false);

  const clearAllTimers = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    if (cooldownRef.current || currentToast) return;

    const newAlert = alerts.find(
      a =>
        a.severity <= 1 &&
        !dismissedAlerts.includes(a.id) &&
        !shownIdsRef.current.has(a.id) &&
        // 학습: 반복 해제된 타입 토스트 스킵 (방해 민감도 높음)
        !isAlertSuppressed(a.id)
    );

    if (newAlert) {
      shownIdsRef.current.add(newAlert.id);
      setCurrentToast(newAlert);
      setVisible(true);

      const t1 = setTimeout(() => {
        setVisible(false);
        const t2 = setTimeout(() => {
          setCurrentToast(null);
          cooldownRef.current = true;
          const t3 = setTimeout(() => { cooldownRef.current = false; }, 60_000);
          timersRef.current.push(t3);
        }, 300);
        timersRef.current.push(t2);
      }, 5000);
      timersRef.current.push(t1);
    }

    return () => clearAllTimers();
  }, [alerts, dismissedAlerts, currentToast]);

  const handleDismiss = () => {
    if (currentToast) {
      dismissAlert(currentToast.id);
    }
    clearAllTimers();
    setVisible(false);
    const t = setTimeout(() => setCurrentToast(null), 300);
    timersRef.current.push(t);
  };

  if (!currentToast) return null;

  const icon = TOAST_ICON[currentToast.type];
  const accentColor = TOAST_COLOR[currentToast.type];

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        top: visible ? '60px' : '0px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--surface, white)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        padding: '16px 24px',
        maxWidth: '420px',
        width: '90%',
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        borderLeft: `3px solid ${accentColor}`,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #191F28)', lineHeight: 1.4 }}>
          {currentToast.message}
        </div>
        <div style={{ fontSize: '12px', color: '#8B95A1', marginTop: '4px', lineHeight: 1.4 }}>
          {currentToast.detail}
        </div>
      </div>
      <button
        onClick={handleDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '16px',
          color: '#B0B8C1',
          padding: '0 0 0 8px',
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}
