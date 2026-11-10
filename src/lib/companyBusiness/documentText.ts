export const BUSINESS_DOCUMENT_LIMIT = 32_000_000;

/** Filing tables often contain section titles or page layout, not financial data.
 * Preserve those cells as separate text blocks; section selection and factual review remain mandatory.
 * Iteration avoids materializing a second array of every tag in large annual reports.
 */
export function businessDocumentText(html: string): string[] {
  if (Buffer.byteLength(html, 'utf8') > BUSINESS_DOCUMENT_LIMIT) throw new Error('business_source_size');
  const cleaned = html.replace(/<!--[^]*?-->/g, '').replace(/<(script|style|head|ix:hidden)\b[^>]*>[^]*?<\/\1\s*>/gi, '');
  const result: string[] = [], hidden: string[] = [];
  let text = '';
  const flush = () => {
    const value = decode(text).replace(/\s+/g, ' ').trim(); text = '';
    if (value.length && value.length <= 3000) result.push(value);
  };
  for (const match of cleaned.matchAll(/<[^>]*>|[^<]+/g)) {
    const token = match[0];
    if (token.startsWith('<')) {
      const close = token.match(/^<\/([a-zA-Z0-9:-]+)/)?.[1]?.toLowerCase();
      const open = token.match(/^<([a-zA-Z0-9:-]+)/)?.[1]?.toLowerCase();
      if (hidden.length) { if (close === hidden.at(-1)) hidden.pop(); else if (open === hidden.at(-1) && !token.endsWith('/>')) hidden.push(open!); continue; }
      if (open && /(?:\shidden(?:\s|=|>)|aria-hidden\s*=\s*["']true["']|display\s*:\s*none|visibility\s*:\s*hidden)/i.test(token)) {
        if (!token.endsWith('/>') && !['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(open)) hidden.push(open);
        continue;
      }
      if (/^<\/?(?:p|div|h[1-6]|br|li|tr|td|th|title)\b/i.test(token)) flush();
    } else if (!hidden.length) text += token;
    if (result.length >= 12000) break;
  }
  flush();
  return result;
}
function decode(value: string): string {
  const named: Record<string,string> = { amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (original, key: string) => {
    if (!key.startsWith('#')) return named[key] ?? original;
    const n = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2),16) : Number(key.slice(1));
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : ' ';
  });
}
