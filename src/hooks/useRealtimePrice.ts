'use client';

import { useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 3000; // 3초

export function useRealtimePrice() {
  const { apiKey, stocks, updateMacroEntry } = usePortfolioStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

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

    let isCleanedUp = false;

    function connect() {
      if (isCleanedUp) return;

      const subscribed = new Set<string>();
      const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts.current = 0; // 연결 성공 → 카운터 초기화
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

      ws.onerror = () => { /* onclose에서 재연결 처리 */ };

      ws.onclose = () => {
        if (isCleanedUp) return;
        // 지수 백오프 재연결
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current);
          reconnectAttempts.current++;
          reconnectTimer.current = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      isCleanedUp = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, [apiKey, allSymbolsKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
