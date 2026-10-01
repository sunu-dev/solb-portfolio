import { unstable_cache } from 'next/cache';
import { unzipSync } from 'fflate';
import snapshot from '../../public/stock-catalog.json';
import { MASTER_BASE, MASTER_FILES, parseStockMaster } from './stockMasterParser';

// Data cache survives server restarts. Each market refreshes independently once per day.
// Throw on failure so an outage cannot replace the last successful cache with an empty catalog.
const loadMarket = unstable_cache(async (file: string, market: 'KS' | 'KQ' | 'US', minimum: number) => {
  const response = await fetch(`${MASTER_BASE}${file}.zip`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`master ${file}: ${response.status}`);
  const archive = new Uint8Array(await response.arrayBuffer());
  if (archive.length > 10_000_000) throw new Error('master archive too large');
  const files = unzipSync(archive, { filter: entry => entry.name.toLowerCase() === file && entry.originalSize < 20_000_000 });
  const content = Object.entries(files).find(([name]) => name.toLowerCase() === file)?.[1];
  if (!content) throw new Error(`master ${file}: missing entry`);
  const stocks = parseStockMaster(content, market).map(stock => ({ ...stock, sourceFile: file }));
  const baseline = (snapshot.counts as Record<string, number>)[file] || minimum;
  if (stocks.length < Math.max(minimum, baseline * 0.8)) throw new Error(`master ${file}: incomplete data`);
  return { stocks, updatedAt: new Date().toISOString() };
}, ['stock-master-v1'], { revalidate: 86400 });

export async function getStockCatalog() {
  const batches = await Promise.all(MASTER_FILES.map(async ({ file, market, minimum }) => {
    try { return { ...(await loadMarket(file, market, minimum)), fallback: false, file }; }
    catch {
      // Never label fallback data as freshly downloaded.
      return { stocks: snapshot.stocks.filter(stock => stock.sourceFile === file),
        updatedAt: snapshot.updatedAt, fallback: true, file };
    }
  }));
  return {
    stocks: [...new Map(batches.flatMap(batch => batch.stocks).map(stock => [stock.symbol, stock])).values()],
    sources: batches.map(({ file, updatedAt, fallback }) => ({ file, updatedAt, fallback })),
  };
}
