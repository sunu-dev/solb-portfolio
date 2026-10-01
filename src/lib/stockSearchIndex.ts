import { STOCK_KR } from '@/config/constants';
import { EXTRA_ALIASES, normalizeSearchText } from '@/config/stockSearchAliases';
import type { CatalogStock } from './stockMasterParser';

const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function initials(text: string) {
  return [...text].map(char => {
    const offset = char.charCodeAt(0) - 0xac00;
    return offset >= 0 && offset <= 11171 ? CHOSEONG[Math.floor(offset / 588)] : char;
  }).join('');
}

interface IndexedStock {
  item: CatalogStock;
  symbol: string;
  code: string;
  names: string[];
  initials: string[];
}

/** Normalize once per catalog, not once per keystroke. Official names remain searchable alongside aliases. */
export function createStockSearchIndex(stocks: CatalogStock[]) {
  const merged = new Map(stocks.map(stock => [stock.symbol, stock]));
  if (!stocks.length) for (const [symbol, description] of Object.entries(STOCK_KR)) {
    merged.set(symbol, { symbol, description });
  }
  return [...merged.values()].map((item): IndexedStock => {
    const names = [...new Set([
      item.description, item.englishName || '', STOCK_KR[item.symbol] || '',
      ...(EXTRA_ALIASES[item.symbol] || []),
    ].map(normalizeSearchText).filter(Boolean))];
    return { item, symbol: normalizeSearchText(item.symbol),
      code: normalizeSearchText(item.symbol.replace(/\.K[SQ]$/, '')),
      names, initials: names.map(initials) };
  });
}

export function searchStockIndex(index: ReturnType<typeof createStockSearchIndex>, input: string, limit = 20): CatalogStock[] {
  const query = normalizeSearchText(input);
  if (!query) return [];
  const useInitials = /^[ㄱ-ㅎ]{2,}$/.test(query);
  const matches: { item: CatalogStock; score: number }[] = [];
  for (const entry of index) {
    let score: number;
    if (entry.symbol === query || entry.code === query) score = 0;
    else if (entry.names.includes(query)) score = 1;
    else if (entry.names.some(name => name.startsWith(query))) score = 2;
    else if (entry.symbol.startsWith(query)) score = 3;
    else if (entry.names.some(name => name.includes(query))) score = 4;
    else if (useInitials && entry.initials.some(name => name.startsWith(query))) score = 5;
    else continue;
    matches.push({ item: entry.item, score });
  }
  return matches.sort((a, b) => a.score - b.score || a.item.description.length - b.item.description.length || a.item.symbol.localeCompare(b.item.symbol))
    .slice(0, limit).map(match => match.item);
}
