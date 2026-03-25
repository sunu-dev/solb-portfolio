'use client';

import { useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';

export function useRealtimePrice() {
  const { apiKey, stocks, updateMacroEntry } = usePortfolioStore();
  const wsRef = useRef<WebSocket | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!apiKey) return;

    // Get all US stock symbols (not .KS/.KQ)
    const allStocks = [...(stocks.investing || []), ...(stocks.watching || []), ...(stocks.sold || [])];
    const usSymbols = allStocks
      .map(s => s.symbol)
      .filter(s => !s.endsWith('.KS') && !s.endsWith('.KQ'));

    if (usSymbols.length === 0) return;

    // Check if market is open (US market: Mon-Fri, ~14:30-21:00 UTC)
    // Simplified: just try to connect, server won't send data outside hours

    const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Subscribe to all US symbols (max 50)
      const toSubscribe = usSymbols.slice(0, 50);
      toSubscribe.forEach(symbol => {
        if (!subscribedRef.current.has(symbol)) {
          ws.send(JSON.stringify({ type: 'subscribe', symbol }));
          subscribedRef.current.add(symbol);
        }
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'trade' && msg.data?.length) {
          // Group by symbol, take latest trade
          const latest: Record<string, { p: number; v: number; t: number }> = {};
          for (const trade of msg.data) {
            if (!latest[trade.s] || trade.t > latest[trade.s].t) {
              latest[trade.s] = { p: trade.p, v: trade.v, t: trade.t };
            }
          }

          // Update store with latest prices
          for (const [symbol, trade] of Object.entries(latest)) {
            const existing = usePortfolioStore.getState().macroData[symbol] as any;
            if (existing) {
              // Update current price, keep previous close for change calculation
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

    ws.onerror = () => {
      // Silent — will fall back to polling
    };

    ws.onclose = () => {
      subscribedRef.current.clear();
    };

    return () => {
      // Unsubscribe all
      if (ws.readyState === WebSocket.OPEN) {
        subscribedRef.current.forEach(symbol => {
          ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
        });
      }
      ws.close();
      subscribedRef.current.clear();
    };
  }, [apiKey, stocks.investing?.length, stocks.watching?.length]);
}
