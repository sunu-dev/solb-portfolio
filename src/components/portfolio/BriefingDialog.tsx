'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useEconomicEvents } from '@/hooks/useEconomicEvents';
import { recentResults, unseenResults } from '@/lib/economicEvents';
import MorningBriefing from './MorningBriefing';
import { isGuideId } from '@/lib/guideNotebook';

const SEEN_KEY = 'solb_briefing_login_v1';

export default function BriefingDialog({ userId, signedInAt, ready }: {
  userId?: string;
  signedInAt?: string;
  ready: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const shown = useRef<string | null>(null);
  const { data } = useEconomicEvents();
  const checkedResults = useRef<string | null>(null);
  const dismissed = useRef<string | null>(null);
  const close = useCallback(() => dialog.current?.close(), []);
  const markSeen = () => {
    if (!userId) return;
    dismissed.current = userId;
    const keys = recentResults(data?.events || []).slice(0, 1).map(e => e.key);
    try {
      const raw = JSON.parse(localStorage.getItem(`joobi_economic_seen:${userId}`) || '[]');
      const previous = Array.isArray(raw) ? raw.filter(k => typeof k === 'string') : [];
      localStorage.setItem(`joobi_economic_seen:${userId}`, JSON.stringify([...new Set([...previous, ...keys])].slice(-100)));
    } catch { /* storage disabled; only suppress this visit */ }
  };

  useEffect(() => {
    if (!ready || !userId || !data || checkedResults.current === userId || dismissed.current === userId) return;
    checkedResults.current = userId;
    let seen: string[] = [];
    try { const raw = JSON.parse(localStorage.getItem(`joobi_economic_seen:${userId}`) || '[]'); if (Array.isArray(raw)) seen = raw; } catch { /* storage disabled */ }
    if (unseenResults(recentResults(data.events).slice(0, 1), seen).length && !dialog.current?.open) dialog.current?.showModal();
  }, [ready, userId, data]);

  useEffect(() => {
    const open = () => {
      if (!dialog.current?.open) dialog.current?.showModal();
    };
    const openGuide = (event: Event) => {
      if (isGuideId((event as CustomEvent).detail?.id) && dialog.current?.open) dialog.current.close();
    };
    window.addEventListener('open-briefing', open);
    window.addEventListener('open-market-guide', openGuide);
    return () => {
      window.removeEventListener('open-briefing', open);
      window.removeEventListener('open-market-guide', openGuide);
    };
  }, []);

  useEffect(() => {
    if (!userId || !signedInAt || !ready) return;
    const login = `${userId}:${signedInAt}`;
    if (shown.current === login) return;
    try {
      if (localStorage.getItem(SEEN_KEY) === login) return;
    } catch { /* 메모리에서 중복 열림 방지 */ }
    const frame = requestAnimationFrame(() => {
      if (!dialog.current) return;
      if (!dialog.current.open) dialog.current.showModal();
      shown.current = login;
      try { localStorage.setItem(SEEN_KEY, login); } catch { /* storage 차단 */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [userId, signedInAt, ready]);

  return (
    <dialog ref={dialog} className="briefing-dialog" aria-label="오늘의 브리핑" onClose={markSeen}
      onClick={event => { if (event.target === dialog.current) close(); }}>
      <div>
        <MorningBriefing onClose={close} />
      </div>
    </dialog>
  );
}
