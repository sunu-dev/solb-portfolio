'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { supabase } from '@/lib/supabase';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

export function useNotification() {
  const { alerts, dismissedAlerts } = usePortfolioStore();
  const notifiedRef = useRef<Set<string>>(new Set());
  const permissionRef = useRef<NotificationPermission>('default');
  const [pushEnabled, setPushEnabled] = useState(false);

  // Register service worker + read current permission on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    // Register SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    permissionRef.current = Notification.permission;

    // 이미 구독 중인지 확인
    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.getSubscription().then(sub => {
          setPushEnabled(!!sub);
        })
      ).catch(() => {});
    }
  }, []);

  // Web Push 구독
  const subscribePush = useCallback(async (): Promise<boolean> => {
    try {
      const reg = await navigator.serviceWorker.ready;

      // VAPID 공개키 가져오기
      const res = await fetch('/api/push/vapid-key');
      if (!res.ok) return false;
      const { publicKey } = await res.json() as { publicKey: string };

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 로그인 토큰으로 Supabase에 저장
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return false;

      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, token: session.access_token }),
      });

      if (saveRes.ok) {
        setPushEnabled(true);
        return true;
      }
      return false;
    } catch (e) {
      console.error('[push] subscribe failed:', e);
      return false;
    }
  }, []);

  // Web Push 구독 해제
  const unsubscribePush = useCallback(async (): Promise<boolean> => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }

      setPushEnabled(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Request permission + subscribe
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    permissionRef.current = permission;
    if (permission === 'granted') {
      await subscribePush();
    }
    return permission === 'granted';
  }, [subscribePush]);

  // Show local notification for new urgent/risk alerts (앱 열려있을 때)
  useEffect(() => {
    if (permissionRef.current !== 'granted') return;

    const newAlerts = alerts.filter(a =>
      a.severity <= 2 &&
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

  return {
    requestPermission,
    permission: permissionRef.current,
    pushEnabled,
    subscribePush,
    unsubscribePush,
  };
}
