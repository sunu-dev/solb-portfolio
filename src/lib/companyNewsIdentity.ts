import { STOCK_KR } from '@/config/constants';

export const COMPANY_NEWS_ALIASES: Record<string, string[]> = {
  MU: ['마이크론', 'Micron', 'Micron Technology', '마이크론 테크놀로지'],
  '005930.KS': ['삼성전자', 'Samsung Electronics'],
  MSFT: ['마이크로소프트', 'Microsoft'],
  NVDA: ['엔비디아', 'Nvidia'],
  AAPL: ['애플', 'Apple'],
  GOOGL: ['알파벳', 'Alphabet', '구글', 'Google'],
  GOOG: ['알파벳', 'Alphabet', '구글', 'Google'],
  META: ['메타', 'Meta Platforms', 'Facebook'],
  AMZN: ['아마존', 'Amazon'],
  TSLA: ['테슬라', 'Tesla'],
};
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Search aliases never change the target company. A ticker alone is not an English word match. */
export function companyNewsIdentity(symbol: string, storedName?: string, requestedQuery?: string) {
  const requestedName = requestedQuery?.replace(/\s+주가$/, '').trim();
  const cleanName = (name: string) => name.replace(/,?\s+(?:Inc\.?|Corporation|Corp\.?|Ltd\.?|Co\.,? Ltd\.?)$/i, '').trim();
  const aliases = [...new Set([
    STOCK_KR[symbol], ...(COMPANY_NEWS_ALIASES[symbol] || []),
    storedName && storedName !== symbol ? cleanName(storedName) : undefined,
    // A saved search name is only used when no catalog name is available.
    !STOCK_KR[symbol] && (!storedName || storedName === symbol) ? requestedName : undefined,
  ].filter((value): value is string => !!value && value !== symbol && value.length >= 2))];
  const primary = aliases[0] || symbol;
  return {
    queries: [`${primary} 주가`, aliases.length > 1 ? `"${aliases[1]}"` : `"${primary}"`],
    matches(title: string) {
      return aliases.some(alias => /[가-힣]/.test(alias)
        // Korean names often have particles attached, but must not match inside
        // another issuer (마이크론 ≠ 하나마이크론, 삼성전자 ≠ 삼성전자서비스).
        ? new RegExp(`(?<![가-힣A-Za-z0-9])${alias.trim().split(/\s+/).map(escape).join('\\s*')}(?=$|[^가-힣A-Za-z0-9]|(?:은|는|이|가|을|를|의|에|와|과|도|만|에서|에게|으로|로|보다|까지|부터|처럼|마저|조차|에서는|에는|에도|와의|과의)(?:$|[^가-힣A-Za-z0-9]))`, 'i').test(title)
        : new RegExp(`\\b${escape(alias)}\\b`, 'i').test(title))
        || new RegExp(`(?:NASDAQ|NYSE|AMEX)\\s*:?\\s*${escape(symbol)}\\b|\\(${escape(symbol)}\\)`, 'i').test(title);
    },
  };
}
