'use client';

import { useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';

export function useRealtimePrice() {
  const { apiKey, stocks, updateMacroEntry } = usePortfolioStore();
  const wsRef = useRef<WebSocket | null>(null);

  // 심볼 목록을 문자열로 직렬화하여 deps로 사용 (종목 교체 감지)
  const allSymbolsKey = [...(stocks.investing || []), ...(stocks.watching || []), ...(stocks.sold || [])]
    .map(s => s.symbol)
    .filter(s => !s.endsWith('.KS') && !s.endsWith('.KQ'))
    .sort()
    .join(',');

  useEffect(() => {
    if (!apiKey) return;

    const allStocks = [...(stocks.investing || []), ...(stocks.watching || []), ...(stocks.sold || [])];
    const usSymbols = allStocks
      .map(s => s.symbol)
      .filter(s => !s.endsWith('.KS') && !s.endsWith('.KQ'));

    if (usSymbols.length === 0) return;

    // 연결마다 독립적인 구독 Set 사용 (race condition 방지)
    const subscribed = new Set<string>();

    const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const toSubscribe = usSymbols.slice(0, 50);
      toSubscribe.forEach(symbol => {
        ws.send(JSON.stringify({ type: 'subscribe', symbol }));
        subscribed.add(symbol);
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'trade' && msg.data?.length) {
          const latest: Record<string, { p: number; v: number; t: number }> = {};
          for (const trade of msg.data) {
            if (!latest[trade.s] || trade.t > latest[trade.s].t) {
              latest[trade.s] = { p: trade.p, v: trade.v, t: trade.t };
            }
          }

          for (const [symbol, trade] of Object.entries(latest)) {
            const existing = usePortfolioStore.getState().macroData[symbol] as any;
            if (existing) {
              const pc = existing.pc || existing.c;
              const change = trade.p - pc;
              const changePercent = pc ? (change / pc) * 100 : 0;
              updateMacroEntry(symbol, {
                ...existing,
                c: trade.p,
                d: change,
                dp: changePercent,
              });
            }
          }
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => { /* Silent — falls back to polling */ };

    return () => {
      // Cleanup: unsubscribe + close (이 연결의 subscribed Set만 사용)
      if (ws.readyState === WebSocket.OPEN) {
        subscribed.forEach(symbol => {
          ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
        });
      }
      ws.close();
    };
  }, [apiKey, allSymbolsKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
