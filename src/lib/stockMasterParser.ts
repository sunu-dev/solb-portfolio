/** KIS public master formats: stocks_info/{kis_kospi_code_mst,overseas_stock_code}.py */
export interface CatalogStock {
  symbol: string;
  description: string;
  englishName?: string;
  sourceFile?: string;
}

export const MASTER_FILES = [
  { file: 'kospi_code.mst', market: 'KS', minimum: 1000 },
  { file: 'kosdaq_code.mst', market: 'KQ', minimum: 1000 },
  { file: 'nasmst.cod', market: 'US', minimum: 1000 },
  { file: 'nysmst.cod', market: 'US', minimum: 1000 },
  { file: 'amsmst.cod', market: 'US', minimum: 100 },
] as const;

export const MASTER_BASE = 'https://new.real.download.dws.co.kr/common/master/';

export function parseStockMaster(bytes: Uint8Array, market: 'KS' | 'KQ' | 'US'): CatalogStock[] {
  const decoder = new TextDecoder('euc-kr', { fatal: true });
  const stocks: CatalogStock[] = [];
  if (market === 'US') {
    for (const line of decoder.decode(bytes).split(/\r?\n/)) {
      const fields = line.split('\t').map(field => field.trim());
      const [symbol, description, englishName] = [fields[4], fields[6], fields[7]];
      // Only USD stocks/ETPs, never warrants or indices. Dot class tickers use Yahoo's dash.
      if (!['2', '3'].includes(fields[8]) || fields[9] !== 'USD') continue;
      if (!symbol || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol) || !description) continue;
      stocks.push({ symbol: symbol.replaceAll('.', '-'), description, englishName });
    }
  } else {
    let start = 0;
    for (let end = 0; end <= bytes.length; end++) {
      if (end < bytes.length && bytes[end] !== 10) continue;
      const line = bytes.subarray(start, end);
      start = end + 1;
      if (line.length < 63) continue;
      const symbol = decoder.decode(line.subarray(0, 9)).trim();
      const description = decoder.decode(line.subarray(21, 61)).trim();
      const group = decoder.decode(line.subarray(61, 63));
      // Common/preferred stock, foreign stock, REIT, ETF and ETN; exclude ELW/rights.
      if (!['ST', 'FS', 'RT', 'EF', 'EN'].includes(group)) continue;
      if (!/^[0-9A-Z]{6}$/.test(symbol) || !description) continue;
      stocks.push({ symbol: `${symbol}.${market}`, description });
    }
  }
  return stocks;
}
