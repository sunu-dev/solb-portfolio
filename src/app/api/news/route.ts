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
  if (!query) {
    return NextResponse.json({ error: 'q parameter required' }, { status: 400 });
  }

  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;

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

      const rawTitle = getTag('title');
      const source = getTag('source') || extractSource(rawTitle);

      items.push({
        title: cleanTitle(rawTitle),
        link: getTag('link'),
        pubDate: getTag('pubDate'),
        source,
        description: getTag('description').replace(/<[^>]*>/g, '').substring(0, 150).trim(),
      });
    }

    // Filter: recent 72 hours, max 15
    const threeDaysAgo = Date.now() - 72 * 60 * 60 * 1000;
    const recent = items
      .filter(item => !item.pubDate || new Date(item.pubDate).getTime() > threeDaysAgo)
      .slice(0, 15);

    return NextResponse.json(
      { items: recent.length >= 3 ? recent : items.slice(0, 15) },
      {
        headers: {
          'Cache-Control': 's-maxage=600, stale-while-revalidate=1200',
        },
      }
    );
  } catch (e) {
    console.error('News fetch error:', e);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
