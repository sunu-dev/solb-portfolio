'use client';

import { useEffect, useState, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { Alert } from '@/utils/alertsEngine';

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
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef(false);

  useEffect(() => {
    // Only show truly critical alerts as toasts (severity 1 only)
    // severity 2+ alerts are visible in the sidebar
    if (cooldownRef.current || currentToast) return;

    const newAlert = alerts.find(
      a =>
        a.severity <= 1 &&
        !dismissedAlerts.includes(a.id) &&
        !shownIdsRef.current.has(a.id)
    );

    if (newAlert) {
      shownIdsRef.current.add(newAlert.id);
      setCurrentToast(newAlert);
      setVisible(true);

      // Auto-dismiss after 5 seconds
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setTimeout(() => {
          setCurrentToast(null);
          // 60s cooldown before next toast
          cooldownRef.current = true;
          setTimeout(() => { cooldownRef.current = false; }, 60_000);
        }, 300);
      }, 5000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [alerts, dismissedAlerts, currentToast]);

  const handleDismiss = () => {
    if (currentToast) {
      dismissAlert(currentToast.id);
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(() => setCurrentToast(null), 300);
  };

  if (!currentToast) return null;

  const icon = TOAST_ICON[currentToast.type];
  const accentColor = TOAST_COLOR[currentToast.type];

  return (
    <div
      style={{
        position: 'fixed',
        top: visible ? '60px' : '0px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'white',
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
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#191F28', lineHeight: 1.4 }}>
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
