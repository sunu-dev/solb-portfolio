'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { activeElapsed, kstDay, type UsageFeature, type UsageSample, USAGE_EVENTS, type UsageEvent } from '@/lib/usageMetrics';

function visitorId(): string {
  try {
    const stored = localStorage.getItem('joobi_usage_visitor');
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;
    const id = crypto.randomUUID(); localStorage.setItem('joobi_usage_visitor', id); return id;
  } catch { return crypto.randomUUID(); }
}

function readingFeature(fallback: UsageFeature): UsageFeature {
  const modal = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
  if (!modal) return fallback;
  const bounds = modal.getBoundingClientRect();
  const line = bounds.top + Math.min(bounds.height * .35, 200);
  const company = modal.querySelector<HTMLElement>('[data-context-exploration], [data-catalog-exploration]');
  if (company) { const r = company.getBoundingClientRect(); if (r.top <= line && r.bottom > line) return 'company'; }
  const ids: [string, UsageFeature][] = [['anchor-chart','chart'],['anchor-news','news'],['anchor-fundamentals','fundamentals'],['anchor-assistant','assistant'],['anchor-learning','learning']];
  let current: UsageFeature = 'analysis';
  for (const [id, feature] of ids) {
    const target = modal.querySelector<HTMLElement>(`#${id}`);
    if (target && target.getBoundingClientRect().top <= line) current = feature;
  }
  return current;
}

export function useUsageTelemetry({ enabled, userId, feature }: { enabled: boolean; userId: string | null; feature: UsageFeature }) {
  const featureRef = useRef(feature);
  useEffect(() => { featureRef.current = feature; }, [feature]);
  useEffect(() => {
    if (!enabled || navigator.webdriver) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    // Resolve identity once and keep refreshed tokens. Never relabel old member samples as guests.
    void supabase.auth.getSession().then(({ data }) => {
      if (disposed || (data.session?.user.id ?? null) !== userId) return;
      let token = data.session?.access_token;
      const auth = supabase.auth.onAuthStateChange((_event, session) => {
        if ((session?.user.id ?? null) === userId) token = session?.access_token;
      });
      const visitor = visitorId();
      let sessionId = crypto.randomUUID();
      let previous = performance.now();
      let lastInteraction = previous;
      let foreground = document.visibilityState === 'visible' && document.hasFocus();
      let current = readingFeature(featureRef.current);
      let pending: UsageSample[] = [];
      let sending = false;
      const push = (start: number, end: number, active: number, event: UsageEvent | null = null) => {
        // Split at Korean midnight: each day receives only its own active time.
        const midnight = Date.parse(`${kstDay(start)}T00:00:00+09:00`) + 86400000;
        if (start < midnight && end > midnight) {
          const first = Math.min(active, midnight - start);
          push(start, midnight, first, event); push(midnight, end, active - first); return;
        }
        if (!active && !event) return;
        pending.push({ id: crypto.randomUUID(), session_id: sessionId, started_at: new Date(start).toISOString(),
          ended_at: new Date(end).toISOString(), active_ms: Math.floor(active), feature: current, event });
        pending = pending.filter(s => Date.parse(s.started_at) >= Date.now() - 590000).slice(-100);
      };
      const measure = () => {
        const now = performance.now();
        const elapsed = Math.floor(activeElapsed(previous, now, lastInteraction, foreground));
        if (elapsed > 0) {
          const start = Date.now() - Math.floor(now - previous);
          push(start, start + elapsed, elapsed);
        }
        previous = now;
        current = readingFeature(featureRef.current);
      };
      const flush = () => {
        if (sending || !pending.length || (userId && !token)) return;
        const batch = pending.slice(0, 20);
        sending = true;
        void fetch('/api/usage', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ visitorId: visitor, samples: batch }), keepalive: true,
        }).then(response => {
          if (response.ok || response.status === 400 || response.status === 413) {
            const sent = new Set(batch.map(s => s.id)); pending = pending.filter(s => !sent.has(s.id));
          }
        }).catch(() => {}).finally(() => { sending = false; });
      };
      const interact = () => {
        const now = performance.now();
        // Pointer movement can fire hundreds of times per second; the 5s timer
        // measures reading position while interaction only renews the idle clock.
        if (now - lastInteraction < 1000) { lastInteraction = now; return; }
        measure();
        if (now - lastInteraction >= 1800000) sessionId = crypto.randomUUID();
        lastInteraction = now;
      };
      const focus = () => { measure(); foreground = document.visibilityState === 'visible' && document.hasFocus(); if (foreground) interact(); else flush(); };
      const event = (e: Event) => {
        const kind = (e as CustomEvent<UsageEvent>).detail;
        if (!USAGE_EVENTS.includes(kind) || !foreground) return;
        interact();
        if (kind === 'explore_step' || kind === 'related_company') current = 'company';
        push(Date.now(), Date.now(), 0, kind); flush();
      };
      const hide = () => { measure(); flush(); foreground = false; };
      const inputEvents = ['pointerdown','pointermove','keydown','scroll','touchstart'] as const;
      inputEvents.forEach(e => window.addEventListener(e, interact, { passive: true, capture: true }));
      window.addEventListener('focus', focus); window.addEventListener('blur', focus);
      document.addEventListener('visibilitychange', focus); window.addEventListener('pagehide', hide);
      window.addEventListener('pageshow', focus); window.addEventListener('joobi-usage', event);
      const tick = window.setInterval(measure, 5000);
      const send = window.setInterval(() => { measure(); flush(); }, 30000);
      push(Date.now(), Date.now(), 0, 'view');
      stop = () => {
        measure(); flush(); auth.data.subscription.unsubscribe();
        clearInterval(tick); clearInterval(send);
        inputEvents.forEach(e => window.removeEventListener(e, interact, true));
        window.removeEventListener('focus', focus); window.removeEventListener('blur', focus);
        document.removeEventListener('visibilitychange', focus); window.removeEventListener('pagehide', hide);
        window.removeEventListener('pageshow', focus); window.removeEventListener('joobi-usage', event);
      };
    }).catch(() => {});
    return () => { disposed = true; stop?.(); };
  }, [enabled, userId]);
}
