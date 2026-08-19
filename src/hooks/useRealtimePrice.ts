'use client';

import { useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { QuoteData } from '@/config/constants';
import { isKoreanStockSymbol } from '@/utils/stockCurrency';

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 3000; // 3초

export function useRealtimePrice() {
  const { stocks, updateMacroEntry } = usePortfolioStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const allSymbolsKey = [...(stocks.investing || []), ...(stocks.watching || []), ...(stocks.sold || [])]
    .map(s => s.symbol)
    .filter(s => !isKoreanStockSymbol(s))
    .sort()
    .join(',');

  useEffect(() => {
    const allStocks = [...(stocks.investing || []), ...(stocks.watching || []), ...(stocks.sold || [])];
    const usSymbols = allStocks
      .map(s => s.symbol)
      .filter(s => !isKoreanStockSymbol(s));

    if (usSymbols.length === 0) return;

    let isCleanedUp = false;

    /**
     * 실시간 토큰은 **여기서만, 필요할 때만** 받는다.
     * 예전에는 앱 부팅 시 전 방문자가 /api/ws-token을 호출해 Finnhub 키를 스토어(localStorage)에
     * 영속시켰다. 지금은 미국 종목을 보유한 로그인 사용자가 WebSocket을 열 때만 요청하고,
     * 받은 토큰은 이 훅의 클로저 안에서만 쓰고 저장하지 않는다.
     */
    async function fetchRealtimeToken(): Promise<string | null> {
      try {
        const { supabase } = await import('@/lib/supabase');
        const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
        if (!accessToken) return null;  // 비로그인 — 실시간 미제공(폴링 시세로 동작)
        const r = await fetch('/api/ws-token', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!r.ok) return null;
        const { token } = await r.json();
        return token || null;
      } catch {
        return null;
      }
    }

    function connect(apiKey: string) {
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
              const existing = usePortfolioStore.getState().macroData[symbol] as QuoteData | undefined;
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
          // 재연결에도 같은 토큰을 재사용한다(세션당 1회 발급).
          reconnectTimer.current = setTimeout(() => connect(apiKey), delay);
        }
      };
    }

    fetchRealtimeToken().then(token => {
      if (token && !isCleanedUp) connect(token);
    });

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
  }, [allSymbolsKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
