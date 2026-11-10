import { NextRequest, NextResponse } from 'next/server';
import { companyNewsIdentity } from '@/lib/companyNewsIdentity';
import { getStoredIndustry } from '@/lib/storedIndustry';
import { logServerApi } from '@/lib/serverLogger';

import { loadFeed, type NewsItem } from '@/lib/serverNewsFeed';
function recentItems(items: NewsItem[], maxHours: number): NewsItem[] {
  for (const hours of [Math.min(3,maxHours), Math.min(6,maxHours), maxHours]) {
    const recent = items.filter(item => Date.parse(item.pubDate) > Date.now() - hours * 3600000).slice(0,15);
    if (recent.length >= 3 || hours === maxHours) return recent;
  }
  return [];
}
export async function GET(req: NextRequest) {
  let query = req.nextUrl.searchParams.get('q')?.trim();
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase();
  if (symbol && !/^[A-Z0-9^.=-]{1,32}$/.test(symbol)) return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  const stored = symbol ? getStoredIndustry(symbol) : undefined;
  const identity = stored ? companyNewsIdentity(stored.symbol, stored.name, query) : undefined;
  if (identity) query = identity.queries[0];
  const topic = req.nextUrl.searchParams.get('topic')?.trim();
  const isEn = req.nextUrl.searchParams.get('locale') === 'en';
  const maxHours = Number(req.nextUrl.searchParams.get('maxHours') || '24');
  if ((!query && !topic) || !Number.isFinite(maxHours) || maxHours <= 0 || maxHours > 720) {
    return NextResponse.json({ error: '뉴스 검색 조건을 확인해주세요.' }, { status:400 });
  }
  const locale = isEn ? 'hl=en&gl=US&ceid=US:en' : 'hl=ko&gl=KR&ceid=KR:ko';
  // Search within the promised window upstream as well as filtering dates below.
  // An unbounded relevance-ranked feed can contain only old stories even when
  // this issuer has recent coverage; filtering that feed alone creates false empties.
  const boundedQuery = (value: string) => identity
    ? `${value} when:${Math.ceil(maxHours >= 24 ? maxHours / 24 : maxHours)}${maxHours >= 24 ? 'd' : 'h'}` : value;
  const path = topic ? `headlines/section/topic/${encodeURIComponent(topic)}` : `search?q=${encodeURIComponent(boundedQuery(query!))}`;
  const primaryUrl = `https://news.google.com/rss/${path}${topic?'?':'&'}${locale}`;
  const attempts: { locale: string; status: 'ok' | 'empty' | 'unavailable'; count: number }[] = [];
  try {
    let items: NewsItem[] | undefined;
    try { items = await loadFeed(primaryUrl,5000); } catch { /* A second bounded search follows below. */ }
    const select = (feed: NewsItem[]) => {
      const matching = identity ? feed.filter(item => identity.matches(item.title)) : feed;
      // Company pages promise the whole seven-day window, not only the last three hours.
      return identity ? matching.filter(item => Date.parse(item.pubDate) > Date.now() - maxHours * 3600000).slice(0,15)
        : topic ? matching.slice(0,15) : recentItems(matching,maxHours);
    };
    let recent = items ? select(items) : [];
    attempts.push({ locale: isEn ? 'en-US' : 'ko-KR', status: items ? recent.length ? 'ok' : 'empty' : 'unavailable', count: recent.length });
    if (!isEn && !topic && (!items || recent.length === 0)) {
      try {
        const fallback = identity?.queries[1] || query!;
        // US companies may have no Korean-language coverage. Search their
        // native-language feed instead of repeating only Korean headlines.
        const english = !!symbol && !/(?:\.KS|\.KQ)$/.test(symbol) && !/^[0-9][A-Z0-9]{5}$/.test(symbol);
        const locale = english ? 'hl=en&gl=US&ceid=US:en' : 'hl=ko&gl=US&ceid=US:ko';
        const feed = await loadFeed(`https://news.google.com/rss/search?q=${encodeURIComponent(boundedQuery(fallback))}&${locale}`,3500);
        recent = select(feed); items = feed;
        attempts.push({ locale: english ? 'en-US' : 'ko-US', status: recent.length ? 'ok' : 'empty', count: recent.length });
      }
      catch { attempts.push({ locale: 'fallback', status: 'unavailable', count: 0 }); }
    }
    // An empty primary response followed by an outage is an incomplete search,
    // not evidence that the company had no news. Never cache that as empty.
    if (!items || !recent.length && attempts.some(attempt => attempt.status === 'unavailable')) throw Error('News provider unavailable');
    logServerApi('api_news', { query:query || topic, result_count:recent.length });
    return NextResponse.json({ items:recent, _meta:{count:recent.length,source:topic?'topic':'search', status: recent.length ? 'ok' : 'empty', maxHours, checkedAt: new Date().toISOString(), attempts} },{
      headers:{'Cache-Control':recent.length?'public, s-maxage=300, stale-while-revalidate=300':'no-store','x-news-count':String(recent.length)},
    });
  } catch {
    return NextResponse.json({items:[],error:'뉴스를 불러오지 못했어요. 잠시 후 다시 시도해주세요.', _meta: { status: 'unavailable', maxHours, checkedAt: new Date().toISOString(), attempts }},{status:502,headers:{'Cache-Control':'no-store'}});
  }
}
