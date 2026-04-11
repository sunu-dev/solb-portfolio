import { NextRequest, NextResponse } from 'next/server';

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
  const locale = req.nextUrl.searchParams.get('locale') || 'ko'; // 'ko' | 'en'
  const maxHours = parseInt(req.nextUrl.searchParams.get('maxHours') || '24', 10);
  if (!query) {
    return NextResponse.json({ error: 'q parameter required' }, { status: 400 });
  }

  const isEn = locale === 'en';
  const hl = isEn ? 'en' : 'ko';
  const gl = isEn ? 'US' : 'KR';
  const ceid = isEn ? 'US:en' : 'KR:ko';
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

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

    // Sort by date (newest first) then filter: 3h → 6h → 12h fallback
    const sorted = items.sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    });

    const now = Date.now();
    const threeHoursAgo = now - 3 * 60 * 60 * 1000;
    const sixHoursAgo   = now - 6 * 60 * 60 * 1000;
    const maxAgo        = now - maxHours * 60 * 60 * 1000;

    const fresh3h  = sorted.filter(item => item.pubDate && new Date(item.pubDate).getTime() > threeHoursAgo).slice(0, 15);
    const fresh6h  = sorted.filter(item => item.pubDate && new Date(item.pubDate).getTime() > sixHoursAgo).slice(0, 15);
    const freshMax = sorted.filter(item => item.pubDate && new Date(item.pubDate).getTime() > maxAgo).slice(0, 15);

    // 3h 내 3건 이상 → 3h 기준, 부족하면 6h → 최대(maxHours)h 순으로 확장
    const recent = fresh3h.length >= 3 ? fresh3h
      : fresh6h.length >= 3 ? fresh6h
      : freshMax;

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
