import type { StockItem } from '@/config/constants';
import type { MarketGuide, MarketGuideId } from '@/config/marketGuides';
import { getStockCurrency, getStockIdentityKey, isKoreanStockSymbol } from '@/utils/stockCurrency';
import { recentResults, type EconomicEvent } from '@/lib/economicEvents';
import { getCompanyEvidence, type CompanyEvidence } from '@/lib/guideCompanyEvidence';

export function uniqueGuideStocks(stocks: StockItem[]) {
  const unique = new Map<string, StockItem>();
  for (const stock of stocks) {
    const symbol = stock.symbol.trim().toUpperCase();
    if (stock.demo || !symbol) continue;
    const key = getStockIdentityKey(symbol);
    if (!unique.has(key)) unique.set(key, { ...stock, symbol });
  }
  return [...unique.values()];
}

/** Context for questions, not a claim about a company's exposure or price direction. */
export function guideConnections(guide: MarketGuide, stocks: StockItem[]) {
  const unique = new Map<string, StockItem>();
  for (const stock of stocks) {
    const symbol = stock.symbol.trim().toUpperCase();
    if (stock.demo || !symbol) continue;
    const matches = guide.connection === 'usd-value' ? getStockCurrency(symbol, stock.currency) === 'USD'
      : guide.connection === 'us-market' ? !isKoreanStockSymbol(symbol) : true;
    if (matches) unique.set(getStockIdentityKey(symbol), { ...stock, symbol });
  }
  return [...unique.values()];
}

export function guideEvents(guide: MarketGuide, events: EconomicEvent[], now: number) {
  if (now <= 0 || !Number.isFinite(new Date(now).getTime())) return { recent: undefined, upcoming: undefined };
  const relevant = events.filter(event => Number.isFinite(Date.parse(event.at)) && guide.eventKinds.includes(event.kind));
  return {
    recent: recentResults(relevant.filter(event => Date.parse(event.at) <= now), now)[0],
    upcoming: relevant.filter(event => Date.parse(event.at) > now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0],
  };
}

export interface StockGuideConnection {
  stock: StockItem;
  name: string;
  basis: string;
  path: string;
  condition: string;
  watch: string;
  evidence?: CompanyEvidence;
  level: 'company' | 'currency' | 'unverified';
}

/** These topic links explain where to look; they do not infer an event's price impact. */
export function stockGuideConnections(topic: MarketGuideId, stocks: StockItem[], event?: EconomicEvent): StockGuideConnection[] {
  const candidates = uniqueGuideStocks(stocks).filter(stock => {
    if (event?.symbol) return getStockIdentityKey(stock.symbol) === getStockIdentityKey(event.symbol);
    if (topic === 'earnings') return true;
    const evidence = getCompanyEvidence(stock.symbol);
    if (topic === 'currency') return getStockCurrency(stock.symbol, stock.currency) === 'USD';
    if (event?.kind === 'bok') return isKoreanStockSymbol(stock.symbol);
    return !!evidence?.paths[topic] || getStockCurrency(stock.symbol, stock.currency) === 'USD';
  });
  return candidates.map(stock => {
    const evidence = getCompanyEvidence(stock.symbol);
    const companyPath = evidence?.paths[topic];
    const name = evidence?.name || stock.name || stock.symbol;
    if (evidence && companyPath) return { stock, name, basis: evidence.business, ...companyPath, evidence, level: 'company' as const };
    if (topic === 'currency') return {
      stock, name, level: 'currency' as const,
      basis: '등록된 거래 통화를 기준으로 달러 자산의 원화 환산 가치를 살펴봐요.',
      path: '달러 주가 × 수량 × 원·달러 환율 → 원화 평가액',
      condition: '계좌의 환산 효과와 회사의 실적 영향은 달라요. 이 회사의 판매·구입 통화는 아직 확인하지 못했어요.',
      watch: '달러 주가와 환율 변화를 나눠 보고, 매수 당시 환율을 입력했다면 환율 효과도 함께 비교해요.',
    };
    return {
      stock, name, level: 'unverified' as const,
      basis: event?.symbol ? '등록한 종목의 실적 발표예요.' : event?.kind === 'bok' ? '등록한 국내 종목을 함께 살펴봐요.' : '등록한 종목을 함께 살펴봐요.',
      path: topic === 'earnings' ? '발표된 매출·비용 → 이익 → 다음 사업 전망' : '경제 변화 → 금리·수요·비용 → 기업 실적을 확인할 필요',
      condition: '이 종목의 사업 구조와 이번 발표 사이의 연결 근거는 아직 확인하지 못했어요.',
      watch: '회사는 매출·비용·다음 전망을, ETF는 운용사의 구성 자산과 투자 대상을 먼저 확인해요.',
    };
  });
}

export function guideForEconomicEvent(event: EconomicEvent): MarketGuideId | undefined {
  if (event.kind === 'fomc' || event.kind === 'bok' || event.kind === 'jobs') return 'rates';
  if (event.kind === 'cpi' || event.kind === 'pce') return 'inflation';
  if (event.kind === 'earnings') return 'earnings';
  return undefined;
}

/** Same series (or same company) only: another company's earnings is not a follow-up. */
export function nextRelatedEvent(event: Pick<EconomicEvent, 'kind' | 'symbol'>, events: EconomicEvent[], now: number) {
  if (!Number.isFinite(now) || now <= 0) return undefined;
  return events.filter(item => item.kind === event.kind && Number.isFinite(Date.parse(item.at)) && Date.parse(item.at) > now
    && (!event.symbol || (!!item.symbol && getStockIdentityKey(item.symbol) === getStockIdentityKey(event.symbol))))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
}

export function recentPersonalResults(events: EconomicEvent[], stocks: StockItem[], now: number) {
  if (!Number.isFinite(now) || now <= 0) return [];
  const identities = new Set(uniqueGuideStocks(stocks).map(stock => getStockIdentityKey(stock.symbol)));
  const results = recentResults(events.filter(event => Number.isFinite(Date.parse(event.at)) && Date.parse(event.at) <= now), now)
    .filter(event => event.kind !== 'holiday' && (!event.symbol || identities.has(getStockIdentityKey(event.symbol))));
  // A user's own earnings precede broad market releases; dates remain visible in either case.
  return results.sort((a, b) => Number(!!b.symbol) - Number(!!a.symbol) || Date.parse(b.at) - Date.parse(a.at));
}
