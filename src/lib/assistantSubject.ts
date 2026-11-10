import snapshot from '../../public/stock-catalog.json';
import { STOCK_KR } from '@/config/constants';
import { EXTRA_ALIASES } from '@/config/stockSearchAliases';
import { COMPANY_NEWS_ALIASES } from './companyNewsIdentity';
import type { AssistantQuestion } from './assistantQuestion';
import type { AssistantSessionReference } from './assistantSession';
import type { AssistantIndustry } from './assistantEvidence';

// Server-only catalog matching: no model request, portfolio access or fuzzy issuer guesses.
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const commonWords = new Set(['A', 'I', 'AI', 'IT', 'ON', 'BE', 'FOR', 'OR', 'ALL', 'ANY', 'NOW', 'NEW', 'OPEN', 'CAN', 'ARE', 'CEO', 'ETF']);
const catalog = new Map(snapshot.stocks.map(stock => [stock.symbol, stock]));
const symbols = new Set([...catalog.keys(), ...Object.keys(STOCK_KR)]);
const entries = [...symbols].map(symbol => {
  const stock = catalog.get(symbol);
  const names = [...new Set([STOCK_KR[symbol], stock?.description, stock?.englishName,
    ...(EXTRA_ALIASES[symbol] ?? []), ...(COMPANY_NEWS_ALIASES[symbol] ?? [])].filter((name): name is string => !!name && name !== symbol && name.length >= 2))];
  const patterns = names.map(name => ({ needle: name.replace(/\s+/g, '').toLowerCase(), pattern: new RegExp(`(?<![가-힣A-Za-z0-9])${name.trim().split(/\s+/).map(escape).join('\\s*')}(?=$|[^가-힣A-Za-z0-9]|(?:은|는|이|가|을|를|의|에|와|과|도|만|에서|보다|처럼|이랑|랑)(?=$|[^가-힣A-Za-z0-9]))`, 'i') }));
  return { symbol, label: STOCK_KR[symbol] || stock?.description || symbol, patterns };
});
export function mentionedAssistantStocks(text: string) {
  const compact = text.replace(/\s+/g, '').toLowerCase();
  const tickers = new Set([...text.matchAll(/(?:\$|\b(?:NASDAQ|NYSE)\s*:\s*)?\b[A-Z][A-Z0-9.-]{0,10}\b|\b\d{6}(?:\.K[SQ])?\b/g)].map(match => {
    const token = match[0], symbol = token.replace(/^\$|^(?:NASDAQ|NYSE)\s*:\s*/, '');
    return commonWords.has(symbol) && token === symbol ? '' : symbol;
  }));
  return entries.filter(entry => tickers.has(entry.symbol) || (/\.K[SQ]$/.test(entry.symbol) && tickers.has(entry.symbol.slice(0, 6))) || entry.patterns.some(({ needle, pattern }) => compact.includes(needle) && pattern.test(text)))
    .map(({ symbol, label }) => ({ symbol, label }));
}
function mentionedIndustries(text: string): AssistantIndustry[] {
  const focus: AssistantIndustry[] = [];
  if (/반도체\s*(?:주|업종|기업|회사)|\b(?:semiconductor|chip)\s+(?:stocks|sector|companies)\b/i.test(text)) focus.push('semiconductors');
  if (/기술주|기술\s*업종|\b(?:tech|technology)\s+(?:stocks|sector|companies)\b/i.test(text)) focus.push('technology');
  return focus;
}
const wholeMarket = (text: string) => /시장\s*전체|전체\s*(?:시장|증시)|증시\s*전체|\b(?:broad market|market[- ]wide)\b/i.test(text);
const mentionedMarket = (text: string): 'kr' | 'us' | undefined => /미국(?:의)?\s*(?:시장|증시|주식|기술주|기술\s*업종|반도체)|미장|나스닥|S&P\s*500|\b(?:US|U\.S\.|American)\s+(?:semiconductor|chip|tech|technology|stock)/i.test(text) ? 'us' : /한국(?:의)?\s*(?:시장|증시|주식|기술주|반도체)|국내\s*(?:시장|증시|주식|기술주|반도체)|국장|코스피|코스닥/.test(text) ? 'kr' : undefined;
export function resolveAssistantSubject(question: AssistantQuestion): { question: AssistantQuestion; candidates: { symbol: string; label: string }[] } {
  const reference = (text: string): AssistantSessionReference | undefined => /어제/.test(text) ? 'previous' : /오늘|최근\s*거래일|(?:최근\s*)?5\s*(?:거래)?일|이번\s*주|최근\s*(?:한|1)\s*(?:달|개월)|20\s*거래일/.test(text) ? 'latest' : undefined;
  // Current words override prior relative choices. Earlier generated answers
  // are never date selectors; history carries only a validated relative choice,
  // not a claimed trading date, after the original question leaves the window.
  const sessionReference = reference(question.text) ?? [...(question.history ?? [])].reverse().map(turn => reference(turn.question) ?? turn.sessionReference).find(Boolean) ?? 'latest';
  question = { ...question, sessionReference };
  let matches = mentionedAssistantStocks(question.text);
  const market = mentionedMarket(question.text);
  const period = /(?:최근\s*)?5\s*(?:거래)?일|이번\s*주/.test(question.text) ? '5d' : /최근\s*(?:한|1)\s*(?:달|개월)|20\s*거래일/.test(question.text) ? '1m' : /오늘|어제|최근\s*거래일/.test(question.text) ? '1d' : question.history?.at(-1)?.period ?? question.period;
  const inheritedMarket = [...(question.history ?? [])].reverse().map(turn => turn.market ?? mentionedMarket(turn.question)).find(Boolean) ?? (question.symbol ? /\.K[SQ]$/.test(question.symbol) ? 'kr' : 'us' : question.market);
  const explicitIndustries = mentionedIndustries(question.text);
  let industryFocus: AssistantIndustry[] = [];
  if (!matches.length && (market ?? inheritedMarket) === 'us' && !wholeMarket(question.text)) {
    industryFocus = explicitIndustries;
    if (!industryFocus.length && !market) for (const turn of [...(question.history ?? [])].reverse()) {
      if (turn.industryFocus !== undefined) { industryFocus = turn.industryFocus; break; }
      if (wholeMarket(turn.question) || turn.symbol && turn.symbol !== 'GENERAL') break;
      industryFocus = mentionedIndustries(turn.question);
      if (industryFocus.length) break;
    }
  }
  question = { ...question, industryFocus, ...(industryFocus.length ? { market: 'us' as const } : {}) };
  if (!matches.length && industryFocus.length && explicitIndustries.length) return { question: { ...question, symbol: undefined, market: market ?? inheritedMarket, period }, candidates: [] };
  if (!matches.length && market) return { question: { ...question, symbol: undefined, market, period }, candidates: [] };
  if (!matches.length) {
    // Follow "그럼 왜?" back to the last named subject; previous AI prose is never an identity source.
    for (const turn of [...(question.history ?? [])].reverse()) {
      if (turn.symbol && symbols.has(turn.symbol)) { matches = [{ symbol: turn.symbol, label: STOCK_KR[turn.symbol] || turn.symbol }]; break; }
      if (turn.symbol === 'GENERAL' && turn.market) return { question: { ...question, symbol: undefined, market: turn.market, period }, candidates: [] };
      matches = mentionedAssistantStocks(turn.question);
      if (matches.length) break;
    }
  }
  if (matches.length > 1 && question.confirmedSymbol && matches.some(match => match.symbol === question.confirmedSymbol)) matches = matches.filter(match => match.symbol === question.confirmedSymbol);
  if (matches.length !== 1) return { question: { ...question, period,
    ...(!matches.length && question.symbol ? { market: /\.K[SQ]$/.test(question.symbol) ? 'kr' as const : 'us' as const } : {}),
  }, candidates: matches };
  const symbol = matches[0].symbol;
  return { question: { ...question, symbol, period, market: /\.K[SQ]$/.test(symbol) ? 'kr' : 'us' }, candidates: [] };
}
