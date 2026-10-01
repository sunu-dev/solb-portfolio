import { STOCK_KR } from '@/config/constants';

export const EXTRA_ALIASES: Record<string, string[]> = {
  '036540.KQ': ['에스에프에이반도체', 'SFA Semicon'],
  GOOGL: ['알파벳', '알파벳A', '알파벳 클래스 A', '구글', 'Alphabet', 'Google'],
  GOOG: ['알파벳', '알파벳C', '알파벳 클래스 C', '구글', 'Alphabet', 'Google'],
  BE: ['블룸에너지', '블룸 에너지', '블룸', 'Bloom Energy'],
};

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[！-～]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s._\-·()]+/g, '');
}

function matchScore(query: string, symbol: string, names: string[]): number | null {
  const normalizedSymbol = normalizeSearchText(symbol);
  const normalizedNames = names.map(normalizeSearchText);
  if (normalizedSymbol === query) return 0;
  if (normalizedNames.some(name => name === query)) return 1;
  if (normalizedSymbol.startsWith(query)) return 2;
  if (normalizedNames.some(name => name.startsWith(query))) return 3;
  if (normalizedSymbol.includes(query) || normalizedNames.some(name => name.includes(query))) return 4;
  return null;
}

/** 한국 사용자가 회사명·통용명·티커 어느 쪽으로 입력해도 알려진 종목을 우선 찾는다. */
export function searchKnownStocks(input: string): { symbol: string; description: string }[] {
  const query = normalizeSearchText(input.trim());
  if (!query) return [];

  return Object.entries(STOCK_KR)
    .map(([symbol, description], order) => ({
      symbol,
      description,
      order,
      score: matchScore(query, symbol, [description, ...(EXTRA_ALIASES[symbol] || [])]),
    }))
    .filter((item): item is typeof item & { score: number } => item.score !== null)
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map(({ symbol, description }) => ({ symbol, description }));
}
