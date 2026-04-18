import { NextRequest, NextResponse } from 'next/server';
import { logServerApi } from '@/lib/serverLogger';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description: string;
}

function extractSource(title: string): string {
  const match = title.match(/ - ([^-]+)$/);
  return match ? match[1].trim() : '';
}

function cleanTitle(title: string): string {
  // Remove " - Source" suffix from Google News titles
  return title.replace(/ - [^-]+$/, '').trim();
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  const topic = req.nextUrl.searchParams.get('topic'); // e.g. 'BUSINESS'
  const locale = req.nextUrl.searchParams.get('locale') || 'ko'; // 'ko' | 'en'
  const maxHours = parseInt(req.nextUrl.searchParams.get('maxHours') || '24', 10);
  if (!query && !topic) {
    return NextResponse.json({ error: 'q or topic parameter required' }, { status: 400 });
  }

  const isEn = locale === 'en';
  const hl = isEn ? 'en' : 'ko';
  const gl = isEn ? 'US' : 'KR';
  const ceid = isEn ? 'US:en' : 'KR:ko';
  const rssUrl = topic
    ? `https://news.google.com/rss/headlines/section/topic/${encodeURIComponent(topic)}?hl=${hl}&gl=${gl}&ceid=${ceid}`
    : `https://news.google.com/rss/search?q=${encodeURIComponent(query!)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

  try {
    const r = await fetch(rssUrl, {
      // 실제 브라우저 UA — SOLBBot 등 Bot 문자열은 Google이 차단 or 제한
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(8000),
      // Next.js App Router는 fetch를 무기한 캐싱함 → 강제 최신화
      cache: 'no-store',
    });
    const text = await r.text();

    // Parse XML on server (no CORS issue)
    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const itemXml = match[1];
      const getTag = (tag: string) => {
        const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      };

      // Google News RSS sometimes uses self-closing <link/> followed by URL as plain text
      const getLink = () => {
        const tagged = getTag('link');
        if (tagged) return tagged;
        const fallback = itemXml.match(/<link\s*\/>\s*(https?:\/\/[^\s<]+)/);
        return fallback ? fallback[1].trim() : '';
      };

      const rawTitle = getTag('title');
      const source = getTag('source') || extractSource(rawTitle);

      items.push({
        title: cleanTitle(rawTitle),
        link: getLink(),
        pubDate: getTag('pubDate'),
        source,
        description: getTag('description').replace(/<[^>]*>/g, '').substring(0, 150).trim(),
      });
    }

    // Sort by date (newest first)
    const sorted = items.sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    });

    const pickRecent = (sorted: NewsItem[]): NewsItem[] => {
      const now = Date.now();
      const h3  = now - 3 * 60 * 60 * 1000;
      const h6  = now - 6 * 60 * 60 * 1000;
      const hMax = now - maxHours * 60 * 60 * 1000;
      const f3  = sorted.filter(i => i.pubDate && new Date(i.pubDate).getTime() > h3).slice(0, 15);
      const f6  = sorted.filter(i => i.pubDate && new Date(i.pubDate).getTime() > h6).slice(0, 15);
      const fMax = sorted.filter(i => i.pubDate && new Date(i.pubDate).getTime() > hMax).slice(0, 15);
      return f3.length >= 3 ? f3 : f6.length >= 3 ? f6 : fMax;
    };

    let recent: NewsItem[];
    if (topic) {
      recent = sorted.slice(0, 15);
    } else {
      recent = pickRecent(sorted);

      // KR 리전이 0건이면 gl=US 로 재시도 (Google News KR 간헐적 차단 대응)
      if (recent.length === 0 && !isEn) {
        const fallbackUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query!)}&hl=ko&gl=US&ceid=US:ko`;
        try {
          const r2 = await fetch(fallbackUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(6000),
            cache: 'no-store',
          });
          const text2 = await r2.text();
          const items2: NewsItem[] = [];
          let m2;
          const re2 = /<item>([\s\S]*?)<\/item>/g;
          while ((m2 = re2.exec(text2)) !== null) {
            const xml = m2[1];
            const getTag = (tag: string) => { const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''; };
            const rawTitle = getTag('title');
            items2.push({ title: cleanTitle(rawTitle), link: getTag('link'), pubDate: getTag('pubDate'), source: getTag('source') || extractSource(rawTitle), description: getTag('description').replace(/<[^>]*>/g, '').substring(0, 150).trim() });
          }
          const sorted2 = items2.sort((a, b) => (b.pubDate ? new Date(b.pubDate).getTime() : 0) - (a.pubDate ? new Date(a.pubDate).getTime() : 0));
          recent = pickRecent(sorted2);
        } catch { /* 재시도 실패 시 빈 결과 유지 */ }
      }
    }

    logServerApi('api_news', { query: query || topic, result_count: recent.length });

    return NextResponse.json(
      { items: recent },
      {
        headers: {
          'Cache-Control': 's-maxage=180, stale-while-revalidate=300',
        },
      }
    );
  } catch (e) {
    console.error('News fetch error:', e);
    // 에러 시 CDN 캐시 금지 (빈 결과가 캐싱되면 계속 빈 뉴스 표시됨)
    return NextResponse.json({ items: [] }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
