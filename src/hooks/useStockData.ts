// ==========================================
// HOOKS -- Custom hooks wrapping api.js logic
// ==========================================

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePortfolioStore, delay } from '@/store/portfolioStore';
import type { QuoteData, CandleRaw, NewsItem } from '@/config/constants';
import { CONFIG, PERIODS, MACRO_IND, NEWS_QUERIES, STOCK_KR } from '@/config/constants';
import { checkAllAlerts } from '@/utils/alertsEngine';
import { isKoreanStockSymbol } from '@/utils/stockCurrency';


// --- Fetch candle data (서버 라우트 경유) ---
// 과거에는 Finnhub `/stock/candle`을 브라우저에서 직접 호출해 클라이언트에 API 키가 필요했다.
// 해당 엔드포인트는 유료 티어 전용이라 무료 키로는 항상 실패했고, 실제로 값을 주는 것은
// 아래 `/api/candle`(서버에서 Yahoo 조회)뿐이었다. 키 노출 경로를 없애면서 함께 정리.
async function fetchCandleDataRaw(symbol: string): Promise<CandleRaw | null> {
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

// 뉴스 fetch 결과 — 빈 응답·네트워크 에러·서버 에러를 구분
export type NewsFetchResult =
  | { status: 'ok'; items: NewsItem[] }
  | { status: 'empty'; items: NewsItem[]; reason?: string }
  | { status: 'error'; items: NewsItem[]; reason: 'network' | 'server' | 'timeout' };

export async function fetchKoreanNews(query: string, locale?: string, maxHours?: number): Promise<NewsFetchResult> {
  return fetchNewsAPI({ q: query, locale, maxHours });
}

async function fetchNewsAPI({ q, topic, locale, maxHours }: { q?: string; topic?: string; locale?: string; maxHours?: number }): Promise<NewsFetchResult> {
  const ctrl = new AbortController();
  // 서버 측 최악 8.5s (5s + 3.5s fallback)에 여유 1s
  const timer = setTimeout(() => ctrl.abort('client-timeout'), 9500);
  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (topic) params.set('topic', topic);
    if (locale) params.set('locale', locale);
    if (maxHours) params.set('maxHours', String(maxHours));
    const r = await fetch(`/api/news?${params}`, { signal: ctrl.signal });
    if (!r.ok) {
      return { status: 'error', items: [], reason: 'server' };
    }
    const d = await r.json();
    const items: NewsItem[] = Array.isArray(d.items) ? d.items : [];
    if (items.length > 0) return { status: 'ok', items };
    return { status: 'empty', items: [] };
  } catch (e) {
    const err = e as Error;
    const isTimeout = err.name === 'AbortError' || /abort|timeout/i.test(err.message || '');
    console.error('News fetch failed:', err.name || err.message);
    return { status: 'error', items: [], reason: isTimeout ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

// --- Search stocks (server-side API route) ---
export interface StockSearchResult {
  symbol: string;
  description: string;
  isNewListing?: boolean;
  listedAt?: string | null;
  /** 서버 권위 단일종목 레버리지 플래그 (api/search) — 클라이언트는 로컬 재계산과 OR 합집합 */
  isLeverage?: boolean;
}
export async function searchStocks(query: string): Promise<StockSearchResult[]> {
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

// --- Main hook: useStockData ---
export function useStockData() {
  const {
    getAllSymbols, updateMacroEntry,
    updateCandleCache, updateRawCandles, setLastUpdate,
    stocks, setAlerts, setNetworkError,
  } = usePortfolioStore();

  const fetchAllQuotes = useCallback(async () => {
    // 시세는 전부 서버 라우트(/api/quotes·/api/kr-quote)를 거친다 — 클라이언트 API 키 불필요.
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
    let fxOk = false;
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
        fxOk = true;
      }
    } catch { /* batch failed, will fallback below */ }

    // 배치 실패 시의 개별 Finnhub 직접 호출 폴백은 제거했다.
    // /api/quotes가 서버에서 이미 Finnhub(미국)·Yahoo(한국·지수) 폴백을 수행하므로
    // 클라이언트가 키를 들고 같은 일을 반복할 이유가 없었다(키 노출 경로였다).
    void batchOk;

    // 주식 배치 성공 여부와 무관하게 환율이 빠졌으면 Yahoo 전용 경로로 보완한다.
    // 과거에는 미국/한국 주가만 성공해도 batchOk=true가 되어 환율 fallback이 영구 스킵됐다.
    if (!fxOk) {
      try {
        const r = await fetch('/api/kr-quote?symbol=USDKRW=X');
        const d = await r.json();
        if (d?.c) {
          updateMacroEntry('USD/KRW', { value: d.c, change: d.d || 0, changePercent: d.dp || 0 });
          fxOk = true;
        }
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
      for (const key of ['S&P 500', 'NASDAQ', '다우존스', '코스피', '코스닥', 'WTI', 'VIX', 'USD/KRW']) {
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
  }, [getAllSymbols, updateMacroEntry, setLastUpdate, setNetworkError]);

  const fetchAllCandles = useCallback(async () => {
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

      const raw = await fetchCandleDataRaw(s);
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
  }, [getAllSymbols, updateRawCandles, updateCandleCache]);

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
  const { updateMacroEntry } = usePortfolioStore();

  const fetchMacro = useCallback(async () => {
    // Use batch API (server-side, fast) instead of individual client calls
    const macroSymbols = MACRO_IND.filter(i => i.type === 'stock' && i.symbol).map(i => i.symbol!);
    let ok = false;
    let fxOk = false;

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
          fxOk = true;
        }
      }
    } catch { /* batch failed */ }

    // 개별 Finnhub 직접 호출 폴백 제거 — 위와 같은 이유(서버 라우트가 폴백을 담당).
    void ok;

    if (!fxOk) {
      try {
        const r = await fetch('/api/kr-quote?symbol=USDKRW=X');
        const d = await r.json();
        if (d?.c) {
          updateMacroEntry('USD/KRW', { value: d.c, change: d.d || 0, changePercent: d.dp || 0 });
          fxOk = true;
        }
      } catch { /* silent */ }
    }

    // KOSPI placeholder
    const macroData = usePortfolioStore.getState().macroData;
    if (!macroData['KOSPI']) updateMacroEntry('KOSPI', { value: null, change: 0, changePercent: 0 });

    // Save macro cache
    try {
      const freshMacro = usePortfolioStore.getState().macroData;
      const macroCache: Record<string, unknown> = {};
      for (const key of ['S&P 500', 'NASDAQ', '다우존스', '코스피', '코스닥', 'WTI', 'VIX', 'USD/KRW']) {
        if (freshMacro[key]) macroCache[key] = freshMacro[key];
      }
      localStorage.setItem('solb_macro_cache', JSON.stringify({ data: macroCache, ts: Date.now() }));
    } catch { /* storage full */ }
  }, [updateMacroEntry]);

  return { fetchMacro };
}

// --- useCandleData ---
export function useCandleData(symbol: string | null) {
  const { rawCandles, updateRawCandles, updateCandleCache } = usePortfolioStore();

  const fetchCandle = useCallback(async () => {
    if (!symbol) return;
    if (rawCandles[symbol]) return; // already cached
    const raw = await fetchCandleDataRaw(symbol);
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
  }, [symbol, rawCandles, updateRawCandles, updateCandleCache]);

  return { fetchCandle, rawCandle: symbol ? rawCandles[symbol] : null };
}

// --- useNewsData ---
export function useNewsData() {
  const { updateNewsCache, getAllSymbols } = usePortfolioStore();

  const fetchNews = useCallback(async (market: string): Promise<NewsFetchResult> => {
    let result: NewsFetchResult;
    if (market === 'my') {
      const allSymbols = getAllSymbols();
      const krNames = allSymbols.map(s => STOCK_KR[s]).filter(Boolean).slice(0, 3);
      const usSymbols = allSymbols.filter(s => !isKoreanStockSymbol(s)).slice(0, 3);
      let q: string;
      if (krNames.length > 0 && usSymbols.length > 0) {
        q = [...krNames, ...usSymbols].join(' ') + ' 주가';
      } else if (krNames.length > 0) {
        q = krNames.join(' ') + ' 주가';
      } else if (usSymbols.length > 0) {
        q = usSymbols.join(' ') + ' 주식';
      } else {
        q = '미국 증시 나스닥 코스피';
      }
      result = await fetchKoreanNews(q, 'ko', 24);
    } else {
      const entry = NEWS_QUERIES[market];
      if (!entry) return { status: 'empty', items: [] };
      result = await fetchNewsAPI({ q: entry.q, topic: entry.topic, locale: entry.locale, maxHours: entry.maxHours });
    }
    if (result.status === 'ok' && result.items.length) {
      updateNewsCache(market, result.items);
    }
    return result;
  }, [getAllSymbols, updateNewsCache]);

  return { fetchNews };
}

// --- useAutoRefresh ---
export function useAutoRefresh() {
  const { autoRefresh, refreshInterval, currentNewsMarket, currentSection, updateMacroEntry } = usePortfolioStore();
  const { refreshAll } = useStockData();
  const { fetchMacro } = useMacroData();
  const { fetchNews } = useNewsData();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const newsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fxTimerRef = useRef<NodeJS.Timeout | null>(null);
  const newsMarketRef = useRef(currentNewsMarket);
  const sectionRef = useRef(currentSection);

  // Keep refs in sync without triggering interval recreation
  useEffect(() => {
    newsMarketRef.current = currentNewsMarket;
  }, [currentNewsMarket]);

  useEffect(() => {
    sectionRef.current = currentSection;
  }, [currentSection]);

  // 페이지가 visible 상태로 복귀하면 뉴스 stale 체크 후 즉시 갱신
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (sectionRef.current !== 'news') return;
      const market = newsMarketRef.current || 'us';
      const lastFetch = usePortfolioStore.getState().newsCacheTimes?.[market] || 0;
      if (Date.now() - lastFetch > 10 * 60 * 1000) {
        fetchNews(market);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [fetchNews]);

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

    // 뉴스: 15분마다 — 단, (1) 사용자가 뉴스탭에 있을 때 (2) 페이지가 visible일 때만
    newsTimerRef.current = setInterval(() => {
      if (sectionRef.current !== 'news') return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchNews(newsMarketRef.current || 'us');
      // 'my'는 NewsSection 내부 5-way 로직이 별도 처리 — 여기서 중복 호출 제거
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
