// ==========================================
// HOOKS -- Custom hooks wrapping api.js logic
// ==========================================

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePortfolioStore, delay } from '@/store/portfolioStore';
import type { QuoteData, CandleRaw, NewsItem } from '@/config/constants';
import { CONFIG, PERIODS, MACRO_IND, NEWS_QUERIES, STOCK_KR } from '@/config/constants';

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

// --- Fetch candle data ---
async function fetchCandleDataRaw(symbol: string, apiKey: string): Promise<CandleRaw | null> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 400 * 86400;
  try {
    const r = await fetch(`${CONFIG.FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${now}&token=${apiKey}`);
    const d: CandleRaw = await r.json();
    if (d.s === 'ok' && d.c?.length) return d;
    return null;
  } catch (e) {
    console.error('fetchCandleDataRaw error:', e);
    return null;
  }
}

// --- Fetch Korean news ---
function extractSource(title: string): string {
  const match = title.match(/ - ([^-]+)$/);
  return match ? match[1].trim() : '';
}

export async function fetchKoreanNews(query: string): Promise<NewsItem[] | null> {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;

  // Attempt 1: rss2json
  try {
    const r = await fetch(`${CONFIG.RSS2JSON_BASE}?rss_url=${encodeURIComponent(rssUrl)}`);
    const d = await r.json();
    if (d.status === 'ok' && d.items?.length) {
      return d.items.map((i: Record<string, string>) => ({
        title: i.title || '',
        link: i.link || '#',
        pubDate: i.pubDate || '',
        source: i.author || extractSource(i.title || ''),
        description: ((i.description || i.content || '') as string).replace(/<[^>]*>/g, '').substring(0, 150).trim(),
      }));
    }
  } catch { /* fall through */ }

  // Attempt 2: Direct fetch + DOMParser
  try {
    const r = await fetch(rssUrl);
    const text = await r.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const items = xml.querySelectorAll('item');
    if (items.length) {
      return [...items].slice(0, 15).map(item => ({
        title: item.querySelector('title')?.textContent || '',
        link: item.querySelector('link')?.textContent || '#',
        pubDate: item.querySelector('pubDate')?.textContent || '',
        source: (item.querySelector('source')?.textContent) || extractSource(item.querySelector('title')?.textContent || ''),
        description: '',
      }));
    }
  } catch { /* fall through */ }

  // Attempt 3: allorigins CORS proxy
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
    const r = await fetch(proxyUrl);
    const text = await r.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const items = xml.querySelectorAll('item');
    if (items.length) {
      return [...items].slice(0, 15).map(item => ({
        title: item.querySelector('title')?.textContent || '',
        link: item.querySelector('link')?.textContent || '#',
        pubDate: item.querySelector('pubDate')?.textContent || '',
        source: (item.querySelector('source')?.textContent) || extractSource(item.querySelector('title')?.textContent || ''),
        description: '',
      }));
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
  } = usePortfolioStore();

  const fetchAllQuotes = useCallback(async () => {
    if (!apiKey) return;
    const syms = getAllSymbols();
    await Promise.all(
      syms.map(s =>
        fetchStockQuote(s, apiKey).then(d => {
          if (d && d.c) updateMacroEntry(s, d);
        })
      )
    );
    setLastUpdate(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
  }, [apiKey, getAllSymbols, updateMacroEntry, setLastUpdate]);

  const fetchAllCandles = useCallback(async () => {
    if (!apiKey) return;
    const syms = getAllSymbols();
    for (const s of syms) {
      const raw = await fetchCandleDataRaw(s, apiKey);
      if (raw) {
        updateRawCandles(s, raw);
        const closes = raw.c;
        const cp = closes[closes.length - 1];
        const result: Record<number, number> = {};
        PERIODS.forEach(p => {
          const back = Math.min(Math.round(p.days * 5 / 7), closes.length - 1);
          const idx = Math.max(closes.length - 1 - back, 0);
          result[p.days] = ((cp - Math.max(...closes.slice(idx))) / Math.max(...closes.slice(idx))) * 100;
        });
        updateCandleCache(s, result);
      }
      await delay(150);
    }
  }, [apiKey, getAllSymbols, updateRawCandles, updateCandleCache]);

  const refreshAll = useCallback(async () => {
    await fetchAllQuotes();
    await fetchAllCandles();
  }, [fetchAllQuotes, fetchAllCandles]);

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
    try {
      const r = await fetch(`${CONFIG.ER_API_BASE}/latest/USD`);
      const d = await r.json();
      if (d.rates?.KRW) updateMacroEntry('USD/KRW', { value: d.rates.KRW, change: 0, changePercent: 0 });
    } catch { /* silent */ }
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
        result[p.days] = ((cp - Math.max(...closes.slice(idx))) / Math.max(...closes.slice(idx))) * 100;
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
  const { autoRefresh, refreshInterval } = usePortfolioStore();
  const { refreshAll } = useStockData();
  const { fetchMacro } = useMacroData();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      refreshAll();
      fetchMacro();
    }, refreshInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, refreshInterval, refreshAll, fetchMacro]);
}
