'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';

export function useNotification() {
  const { alerts, dismissedAlerts } = usePortfolioStore();
  const notifiedRef = useRef<Set<string>>(new Set());
  const permissionRef = useRef<NotificationPermission>('default');

  // Register service worker + read current permission on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    // Register SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    permissionRef.current = Notification.permission;
  }, []);

  // Request permission (call this from UI button)
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    permissionRef.current = permission;
    return permission === 'granted';
  }, []);

  // Show notification for new urgent/risk alerts
  useEffect(() => {
    if (permissionRef.current !== 'granted') return;

    const newAlerts = alerts.filter(a =>
      a.severity <= 2 && // urgent or risk only
      !dismissedAlerts.includes(a.id) &&
      !notifiedRef.current.has(a.id)
    );

    newAlerts.forEach(alert => {
      notifiedRef.current.add(alert.id);

      try {
        new Notification(alert.message, {
          body: alert.detail,
          icon: '/icon-192.png',
          tag: alert.id,
        });
      } catch {
        // Fallback: use service worker
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'show-notification',
            title: alert.message,
            body: alert.detail,
            tag: alert.id,
          });
        }
      }
    });
  }, [alerts, dismissedAlerts]);

  return { requestPermission, permission: permissionRef.current };
}
