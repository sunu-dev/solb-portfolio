export interface NewsItem { title: string; link: string; pubDate: string; source: string; description: string }
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';

function xmlText(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[\da-f]+|\d+);/gi, entity => {
      const named: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
      const normalized = entity.toLowerCase();
      if (named[normalized]) return named[normalized];
      const point = normalized.startsWith('&#x') ? parseInt(normalized.slice(3), 16) : parseInt(normalized.slice(2), 10);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : '';
    }).trim();
}

export function parseFeed(xml: string): NewsItem[] {
  if (!/<rss[\s>]/i.test(xml) || !/<channel[\s>]/i.test(xml) || !/<\/channel\s*>/i.test(xml) || !/<\/rss\s*>/i.test(xml)) throw Error('Invalid news feed');
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)].flatMap(([, item]) => {
    const tag = (name: string) => xmlText(item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, 'i'))?.[1] || '');
    const rawTitle = tag('title');
    const link = tag('link') || item.match(/<link\s*\/>\s*(https?:\/\/[^\s<]+)/)?.[1] || '';
    const pubDate = tag('pubDate'); const date = Date.parse(pubDate);
    if (!rawTitle || !/^https?:\/\//i.test(link) || !Number.isFinite(date) || date > Date.now() + 300000) return [];
    return [{ title: rawTitle.replace(/ - [^-]+$/, '').trim(), link, pubDate,
      source: tag('source') || rawTitle.match(/ - ([^-]+)$/)?.[1].trim() || '',
      description: tag('description').replace(/<[^>]*>/g, '').slice(0, 150).trim() }];
  }).sort((a,b) => Date.parse(b.pubDate) - Date.parse(a.pubDate));
}
export async function loadFeed(url: string, timeout: number) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(timeout), cache: 'no-store' });
  if (!response.ok) throw Error('News provider unavailable');
  return parseFeed(await response.text());
}
