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

export async function fetchKoreanNews(query: string): Promise<NewsItem[] | null> {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko&tbs=qdr:d`;

  // Attempt 1: rss2json
  try {
    const r = await fetch(`${CONFIG.RSS2JSON_BASE}?rss_url=${encodeURIComponent(rssUrl)}`);
    const d = await r.json();
    if (d.status === 'ok' && d.items?.length) {
      const items = d.items.map((i: Record<string, string>) => ({
        title: i.title || '',
        link: i.link || '#',
        pubDate: i.pubDate || '',
        source: i.author || extractSource(i.title || ''),
        description: ((i.description || i.content || '') as string).replace(/<[^>]*>/g, '').substring(0, 150).trim(),
      }));
      return sortAndFilterNews(items);
    }
  } catch { /* fall through */ }

  // Attempt 2: Direct fetch + DOMParser
  try {
    const r = await fetch(rssUrl);
    const text = await r.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const xmlItems = xml.querySelectorAll('item');
    if (xmlItems.length) {
      const items = [...xmlItems].map(item => ({
        title: item.querySelector('title')?.textContent || '',
        link: item.querySelector('link')?.textContent || '#',
        pubDate: item.querySelector('pubDate')?.textContent || '',
        source: (item.querySelector('source')?.textContent) || extractSource(item.querySelector('title')?.textContent || ''),
        description: '',
      }));
      return sortAndFilterNews(items);
    }
  } catch { /* fall through */ }

  // Attempt 3: allorigins CORS proxy
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
    const r = await fetch(proxyUrl);
    const text = await r.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const xmlItems = xml.querySelectorAll('item');
    if (xmlItems.length) {
      const items = [...xmlItems].map(item => ({
        title: item.querySelector('title')?.textContent || '',
        link: item.querySelector('link')?.textContent || '#',
        pubDate: item.querySelector('pubDate')?.textContent || '',
        source: (item.querySelector('source')?.textContent) || extractSource(item.querySelector('title')?.textContent || ''),
        description: '',
      }));
      return sortAndFilterNews(items);
    }
  } catch (e) {
    console.error('News fetch failed:', e);
  }

  return null;
}

// --- Search stocks ---
export async function searchStocks(query: string, apiKey: string): Promise<{ symbol: string; description: string }[]> {
  try {
    const r = await fetch(`${CONFIG.FINNHUB_BASE}/search?q=${encodeURIComponent(query)}&token=${apiKey}`);
    const d = await r.json();
    if (d.result?.length) {
      return d.result.slice(0, 5).map((item: { symbol: string; description: string }) => ({
        symbol: item.symbol,
        description: item.description,
      }));
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
    stocks, setAlerts,
  } = usePortfolioStore();

  const fetchAllQuotes = useCallback(async () => {
    if (!apiKey) return;
    const syms = getAllSymbols();

    // Stale-While-Revalidate: show cached prices instantly
    const QUOTE_CACHE_KEY = 'solb_quote_cache';
    try {
      const cached = localStorage.getItem(QUOTE_CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        // Use cache if less than 2 minutes old
        if (Date.now() - ts < 2 * 60 * 1000) {
          for (const [sym, quote] of Object.entries(data)) {
            if (quote && (quote as QuoteData).c) updateMacroEntry(sym, quote as QuoteData);
          }
        }
      }
    } catch { /* ignore */ }

    // Fetch fresh quotes in parallel
    const freshData: Record<string, QuoteData> = {};
    await Promise.all(
      syms.map(s =>
        fetchStockQuote(s, apiKey).then(d => {
          if (d && d.c) {
            updateMacroEntry(s, d);
            freshData[s] = d;
          }
        })
      )
    );

    // Save to cache
    try {
      localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify({ data: freshData, ts: Date.now() }));
    } catch { /* storage full */ }

    setLastUpdate(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
  }, [apiKey, getAllSymbols, updateMacroEntry, setLastUpdate]);

  const fetchAllCandles = useCallback(async () => {
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
    if (!apiKey) return;
    const ps = MACRO_IND.filter(i => i.type === 'stock' && i.symbol).map(ind =>
      fetchStockQuote(ind.symbol!, apiKey).then(d => {
        if (d?.c) updateMacroEntry(ind.label, { value: d.c, change: d.d || 0, changePercent: d.dp || 0 });
      })
    );
    await Promise.all(ps);
    // Try Yahoo Finance for more recent USD/KRW rate with change data
    try {
      const r = await fetch('/api/kr-quote?symbol=USDKRW=X');
      const d = await r.json();
      if (d?.c) {
        updateMacroEntry('USD/KRW', { value: d.c, change: d.d || 0, changePercent: d.dp || 0 });
      }
    } catch {
      // Fall back to er-api (existing)
      try {
        const r = await fetch(`${CONFIG.ER_API_BASE}/latest/USD`);
        const d = await r.json();
        if (d.rates?.KRW) updateMacroEntry('USD/KRW', { value: d.rates.KRW, change: 0, changePercent: 0 });
      } catch { /* silent */ }
    }
    // KOSPI placeholder if not fetched
    const macroData = usePortfolioStore.getState().macroData;
    if (!macroData['KOSPI']) updateMacroEntry('KOSPI', { value: null, change: 0, changePercent: 0 });
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
    const q = market === 'my'
      ? getAllSymbols().map(s => STOCK_KR[s] || s).join(' ') + ' 주가'
      : NEWS_QUERIES[market];
    if (!q) return null;
    const items = await fetchKoreanNews(q);
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

    // 뉴스: 30분마다
    newsTimerRef.current = setInterval(() => {
      fetchNews(currentNewsMarket || 'us');
      fetchNews('my');
    }, 30 * 60 * 1000);

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
  }, [autoRefresh, refreshInterval, refreshAll, fetchMacro]);
}
