'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WatchFeed } from '@/lib/marketWatch';

let cached: { data: WatchFeed; at: number } | undefined;
let pending: Promise<WatchFeed> | undefined;
function load(): Promise<WatchFeed> {
  if (pending) return pending;
  if (cached && Date.now() - cached.at < 30000) return Promise.resolve(cached.data);
  pending = fetch('/api/market-watch', { signal: AbortSignal.timeout(12000) }).then(async response => {
    if (!response.ok) throw new Error('Market watch unavailable');
    const data = await response.json() as WatchFeed;
    if (!Array.isArray(data.events) || !Array.isArray(data.runs) || !Number.isFinite(Date.parse(data.servedAt))) throw new Error('Invalid market watch');
    cached = { data, at: Date.now() }; return data;
  }).finally(() => { pending = undefined; });
  return pending;
}

export function useMarketWatch() {
  const [state, setState] = useState<{ data?: WatchFeed; error?: string; loading: boolean }>({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const update = () => {
      void load().then(data => { if (active) setState({ data, loading: false }); })
        .catch(() => { if (active) setState(previous => ({ ...previous, error: '시장 소식을 불러오지 못했어요.', loading: false })); });
    };
    update();
    const visibleUpdate = () => { if (document.visibilityState === 'visible') update(); };
    const timer = setInterval(visibleUpdate, 60000);
    document.addEventListener('visibilitychange', visibleUpdate);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', visibleUpdate); };
  }, [attempt]);
  const retry = useCallback(() => { cached = undefined; setAttempt(value => value + 1); }, []);
  return { ...state, retry };
}
