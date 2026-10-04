import { STOCK_KR, type NewsItem, type StockItem } from '@/config/constants';

export type NewsFetchResult =
  | { status: 'ok'; items: NewsItem[] }
  | { status: 'empty'; items: NewsItem[] }
  | { status: 'error'; items: NewsItem[]; reason: 'network' | 'server' | 'timeout' };

export type NewsQuery = { q?: string; topic?: string; locale?: string; maxHours?: number };
export type NewsResponse = { result: NewsFetchResult; fetchedAt: number };
export type NewsTarget = { symbol: string; name: string; query: string };
export type RelatedNewsItem = NewsItem & { relatedNames: string[] };
export const NEWS_STALE_MS = 30 * 60 * 1000;
export const NEWS_BATCH_SIZE = 3;

/** A company may be held in several accounts, but only needs one news request. */
export function getNewsTargets(stocks: Pick<StockItem, 'symbol' | 'name'>[]): NewsTarget[] {
  const unique = new Map<string, NewsTarget>();
  for (const stock of stocks) {
    const symbol = stock.symbol.trim().toUpperCase();
    if (!symbol || unique.has(symbol)) continue;
    const name = STOCK_KR[symbol] || stock.name?.trim() || symbol;
    unique.set(symbol, { symbol, name, query: `${name} 주가` });
  }
  return [...unique.values()];
}

export function newsQueryKey(query: NewsQuery): string {
  return JSON.stringify([query.q || '', query.topic || '', query.locale || 'ko', query.maxHours || 0]);
}

/** Shared by the news screen and background refresh. Errors are never cached. */
export function createNewsClient(request: typeof fetch = fetch, now: () => number = Date.now) {
  const cache = new Map<string, NewsResponse>();
  const pending = new Map<string, Promise<NewsResponse>>();
  const peek = (query: NewsQuery) => cache.get(newsQueryKey(query));
  const load = (query: NewsQuery, force = false): Promise<NewsResponse> => {
    const key = newsQueryKey(query);
    const ongoing = pending.get(key);
    if (ongoing) return ongoing;
    const cached = cache.get(key);
    if (!force && cached && now() - cached.fetchedAt < NEWS_STALE_MS) return Promise.resolve(cached);
    const task = (async (): Promise<NewsResponse> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9500);
      let result: NewsFetchResult;
      try {
        const params = new URLSearchParams();
        if (query.q) params.set('q', query.q);
        if (query.topic) params.set('topic', query.topic);
        params.set('locale', query.locale || 'ko');
        if (query.maxHours) params.set('maxHours', String(query.maxHours));
        const response = await request(`/api/news?${params}`, { signal: controller.signal });
        if (!response.ok) result = { status: 'error', items: [], reason: 'server' };
        else {
          const data = await response.json();
          const items = Array.isArray(data.items) ? data.items.filter(isNewsItem) : [];
          result = items.length ? { status: 'ok', items } : { status: 'empty', items: [] };
        }
      } catch {
        result = { status: 'error', items: [], reason: controller.signal.aborted ? 'timeout' : 'network' };
      } finally {
        clearTimeout(timer);
      }
      const response = { result, fetchedAt: now() };
      if (result.status !== 'error') {
        cache.delete(key);
        cache.set(key, response);
        if (cache.size > 60) cache.delete(cache.keys().next().value!);
      }
      return response;
    })().finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  };
  return { load, peek };
}

function isNewsItem(item: unknown): item is NewsItem {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as Partial<NewsItem>;
  return typeof candidate.title === 'string' && Boolean(candidate.title.trim())
    && typeof candidate.link === 'string' && /^https?:\/\//i.test(candidate.link);
}

// Request-time fetch lookup also supports tests, while the cache lives for this browser session.
export const newsClient = createNewsClient((...args) => fetch(...args));

export function mergeRelatedNews(results: { target: NewsTarget; response: NewsResponse }[]): RelatedNewsItem[] {
  const articles = new Map<string, RelatedNewsItem>();
  for (const { target, response } of results) {
    for (const item of response.result.items.slice(0, 6)) {
      const key = item.link || item.title;
      const existing = articles.get(key);
      if (existing) {
        if (!existing.relatedNames.includes(target.name)) existing.relatedNames.push(target.name);
      } else articles.set(key, { ...item, relatedNames: [target.name] });
    }
  }
  const timestamp = (date: string) => new Date(date).getTime() || 0;
  return [...articles.values()].sort((a, b) => timestamp(b.pubDate) - timestamp(a.pubDate)).slice(0, 20);
}

export function decodeNewsTitle(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#(?:39|x27);/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
