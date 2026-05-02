'use client';

import { useEffect, useState, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { Alert } from '@/utils/alertsEngine';
import { isAlertSuppressed } from '@/utils/alertLearning';
import { DISCLAIMER_SHORT } from '@/utils/alertCompliance';

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

    // 정책 SSOT: docs/NOTIFICATION_POLICY.md §2,§3.3
    // channels에 'toast' 포함된 신규 알림만 띄움. severity 게이트는 ALERT_POLICY가 흡수.
    const newAlert = alerts.find(
      a =>
        a.channels?.includes('toast') &&
        !dismissedAlerts.includes(a.id) &&
        !shownIdsRef.current.has(a.id) &&
        !isAlertSuppressed(a.id)
    );

    if (newAlert) {
      shownIdsRef.current.add(newAlert.id);
      setCurrentToast(newAlert);
      setVisible(true);

      // A11y: 8초 표시 (정책 §3.3, §9) — 스크린리더 사용자 확보
      const t1 = setTimeout(() => {
        setVisible(false);
        const t2 = setTimeout(() => {
          setCurrentToast(null);
          cooldownRef.current = true;
          const t3 = setTimeout(() => { cooldownRef.current = false; }, 60_000);
          timersRef.current.push(t3);
        }, 300);
        timersRef.current.push(t2);
      }, 8000);
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
      role="status"
      aria-live="polite"
      aria-label={`알림: ${currentToast.message}`}
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        top: visible ? 'calc(60px + env(safe-area-inset-top, 0px))' : '0px',
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
        {/* 면책 — 정책 SSOT: docs/NOTIFICATION_POLICY.md §4.3 */}
        <div style={{ fontSize: 9, color: '#B0B8C1', marginTop: 6, lineHeight: 1.3 }}>
          {DISCLAIMER_SHORT}
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="알림 닫기"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '16px',
          color: '#B0B8C1',
          padding: '0 0 0 8px',
          flexShrink: 0,
          lineHeight: 1,
          minWidth: 32,
          minHeight: 32,
        }}
      >
        ✕
      </button>
    </div>
  );
}
