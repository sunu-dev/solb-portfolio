'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getAnalysisDay, getAnalysisRemaining, readAnalysisQuotaResponse, type AnalysisQuota } from '@/utils/analysisQuota';

export type AnalysisQuotaStatus = 'checking' | 'ready' | 'unavailable' | 'signed-out';

/** Read personal usage before offering a new answer. POST remains the authority. */
export function useAnalysisQuota(enabled: boolean) {
  const [state, setState] = useState<{ quota: AnalysisQuota | null; status: AnalysisQuotaStatus }>({ quota: null, status: 'checking' });
  const ownerRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  const versionRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const refreshRef = useRef<(() => void) | null>(null);

  const acceptResponse = useCallback((data: unknown, owner: string | null) => {
    if (!activeRef.current || owner !== ownerRef.current) return null;
    const quota = readAnalysisQuotaResponse(data);
    if (!quota) return null;
    // An older GET must never restore a count that this completed POST used.
    versionRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (getAnalysisRemaining(quota) === null) {
      refreshRef.current?.();
      return null;
    }
    setState({ quota, status: 'ready' });
    return quota;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    activeRef.current = true;
    let disposed = false;
    let receivedAuthEvent = false;
    let session: Session | null = null;
    let sessionKnown = false;
    let lastReadAt = 0;
    let lastReadDay = '';
    let midnightTimer: ReturnType<typeof setTimeout>;

    const refresh = (force = false) => {
      if (disposed || !sessionKnown) return;
      const day = getAnalysisDay();
      if (!force && day === lastReadDay && Date.now() - lastReadAt < 15_000) return;
      lastReadAt = Date.now();
      lastReadDay = day;
      const version = ++versionRef.current;
      controllerRef.current?.abort();
      controllerRef.current = null;
      if (!session?.access_token) {
        setState({ quota: null, status: 'signed-out' });
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      const token = session.access_token;
      setState({ quota: null, status: 'checking' });
      // A stalled usage lookup must not leave every question permanently disabled.
      const timeout = setTimeout(() => controller.abort(), 8_000);
      const current = () => !disposed && versionRef.current === version;
      void (async () => {
        try {
          const response = await fetch('/api/ai-analysis', {
            method: 'GET', cache: 'no-store', signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await response.json();
          if (!current()) return;
          if (response.status === 401) {
            setState({ quota: null, status: 'signed-out' });
            return;
          }
          const quota = response.ok ? readAnalysisQuotaResponse(data) : null;
          setState(quota && getAnalysisRemaining(quota) !== null
            ? { quota, status: 'ready' }
            : { quota: null, status: 'unavailable' });
        } catch {
          if (current()) setState({ quota: null, status: 'unavailable' });
        } finally {
          clearTimeout(timeout);
          if (current()) controllerRef.current = null;
        }
      })();
    };

    const updateSession = (nextSession: Session | null) => {
      const nextOwner = nextSession?.user.id ?? null;
      const changed = !sessionKnown || ownerRef.current !== nextOwner || session?.access_token !== nextSession?.access_token;
      ownerRef.current = nextOwner;
      session = nextSession;
      sessionKnown = true;
      if (changed) refresh(true);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (disposed) return;
      receivedAuthEvent = true;
      updateSession(nextSession);
    });
    void supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!disposed && !receivedAuthEvent) updateSession(initialSession);
    }).catch(() => {
      if (!disposed && !receivedAuthEvent) setState({ quota: null, status: 'unavailable' });
    });

    refreshRef.current = () => refresh(true);
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    const scheduleMidnight = () => {
      const nextDay = Date.parse(`${getAnalysisDay()}T00:00:00+09:00`) + 86_400_000;
      midnightTimer = setTimeout(() => {
        refresh(true);
        scheduleMidnight();
      }, Math.max(50, nextDay - Date.now() + 50));
    };
    scheduleMidnight();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      disposed = true;
      activeRef.current = false;
      versionRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      refreshRef.current = null;
      subscription.unsubscribe();
      clearTimeout(midnightTimer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [enabled]);

  return { quota: state.quota, status: state.status, remaining: getAnalysisRemaining(state.quota), acceptResponse };
}
