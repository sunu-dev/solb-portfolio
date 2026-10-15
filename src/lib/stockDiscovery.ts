import type { NewsItem } from "@/config/constants";

export const DISCOVERY_PREFIX = "joobi_discovery_v1:";
export interface DiscoverySnapshot {
  viewedAt: number;
  price?: number;
  quoteAt?: number;
  currency?: string;
  news: string[];
}
export interface DiscoveryHistory {
  version: 1;
  lessons: Record<string, number>;
  questions: Record<string, number>;
  resume?: string;
  stocks: Record<string, DiscoverySnapshot>;
}
export const emptyDiscovery = (): DiscoveryHistory => ({
  version: 1,
  lessons: {},
  questions: {},
  stocks: {},
});
const safeTime = (v: unknown, now: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= now + 60000;
export function parseDiscovery(
  raw: string | null,
  now = Date.now(),
): DiscoveryHistory {
  const result = emptyDiscovery();
  try {
    if (!raw || raw.length > 150000) return result;
    const value = JSON.parse(raw);
    if (value?.version !== 1) return result;
    for (const kind of ["lessons", "questions"] as const) {
      if (value[kind] && typeof value[kind] === "object")
        for (const [key, time] of Object.entries(value[kind]).slice(-100))
          if (/^[a-z-]{1,40}$/.test(key) && safeTime(time, now))
            result[kind][key] = time;
    }
    if (typeof value.resume === "string" && /^[a-z-]{1,40}$/.test(value.resume))
      result.resume = value.resume;
    if (value.stocks && typeof value.stocks === "object")
      for (const [symbol, row] of Object.entries(value.stocks).slice(-40)) {
        if (
          !/^[A-Z0-9.^=-]{1,32}$/.test(symbol) ||
          !row ||
          typeof row !== "object"
        )
          continue;
        const s = row as Record<string, unknown>;
        if (!safeTime(s.viewedAt, now) || !Array.isArray(s.news)) continue;
        result.stocks[symbol] = {
          viewedAt: s.viewedAt,
          news: s.news
            .filter(
              (x: unknown): x is string =>
                typeof x === "string" && /^[a-z0-9]{1,16}$/.test(x),
            )
            .slice(0, 30),
        };
        if (
          typeof s.price === "number" &&
          Number.isFinite(s.price) &&
          s.price > 0 &&
          safeTime(s.quoteAt, now) &&
          ["USD", "KRW"].includes(String(s.currency))
        )
          Object.assign(result.stocks[symbol], {
            price: s.price,
            quoteAt: s.quoteAt,
            currency: s.currency,
          });
      }
  } catch {
    /* Corrupt or blocked storage starts a fresh browser history. */
  }
  return result;
}
export function newsKey(item: NewsItem): string {
  // Store only a bounded fingerprint, never a headline or an article URL.
  const input = item.title.trim().replace(/\s+/g, " ").toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
export function recentDiscoveryNews(
  items: readonly NewsItem[],
  now = Date.now(),
): NewsItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const time = Date.parse(item.pubDate);
      const key = newsKey(item);
      if (
        !Number.isFinite(time) ||
        time > now + 60000 ||
        time < now - 7 * 86400000 ||
        !item.title?.trim() ||
        !/^https?:\/\//i.test(item.link) ||
        seen.has(key)
      )
        return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate))
    .slice(0, 12);
}
export function publicQuestionNews(
  items: readonly NewsItem[],
  now = Date.now(),
): string {
  return recentDiscoveryNews(items, now)
    .slice(0, 6)
    .map(
      (n) =>
        `[${n.pubDate} · ${(n.source || "출처 미표기").slice(0, 100)}] ${n.title.slice(0, 400)}`,
    )
    .join("\n");
}
export function evidenceRevision(
  items: readonly NewsItem[],
  quoteAt?: number,
  price?: number,
  per?: number | null,
  eps?: number | null,
): string {
  return `${quoteAt ?? ""}:${price ?? ""}:${per ?? ""}:${eps ?? ""}:${recentDiscoveryNews(items).map(newsKey).sort().join(".")}`;
}
export function compareDiscovery(
  previous: DiscoverySnapshot | undefined,
  current: DiscoverySnapshot,
  items: readonly NewsItem[],
) {
  const news = recentDiscoveryNews(items, current.viewedAt);
  // An article absent from an earlier short feed is not automatically a new event.
  const newItems = previous
    ? news.filter(
        (n) =>
          Date.parse(n.pubDate) > previous.viewedAt &&
          !previous.news.includes(newsKey(n)),
      )
    : news;
  const comparable =
    !!previous?.price &&
    !!current.price &&
    previous.currency === current.currency &&
    !!current.quoteAt &&
    !!previous.quoteAt &&
    current.quoteAt > previous.quoteAt;
  const priceChange = comparable
    ? (current.price! / previous!.price! - 1) * 100
    : null;
  return { news, newItems, priceChange };
}
export function updateDiscovery(
  owner: string,
  mutate: (history: DiscoveryHistory) => void,
): boolean {
  if (typeof window === "undefined" || !owner) return false;
  try {
    const key = DISCOVERY_PREFIX + owner;
    const history = parseDiscovery(localStorage.getItem(key));
    mutate(history);
    history.stocks = Object.fromEntries(
      Object.entries(history.stocks)
        .sort((a, b) => b[1].viewedAt - a[1].viewedAt)
        .slice(0, 40),
    );
    localStorage.setItem(key, JSON.stringify(history));
    window.dispatchEvent(new Event("joobi-discovery-updated"));
    return true;
  } catch {
    return false;
  }
}
