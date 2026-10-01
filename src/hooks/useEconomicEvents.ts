'use client';
import { useEffect, useMemo, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { EconomicFeed } from '@/lib/economicEvents';
const cache = new Map<string, { data?: EconomicFeed; at: number; pending?: Promise<EconomicFeed> }>();
function load(key: string) {
  const entry = cache.get(key);
  if (entry?.data && Date.now()-entry.at < 300000) return Promise.resolve(entry.data);
  if (entry?.pending) return entry.pending;
  const pending = fetch(`/api/economic-events${key ? `?symbols=${encodeURIComponent(key)}` : ''}`, { signal: AbortSignal.timeout(25000) }).then(async r => {
    if (!r.ok) throw new Error('일정을 불러오지 못했어요.');
    const data = await r.json() as EconomicFeed;
    if (!Array.isArray(data.events)) throw new Error('일정 응답을 확인할 수 없어요.');
    cache.set(key, { data, at: Date.now() }); return data;
  }).catch(error => { cache.delete(key); throw error; });
  cache.set(key, { ...entry, at: entry?.at || 0, pending }); return pending;
}
export function useEconomicEvents() {
  const stocks = usePortfolioStore(s=>s.stocks);
  const symbols = useMemo(()=>[...new Set([...stocks.investing,...stocks.watching].map(s=>s.symbol))].sort(),[stocks]);
  const key = symbols.slice(0,30).join(',');
  const [state,setState] = useState<{ key: string; data?: EconomicFeed; error?: string }>({key});
  const [retry,setRetry] = useState(0);
  useEffect(()=>{
    let active = true;
    const update = () => { void load(key).then(data=>{ if(active)setState({key,data}); }).catch(()=>{if(active)setState({key,error:'일정을 불러오지 못했어요. 다시 시도해주세요.'});}); };
    update(); const timer = setInterval(update,300000);
    return ()=>{active=false;clearInterval(timer);};
  },[key,retry]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined, symbols, retry: ()=>setRetry(n=>n+1) };
}
