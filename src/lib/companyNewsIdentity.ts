import { STOCK_KR } from '@/config/constants';

export const COMPANY_NEWS_ALIASES: Record<string, string[]> = {
  '340810.KQ': ['시선AI', '시선 AI', '시선에이아이', '시선 에이아이'],
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

/** 가져온 영어 기사가 그 회사 기사인지 알아볼 때만 쓰는 이름이다. 검색어·뉴스 탭 매칭·질문 속 종목 인식은 바꾸지 않는다.
 * 한국어 이름만 있으면 "Broadcom shares jump" 같은 영어 기사를 회사 기사로 알아보지 못해 버린다(2026-11-11 실측).
 * 흔한 영어 단어와 겹치는 이름은 법인명까지 붙인 형태만 쓴다(Block → Block Inc, Snap → Snap Inc). */
const ENGLISH_ARTICLE_NAMES: Record<string, string[]> = {
  AVGO: ['Broadcom'], AMD: ['Advanced Micro Devices'], NFLX: ['Netflix'], INTC: ['Intel'], QCOM: ['Qualcomm'],
  TSM: ['TSMC', 'Taiwan Semiconductor'], IONQ: ['IonQ'], RGTI: ['Rigetti'], QUBT: ['Quantum Computing Inc'],
  SMCI: ['Super Micro Computer', 'Supermicro'], DELL: ['Dell'], HPQ: ['HP Inc'], CSCO: ['Cisco'], SNOW: ['Snowflake'],
  DDOG: ['Datadog'], MDB: ['MongoDB'], NET: ['Cloudflare'], SHOP: ['Shopify'], SQ: ['Block Inc'], RBLX: ['Roblox'],
  SNAP: ['Snap Inc', 'Snapchat'], LYFT: ['Lyft'], DASH: ['DoorDash'], ZM: ['Zoom Video', 'Zoom Communications'], TWLO: ['Twilio'],
  MSTR: ['MicroStrategy', 'Strategy Inc'], MARA: ['MARA Holdings', 'Marathon Digital'], RIOT: ['Riot Platforms'], ARM: ['Arm Holdings'],
  AMAT: ['Applied Materials'], KLAC: ['KLA Corp', 'KLA Corporation'], LRCX: ['Lam Research'], ASML: ['ASML Holding'], TXN: ['Texas Instruments'],
  GE: ['GE Aerospace', 'General Electric'], BA: ['Boeing'], RTX: ['RTX Corp', 'Raytheon'], LMT: ['Lockheed Martin'],
  XOM: ['Exxon Mobil', 'ExxonMobil'], CVX: ['Chevron'], SHEL: ['Shell plc'], GS: ['Goldman Sachs'], MS: ['Morgan Stanley'],
  C: ['Citigroup'], WFC: ['Wells Fargo'], 'BRK.B': ['Berkshire Hathaway'], UNH: ['UnitedHealth'], LLY: ['Eli Lilly'], PFE: ['Pfizer'],
  MRNA: ['Moderna'], BNTX: ['BioNTech'], JPM: ['JPMorgan'], JNJ: ['Johnson & Johnson'], V: ['Visa Inc'], MA: ['Mastercard'],
  BAC: ['Bank of America'], WMT: ['Walmart'], PG: ['Procter & Gamble'], DIS: ['Disney'], PYPL: ['PayPal'], CRM: ['Salesforce'],
  ORCL: ['Oracle'], IBM: ['International Business Machines'], COST: ['Costco'], SBUX: ['Starbucks'], NKE: ['Nike'], UBER: ['Uber'],
  ABNB: ['Airbnb'], HOOD: ['Robinhood'], COIN: ['Coinbase'], PLTR: ['Palantir'], RIVN: ['Rivian'], LCID: ['Lucid Group', 'Lucid Motors'],
  NIO: ['Nio Inc'], BE: ['Bloom Energy'], BABA: ['Alibaba'], PDD: ['PDD Holdings', 'Pinduoduo'], JD: ['JD.com'],
};
/** 종목 코드 자체가 회사 이름으로 쓰이는 경우. 대문자 그대로일 때만 인정한다(일반 영어 단어와 겹치는 코드는 넣지 않는다). */
const TICKER_IS_THE_NAME = new Set(['AMD', 'IBM', 'ASML']);

export function mentionsCompanyInEnglish(symbol: string, text: string) {
  if (TICKER_IS_THE_NAME.has(symbol) && new RegExp(`(?<![A-Za-z0-9])${escape(symbol)}(?![A-Za-z0-9])`).test(text)) return true;
  return (ENGLISH_ARTICLE_NAMES[symbol] ?? []).some(name => new RegExp(`(?<![A-Za-z0-9])${name.split(/\s+/).map(escape).join('\\s+')}(?![A-Za-z0-9])`, 'i').test(text));
}

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
