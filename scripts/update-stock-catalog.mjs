// Refresh the checked-in outage fallback. Runtime refresh uses the same parser.
import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { unzipSync } from 'fflate';

const source = await readFile(new URL('../src/lib/stockMasterParser.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { MASTER_FILES, MASTER_BASE, parseStockMaster } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const counts = {};
const batches = await Promise.all(MASTER_FILES.map(async ({ file, market, minimum }) => {
  const response = await fetch(`${MASTER_BASE}${file}.zip`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const content = Object.entries(files).find(([name]) => name.toLowerCase() === file)?.[1];
  if (!content) throw new Error(`${file}: missing ZIP entry`);
  const stocks = parseStockMaster(content, market).map(stock => ({ ...stock, sourceFile: file }));
  if (stocks.length < minimum) throw new Error(`${file}: incomplete catalog (${stocks.length})`);
  counts[file] = stocks.length;
  return stocks;
}));
const stocks = [...new Map(batches.flat().map(stock => [stock.symbol, stock])).values()];
const output = { updatedAt: new Date().toISOString(), source: 'Korea Investment & Securities public masters', counts, stocks };
await writeFile(new URL('../public/stock-catalog.json', import.meta.url), JSON.stringify(output));
console.log(JSON.stringify({ updatedAt: output.updatedAt, counts, total: stocks.length }));
