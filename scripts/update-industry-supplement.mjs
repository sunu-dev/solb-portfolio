/** Resolve gaps using exact-symbol public profiles; preserve failures and delisting notices. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const report = JSON.parse(await readFile(join(root, 'artifacts/industry-coverage-20261011/coverage.json'), 'utf8'));
const candidates = report.rows.filter(r => r.market === 'US' && ['not-covered', 'missing-industry'].includes(r.status));
const records = [], failures = [];
const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]*>/g, '').trim();
let cursor = 0;
async function worker() {
  while (cursor < candidates.length) {
    const row = candidates[cursor++];
    const url = `https://stockanalysis.com/stocks/${row.symbol.toLowerCase()}/company/`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const html = await response.text();
      const ticker = html.match(/info:\{type:"stocks",subtype:"stock",symbol:"[^"]+",ticker:"([^"]+)"/)?.[1];
      if (ticker !== row.symbol) throw Error('Exact common-stock symbol not confirmed');
      const industry = html.match(/href="\/stocks\/industry\/[^"/]+\/">([^<]+)<\/a>/)?.[1];
      const name = html.match(/profile:\{name:"((?:[^"\\]|\\.)*)"/)?.[1];
      if (!industry || !name) throw Error('No profile industry');
      const listingNote = html.match(/<span>([^<]*\bwas delisted\b[^<]*)<\/span>/)?.[1];
      records.push({ symbol: row.symbol, name: JSON.parse('"' + name + '"'), industry: decode(industry), url,
        checkedAt: new Date().toISOString(), ...(listingNote ? { listingNote: decode(listingNote) } : {}) });
    } catch (error) { failures.push({ symbol: row.symbol, url, reason: error.message }); }
  }
}
await Promise.all([worker(), worker(), worker()]);
records.sort((a, b) => a.symbol.localeCompare(b.symbol));
await writeFile(join(root, 'sources/industries/profile-supplement.json'), JSON.stringify({ records, failures }, null, 2) + '\n');
console.log(JSON.stringify({ attempted: candidates.length, resolved: records.length, delisted: records.filter(r => r.listingNote).length, failures }));
