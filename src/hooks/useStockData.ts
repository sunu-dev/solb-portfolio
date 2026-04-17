// ==========================================
// HOOKS -- Custom hooks wrapping api.js logic
// ==========================================

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePortfolioStore, delay } from '@/store/portfolioStore';
import type { QuoteData, CandleRaw, NewsItem } from '@/config/constants';
import { CONFIG, PERIODS, MACRO_IND, NEWS_QUERIES, STOCK_KR } from '@/config/constants';
import { checkAllAlerts } from '@/utils/alertsEngine';

// --- Fetch a single stock quote ---
async function fetchStockQuote(symbol: string, apiKey: string): Promise<QuoteData | null> {
  try {
    const r = await fetch(`${CONFIG.FINNHUB_BASE}/quote?symbol=${symbol}&token=${apiKey}`);
    return await r.json();
  } catch (e) {
    console.error('fetchStockQuote error:', e);
    return null;
  }
}

// --- Fetch candle data (Finnhub → Yahoo Finance fallback) ---
async function fetchCandleDataRaw(symbol: string, apiKey: string): Promise<CandleRaw | null> {
  // Attempt 1: Finnhub (US large caps)
  if (!symbol.endsWith('.KS') && !symbol.endsWith('.KQ')) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = now - 400 * 86400;
      const r = await fetch(`${CONFIG.FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${now}&token=${apiKey}`);
      const d: CandleRaw = await r.json();
      if (d.s === 'ok' && d.c?.length > 20) return d;
    } catch { /* fall through */ }
  }

  // Attempt 2: Yahoo Finance via API Route (works for all stocks)
  try {
    const r = await fetch(`/api/candle?symbol=${symbol}`);
    const d: CandleRaw = await r.json();
    if (d.s === 'ok' && d.c?.length > 20) return d;
  } catch (e) {
    console.error('fetchCandleDataRaw error:', e);
  }

  return null;
}

// --- Fetch Korean news ---
function extractSource(title: string): string {
  const match = title.match(/ - ([^-]+)$/);
  return match ? match[1].trim() : '';
}

function sortAndFilterNews(items: NewsItem[]): NewsItem[] {
  const sorted = items.sort((a, b) => {
    const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return dateB - dateA;
  });

  // Try 24 hours first
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = sorted.filter(item => !item.pubDate || new Date(item.pubDate).getTime() > oneDayAgo);
  if (recent.length >= 3) return recent.slice(0, 15);

  // Fallback to 72 hours if not enough (weekend/night)
  const threeDaysAgo = Date.now() - 72 * 60 * 60 * 1000;
  const fallback = sorted.filter(item => !item.pubDate || new Date(item.pubDate).getTime() > threeDaysAgo);
  return fallback.slice(0, 15);
}

export async function fetchKoreanNews(query: string, locale?: string, maxHours?: number): Promise<NewsItem[] | null> {
  return fetchNewsAPI({ q: query, locale, maxHours });
}

async function fetchNewsAPI({ q, topic, locale, maxHours }: { q?: string; topic?: string; locale?: string; maxHours?: number }): Promise<NewsItem[] | null> {
  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (topic) params.set('topic', topic);
    if (locale) params.set('locale', locale);
    if (maxHours) params.set('maxHours', String(maxHours));
    const r = await fetch(`/api/news?${params}`);
    const d = await r.json();
    if (d.items?.length) return d.items;
  } catch (e) {
    console.error('News fetch failed:', e);
  }
  return null;
}

// --- Search stocks (server-side API route) ---
export async function searchStocks(query: string, _apiKey?: string): Promise<{ symbol: string; description: string }[]> {
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const d = await r.json();
    if (d.result?.length) {
      return d.result;
    }
  } catch (e) {
    console.error('searchStocks error:', e);
  }
  return [];
}

// --- Fetch event data ---
export async function fetchEventCandle(
  symbol: string,
  fromTs: number,
  toTs: number,
  apiKey: string
): Promise<CandleRaw | null> {
  try {
    const r = await fetch(`${CONFIG.FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=D&from=${fromTs}&to=${toTs}&token=${apiKey}`);
    const d: CandleRaw = await r.json();
    if (d.s === 'ok' && d.c?.length > 1) return d;
    return null;
  } catch (e) {
    console.error('fetchEventCandle error:', e);
    return null;
  }
}

// --- Main hook: useStockData ---
export function useStockData() {
  const {
    apiKey, getAllSymbols, updateMacroEntry,
    updateCandleCache, updateRawCandles, setLastUpdate,
    stocks, setAlerts, setNetworkError,
  } = usePortfolioStore();

  const fetchAllQuotes = useCallback(async () => {
    // getState()로 항상 최신 apiKey 읽기 — stale closure 방지
    const apiKey = usePortfolioStore.getState().apiKey;
    if (!apiKey) return;
    const syms = getAllSymbols();

    // Stale-While-Revalidate: show cached prices instantly (even if stale)
    const QUOTE_CACHE_KEY = 'solb_quote_cache';
    try {
      const cached = localStorage.getItem(QUOTE_CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        // Always restore from cache if less than 30 minutes old
        if (Date.now() - ts < 5 * 60 * 1000) {
          for (const [sym, quote] of Object.entries(data)) {
            if (quote && (quote as QuoteData).c) updateMacroEntry(sym, quote as QuoteData);
          }
        }
      }
    } catch { /* ignore */ }

    // Also restore macro cache
    try {
      const macroCached = localStorage.getItem('solb_macro_cache');
      if (macroCached) {
        const { data, ts } = JSON.parse(macroCached);
        if (Date.now() - ts < 5 * 60 * 1000) {
          for (const [key, val] of Object.entries(data)) {
            if (val) updateMacroEntry(key, val as QuoteData);
          }
        }
      }
    } catch { /* ignore */ }

    // Fetch fresh quotes via server batch API (1 request instead of N)
    const freshData: Record<string, QuoteData> = {};

    // Include macro symbols in batch
    const macroSymbols = MACRO_IND.filter(i => i.type === 'stock' && i.symbol).map(i => i.symbol!);
    const allSyms = [...new Set([...syms, ...macroSymbols])];

    let batchOk = false;
    try {
      const r = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: allSyms, macro: true }),
      });
      if (!r.ok) throw new Error(`batch API ${r.status}`);
      const json = await r.json();
      const quotes = json?.quotes;
      const usdKrw = json?.usdKrw;

      // Check we actually got data
      if (quotes && Object.keys(quotes).some(k => quotes[k]?.c)) {
        batchOk = true;
        for (const [sym, d] of Object.entries(quotes)) {
          if (d && (d as QuoteData).c) {
            const macroInd = MACRO_IND.find(i => i.symbol === sym);
            if (macroInd) {
              const q = d as QuoteData;
              updateMacroEntry(macroInd.label, { value: q.c, change: q.d || 0, changePercent: q.dp || 0 });
            }
            if (syms.includes(sym)) {
              updateMacroEntry(sym, d as QuoteData);
              freshData[sym] = d as QuoteData;
            }
          }
        }
      }

      if (usdKrw?.c) {
        updateMacroEntry('USD/KRW', { value: usdKrw.c, change: usdKrw.d || 0, changePercent: usdKrw.dp || 0 });
      }
    } catch { /* batch failed, will fallback below */ }

    // Fallback: individual requests if batch returned no data
    if (!batchOk) {
      await Promise.all(
        allSyms.map(s =>
          fetchStockQuote(s, apiKey).then(d => {
            if (d && d.c) {
              const macroInd = MACRO_IND.find(i => i.symbol === s);
              if (macroInd) {
                updateMacroEntry(macroInd.label, { value: d.c, change: d.d || 0, changePercent: d.dp || 0 });
              }
              if (syms.includes(s)) {
                updateMacroEntry(s, d);
                freshData[s] = d;
              }
            }
          })
        )
      );
      // USD/KRW fallback
      try {
        const r = await fetch('/api/kr-quote?symbol=USDKRW=X');
        const d = await r.json();
        if (d?.c) updateMacroEntry('USD/KRW', { value: d.c, change: d.d || 0, changePercent: d.dp || 0 });
      } catch { /* silent */ }
    }

    // Save to cache
    try {
      localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify({ data: freshData, ts: Date.now() }));
    } catch { /* storage full */ }

    // Also save macro cache for instant restore
    try {
      const freshMacro = usePortfolioStore.getState().macroData;
      const macroCache: Record<string, unknown> = {};
      for (const key of ['S&P 500', 'NASDAQ', 'WTI', 'VIX', 'USD/KRW']) {
        if (freshMacro[key]) macroCache[key] = freshMacro[key];
      }
      localStorage.setItem('solb_macro_cache', JSON.stringify({ data: macroCache, ts: Date.now() }));
    } catch { /* storage full */ }

    // 데이터 수신 여부 확인 후 에러 상태 설정
    const received = Object.values(usePortfolioStore.getState().macroData).some(v => (v as QuoteData)?.c);
    if (!received) {
      setNetworkError('시세 데이터를 불러오지 못했어요. 잠시 후 새로고침 해주세요.');
    } else {
      setNetworkError(null);
    }

    setLastUpdate(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
  }, [apiKey, getAllSymbols, updateMacroEntry, setLastUpdate, setNetworkError]);

  const fetchAllCandles = useCallback(async () => {
    const apiKey = usePortfolioStore.getState().apiKey;
    if (!apiKey) return;
    const syms = getAllSymbols();

    // Process candles in parallel batches of 3 (respect rate limits)
    const processCandle = async (s: string) => {
      // Check localStorage cache first (candles change daily only)
      const cacheKey = `candle_${s}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, date } = JSON.parse(cached);
          const today = new Date().toDateString();
          if (date === today && data?.c?.length > 20) {
            updateRawCandles(s, data);
            const closes = data.c;
            const cp = closes[closes.length - 1];
            const result: Record<number, number> = {};
            PERIODS.forEach(p => {
              const back = Math.min(Math.round(p.days * 5 / 7), closes.length - 1);
              const idx = Math.max(closes.length - 1 - back, 0);
              const sliced = closes.slice(idx); const maxVal = sliced.reduce((a: number, b: number) => a > b ? a : b, sliced[0] || 1); result[p.days] = maxVal > 0 ? ((cp - maxVal) / maxVal) * 100 : 0;
            });
            updateCandleCache(s, result);
            return; // Cache hit, skip API call
          }
        } catch { /* invalid cache, fetch fresh */ }
      }

      const raw = await fetchCandleDataRaw(s, apiKey);
      if (raw) {
        // Save to localStorage cache
        try { localStorage.setItem(cacheKey, JSON.stringify({ data: raw, date: new Date().toDateString() })); } catch { /* storage full */ }
        updateRawCandles(s, raw);
        const closes = raw.c;
        const cp = closes[closes.length - 1];
        const result: Record<number, number> = {};
        PERIODS.forEach(p => {
          const back = Math.min(Math.round(p.days * 5 / 7), closes.length - 1);
          const idx = Math.max(closes.length - 1 - back, 0);
          const sliced = closes.slice(idx); const maxVal = sliced.reduce((a: number, b: number) => a > b ? a : b, sliced[0] || 1); result[p.days] = maxVal > 0 ? ((cp - maxVal) / maxVal) * 100 : 0;
        });
        updateCandleCache(s, result);
      }
    };

    // Batch parallel: 3 at a time
    for (let i = 0; i < syms.length; i += 3) {
      const batch = syms.slice(i, i + 3);
      await Promise.all(batch.map(processCandle));
      if (i + 3 < syms.length) await delay(100);
    }
  }, [apiKey, getAllSymbols, updateRawCandles, updateCandleCache]);

  const refreshAll = useCallback(async () => {
    // 1. Quotes first (fast, shows prices immediately)
    await fetchAllQuotes();

    // 2. Run alerts with whatever candle data we have
    const state1 = usePortfolioStore.getState();
    const alerts1 = checkAllAlerts(state1.stocks, state1.macroData, state1.rawCandles, state1.candleCache);
    setAlerts(alerts1);

    // 3. Candles in background (slow, but prices already visible)
    fetchAllCandles().then(() => {
      // Re-run alerts with full candle data
      const state2 = usePortfolioStore.getState();
      const alerts2 = checkAllAlerts(state2.stocks, state2.macroData, state2.rawCandles, state2.candleCache);
      setAlerts(alerts2);
    });
  }, [fetchAllQuotes, fetchAllCandles, setAlerts]);

  return { fetchAllQuotes, fetchAllCandles, refreshAll };
}

// --- useMacroData ---
export function useMacroData() {
  const { apiKey, updateMacroEntry } = usePortfolioStore();

  const fetchMacro = useCallback(async () => {
    const apiKey = usePortfolioStore.getState().apiKey;
    if (!apiKey) return;

    // Use batch API (server-side, fast) instead of individual client calls
    const macroSymbols = MACRO_IND.filter(i => i.type === 'stock' && i.symbol).map(i => i.symbol!);
    let ok = false;

    try {
      const r = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: macroSymbols, macro: true }),
      });
      if (r.ok) {
        const json = await r.json();
        if (json.quotes) {
          for (const ind of MACRO_IND.filter(i => i.type === 'stock' && i.symbol)) {
            const d = json.quotes[ind.symbol!];
            if (d?.c) {
              updateMacroEntry(ind.label, { value: d.c, change: d.d || 0, changePercent: d.dp || 0 });
              ok = true;
            }
          }
        }
        if (json.usdKrw?.c) {
          updateMacroEntry('USD/KRW', { value: json.usdKrw.c, change: json.usdKrw.d || 0, changePercent: json.usdKrw.dp || 0 });
        }
      }
    } catch { /* batch failed */ }

    // Fallback: individual calls if batch returned nothing
    if (!ok) {
      await Promise.all(
        MACRO_IND.filter(i => i.type === 'stock' && i.symbol).map(ind =>
          fetchStockQuote(ind.symbol!, apiKey).then(d => {
            if (d?.c) updateMacroEntry(ind.label, { value: d.c, change: d.d || 0, changePercent: d.dp || 0 });
          })
        )
      );
      try {
        const r = await fetch('/api/kr-quote?symbol=USDKRW=X');
        const d = await r.json();
        if (d?.c) updateMacroEntry('USD/KRW', { value: d.c, change: d.d || 0, changePercent: d.dp || 0 });
      } catch { /* silent */ }
    }

    // KOSPI placeholder
    const macroData = usePortfolioStore.getState().macroData;
    if (!macroData['KOSPI']) updateMacroEntry('KOSPI', { value: null, change: 0, changePercent: 0 });

    // Save macro cache
    try {
      const freshMacro = usePortfolioStore.getState().macroData;
      const macroCache: Record<string, unknown> = {};
      for (const key of ['S&P 500', 'NASDAQ', 'WTI', 'VIX', 'USD/KRW']) {
        if (freshMacro[key]) macroCache[key] = freshMacro[key];
      }
      localStorage.setItem('solb_macro_cache', JSON.stringify({ data: macroCache, ts: Date.now() }));
    } catch { /* storage full */ }
  }, [apiKey, updateMacroEntry]);

  return { fetchMacro };
}

// --- useCandleData ---
export function useCandleData(symbol: string | null) {
  const { apiKey, rawCandles, updateRawCandles, updateCandleCache } = usePortfolioStore();

  const fetchCandle = useCallback(async () => {
    if (!symbol || !apiKey) return;
    if (rawCandles[symbol]) return; // already cached
    const raw = await fetchCandleDataRaw(symbol, apiKey);
    if (raw) {
      updateRawCandles(symbol, raw);
      const closes = raw.c;
      const cp = closes[closes.length - 1];
      const result: Record<number, number> = {};
      PERIODS.forEach(p => {
        const back = Math.min(Math.round(p.days * 5 / 7), closes.length - 1);
        const idx = Math.max(closes.length - 1 - back, 0);
        const sliced = closes.slice(idx); const maxVal = sliced.reduce((a: number, b: number) => a > b ? a : b, sliced[0] || 1); result[p.days] = maxVal > 0 ? ((cp - maxVal) / maxVal) * 100 : 0;
      });
      updateCandleCache(symbol, result);
    }
  }, [symbol, apiKey, rawCandles, updateRawCandles, updateCandleCache]);

  return { fetchCandle, rawCandle: symbol ? rawCandles[symbol] : null };
}

// --- useNewsData ---
export function useNewsData() {
  const { updateNewsCache, getAllSymbols } = usePortfolioStore();

  const fetchNews = useCallback(async (market: string) => {
    let items: NewsItem[] | null;
    if (market === 'my') {
      // 한글명 있는 종목만, 최대 4개 → 쿼리 너무 길면 Google News 결과 없음
      const krNames = getAllSymbols().map(s => STOCK_KR[s]).filter(Boolean).slice(0, 4);
      const q = krNames.length > 0
        ? krNames.join(' ') + ' 주가'
        : '미국 증시 나스닥';
      items = await fetchKoreanNews(q, 'ko', 24);
    } else {
      const entry = NEWS_QUERIES[market];
      if (!entry) return null;
      items = await fetchNewsAPI({ q: entry.q, topic: entry.topic, locale: entry.locale, maxHours: entry.maxHours });
    }
    if (items?.length) {
      updateNewsCache(market, items);
    }
    return items;
  }, [getAllSymbols, updateNewsCache]);

  return { fetchNews };
}

// --- useAutoRefresh ---
export function useAutoRefresh() {
  const { autoRefresh, refreshInterval, currentNewsMarket, updateMacroEntry } = usePortfolioStore();
  const { refreshAll } = useStockData();
  const { fetchMacro } = useMacroData();
  const { fetchNews } = useNewsData();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const newsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fxTimerRef = useRef<NodeJS.Timeout | null>(null);
  const newsMarketRef = useRef(currentNewsMarket);

  // Keep the ref in sync without triggering interval recreation
  useEffect(() => {
    newsMarketRef.current = currentNewsMarket;
  }, [currentNewsMarket]);

  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (newsTimerRef.current) clearInterval(newsTimerRef.current);
      if (fxTimerRef.current) clearInterval(fxTimerRef.current);
      return;
    }
    // 주가: 10초마다
    timerRef.current = setInterval(() => {
      refreshAll();
      fetchMacro();
    }, refreshInterval);

    // 뉴스: 15분마다
    newsTimerRef.current = setInterval(() => {
      fetchNews(newsMarketRef.current || 'us');
      fetchNews('my');
    }, 15 * 60 * 1000);

    // 환율: 10분마다
    fxTimerRef.current = setInterval(async () => {
      try {
        const r = await fetch('/api/kr-quote?symbol=USDKRW=X');
        const d = await r.json();
        if (d?.c) {
          updateMacroEntry('USD/KRW', { value: d.c, change: d.d || 0, changePercent: d.dp || 0 });
        }
      } catch { /* silent */ }
    }, 10 * 60 * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (newsTimerRef.current) clearInterval(newsTimerRef.current);
      if (fxTimerRef.current) clearInterval(fxTimerRef.current);
    };
  }, [autoRefresh, refreshInterval, refreshAll, fetchMacro, fetchNews, updateMacroEntry]);
}
