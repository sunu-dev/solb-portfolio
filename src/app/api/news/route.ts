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
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SOLBBot/1.0)' },
      signal: AbortSignal.timeout(8000),
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

    // Sort by date (newest first) then filter recent 24 hours (fallback: 48h)
    const sorted = items.sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    });

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
    const fresh = sorted
      .filter(item => item.pubDate && new Date(item.pubDate).getTime() > oneDayAgo)
      .slice(0, 15);
    // Fallback: 24h 뉴스 3건 미만이면 48h까지 확장 (그 이상은 절대 미표시)
    const recent = fresh.length >= 3
      ? fresh
      : sorted.filter(item => item.pubDate && new Date(item.pubDate).getTime() > twoDaysAgo).slice(0, 15);

    return NextResponse.json(
      { items: recent },
      {
        headers: {
          'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (e) {
    console.error('News fetch error:', e);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
