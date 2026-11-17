import type { AssistantQuestion } from './assistantQuestion';
import { readMarketWatch } from './marketWatchStore';
import { readOfficialPolicies } from './marketCause/officialPublication';
import { STOCK_KR } from '@/config/constants';
import { getStoredIndustry } from './storedIndustry';
import { industryGroup } from './industryRegistry';
import { companyNewsIdentity } from './companyNewsIdentity';
import { fundProfile } from './fundExploration';
import { loadFeed } from './serverNewsFeed';
import { readCompanyExplanations } from './marketCause/companyPublication';
import { ASSISTANT_INDUSTRIES, ASSISTANT_INDUSTRY_BENCHMARKS, comparablePrices, parseAssistantPrice, type AssistantEvidencePacket, type AssistantIndustry, type AssistantPeriod, type PriceComparison } from './assistantEvidence';
import { assistantSessionSelection, type AssistantSessionReference, type AssistantSessionSelection } from './assistantSession';

const SECTOR_BENCHMARKS: Record<string, [string, string]> = {
  ...ASSISTANT_INDUSTRY_BENCHMARKS,
  communication: ['XLC', '미국 통신·미디어 기업을 담은 XLC'], 'consumer-discretionary': ['XLY', '미국 경기소비재 기업을 담은 XLY'],
  'consumer-staples': ['XLP', '미국 필수소비재 기업을 담은 XLP'], energy: ['XLE', '미국 에너지 기업을 담은 XLE'],
  financials: ['XLF', '미국 금융 기업을 담은 XLF'], healthcare: ['XLV', '미국 건강관리 기업을 담은 XLV'],
  industrials: ['XLI', '미국 산업재 기업을 담은 XLI'], materials: ['XLB', '미국 소재 기업을 담은 XLB'],
  'real-estate': ['XLRE', '미국 부동산 기업을 담은 XLRE'], utilities: ['XLU', '미국 공익사업 기업을 담은 XLU'],
};
/** One-minute, bounded process cache: public inputs only. Never caches questions or answers. */
async function bounded<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise.catch(() => fallback), new Promise<T>(resolve => { timer = setTimeout(() => resolve(fallback), 5000); })]); }
  finally { if (timer) clearTimeout(timer); }
}
const cache = new Map<string, { expires: number; promise: Promise<AssistantEvidencePacket> }>();
export function collectAssistantEvidence(symbol: string, period: AssistantPeriod, fund = false, sessionReference: AssistantSessionReference = 'latest', industryFocus: AssistantIndustry[] = []): Promise<AssistantEvidencePacket> {
  const now = Date.now(), session = assistantSessionSelection(symbol, sessionReference, now);
  const requestedIndustries = ['^GSPC', '^IXIC'].includes(symbol) ? ASSISTANT_INDUSTRIES.filter(industry => industryFocus.includes(industry)) : [];
  if (sessionReference === 'previous' && !session) return Promise.resolve({ version: 1, symbol, period, checkedAt: new Date(now).toISOString(), sessionUnavailable: true, comparisons: [], evidence: [], gaps: ['요청한 거래일의 거래 일정을 확인하지 못했어요. 최신 장중 자료로 대신하지 않았어요.'] });
  const key = `${symbol}:${period}:${fund}:${sessionReference}:${session?.throughDay ?? ''}:${requestedIndustries.join(',')}`, cached = cache.get(key);
  if (cached && cached.expires > now) return cached.promise;
  for (const [k, item] of cache) if (item.expires <= now) cache.delete(k);
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  const promise = collect(symbol, period, fund, now, session, requestedIndustries);
  cache.set(key, { expires: now + 60_000, promise });
  void promise.catch(() => { if (cache.get(key)?.promise === promise) cache.delete(key); });
  return promise;
}

/** Preserve yesterday's event window while separately checking today's price. */
export async function collectAssistantQuestionEvidence(question: AssistantQuestion, fund = false): Promise<AssistantEvidencePacket> {
  const symbol = question.symbol ?? (question.market === 'us' ? '^GSPC' : '^KS11');
  const mixed = /어제/.test(question.text) && /오늘/.test(question.text);
  const [primary, latest] = await Promise.all([
    collectAssistantEvidence(symbol, question.period ?? '1d', fund, question.sessionReference, question.industryFocus),
    mixed ? collectAssistantEvidence(symbol, '1d', fund, 'latest') : undefined,
  ]);
  if (!mixed) return primary;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: /\.(KS|KQ)$/.test(symbol) || ['^KS11','^KQ11'].includes(symbol) ? 'Asia/Seoul' : 'America/New_York', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(primary.checkedAt));
  // Yesterday's close returned as "latest" is not evidence of today's move.
  if (!latest?.price || latest.price.day !== today || latest.price.day === primary.price?.day) return {...primary, gaps:[...primary.gaps,'오늘 날짜의 가격 자료를 추가 조회했지만 확인하지 못했어요. 사용자 설명을 확인된 시세처럼 쓰지 마세요.']};
  const priceSource = latest.evidence.find(source => source.id === 'P1');
  return {...primary, latestPrice:latest.price, evidence:[...primary.evidence, ...(priceSource ? [{...priceSource,id:'P99',title:`오늘 확인한 ${latest.price.label} 가격`}] : [])]};
}
async function quote(symbol: string, label: string, period: AssistantPeriod, now: number, throughDay?: string) {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d&events=splits&includePrePost=false`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6500), cache: 'no-store' });
    if (!response.ok) return null;
    return parseAssistantPrice(symbol, label, await response.json(), period, now, throughDay);
  } catch { return null; }
}
async function companyNews(symbol: string, name: string, days: number) {
  const identity = companyNewsIdentity(symbol, name);
  let hadFailure = false;
  for (let i = 0; i < 2; i++) {
    try {
      const korean = /(?:\.KS|\.KQ)$/.test(symbol) || i === 0;
      const locale = korean ? 'hl=ko&gl=KR&ceid=KR:ko' : 'hl=en&gl=US&ceid=US:en';
      const feed = await loadFeed(`https://news.google.com/rss/search?q=${encodeURIComponent(`${identity.queries[i]} when:${days}d`)}&${locale}`, 3000);
      const items = feed.filter(item => identity.matches(item.title) && /^https:\/\//.test(item.link));
      if (items.length) return { items, unavailable: false };
    } catch { hadFailure = true; }
  }
  return { items: [], unavailable: hadFailure };
}
async function collect(symbol: string, period: AssistantPeriod, fund: boolean, now: number, session?: AssistantSessionSelection, industryFocus: AssistantIndustry[] = []): Promise<AssistantEvidencePacket> {
  const stored = getStoredIndustry(symbol), canonical = stored.symbol;
  const kr = /(?:\.KS|\.KQ)$/.test(canonical) || ['^KS11', '^KQ11'].includes(canonical), us = ['^GSPC', '^IXIC'].includes(canonical) || /^[A-Z][A-Z0-9.-]{0,10}$/.test(canonical) && !canonical.includes('.');
  const benchmark: [string, string] | undefined = kr ? ((canonical.endsWith('.KQ') || canonical === '^KQ11') ? ['^KQ11', '코스닥 시장'] : ['^KS11', '코스피 시장']) : us ? ['^GSPC', '미국 대형주 시장(S&P 500)'] : undefined;
  const underlying = fundProfile(canonical)?.underlyingSymbol;
  const newsSymbol = underlying || canonical;
  const company = underlying ? getStoredIndustry(underlying) : stored;
  const group = industryGroup(company.industryId);
  const sectorKey = group && ['Semiconductors', 'Semiconductor Equipment & Materials'].includes(group.raw) ? 'semiconductors' : group?.parent;
  const sector = us && (!fund || underlying) && company.status === 'classified' ? SECTOR_BENCHMARKS[sectorKey ?? ''] : undefined;
  const targets = [...new Map([underlying ? [underlying, STOCK_KR[underlying] || company.name || underlying] : undefined, benchmark, sector,
    ...industryFocus.map(industry => ASSISTANT_INDUSTRY_BENCHMARKS[industry])].filter((v): v is [string, string] => !!v && v[0] !== canonical).map(target => [target[0], target])).values()];
  const [price, others, news, publications, marketFeed, policies] = await Promise.all([
    quote(canonical, ({ '^KS11': '코스피', '^KQ11': '코스닥', '^GSPC': '미국 대형주 시장(S&P 500)', '^IXIC': '나스닥 종합지수' } as Record<string, string>)[canonical] || STOCK_KR[canonical] || stored.name || canonical, period, now, session?.throughDay),
    Promise.all(targets.map(([ticker, label]) => quote(ticker, label, period, now, session?.throughDay))),
    canonical.startsWith('^') ? Promise.resolve({ items: [], unavailable: false }) : companyNews(newsSymbol, company.name, period === '1d' ? 7 : period === '5d' ? 14 : 35),
    // Reuse only the already-published projection; never launch collection or another model.
    bounded(readCompanyExplanations(), { cards: [], warnings: [] }),
    bounded(readMarketWatch(now), { events: [], runs: [], servedAt: new Date(now).toISOString() }),
    bounded(readOfficialPolicies(), { cards: [], warnings: [] }),
  ]);
  const packet: AssistantEvidencePacket = { version: 1, symbol: canonical, subjectName: STOCK_KR[newsSymbol] || company.name || newsSymbol, period, checkedAt: new Date(now).toISOString(),
    ...(price ? { price } : {}), ...(session ? { session } : {}), ...(industryFocus.length ? { industryFocus } : {}), comparisons: [], evidence: [], gaps: [] };
  if (!price) packet.gaps.push('비교할 가격을 확인하지 못했어요. 자료 누락·지연·주식 분할 여부를 확인해야 해요.');
  if (price) {
    packet.comparisons = others.filter((q): q is PriceComparison => !!q && comparablePrices(price, q));
    if (packet.comparisons.length < targets.length) packet.gaps.push('거래일·비교 시작일·시각이 맞지 않거나 받지 못한 비교 자료는 제외했어요.');
    if (!sector && !fund && !canonical.startsWith('^')) packet.gaps.push('이 종목과 비교할 업종 가격은 연결하지 못했어요.');
    for (const [index, q] of [price, ...packet.comparisons].entries()) {
      packet.evidence.push({ id: `P${index + 1}`, kind: 'price', title: q.label,
        text: `${q.baselineDay} 종가 대비 ${q.day} 마지막 정규장 가격의 변화 ${q.changePercent}%. 가격 ${q.price} ${q.symbol.startsWith('^') ? '포인트' : q.currency}. ${q.intradayLowChangePercent !== undefined ? `마지막 거래일의 장중 최저 가격은 전일 종가 대비 ${q.intradayLowChangePercent}%, 최고는 ${q.intradayHighChangePercent}%. 최저 가격은 전일 종가보다 ${q.intradayLowChangePercent < 0 ? '낮았음' : q.intradayLowChangePercent > 0 ? '높았음(하락이 아님)' : '같았음'}. 장중 최저와 마지막 가격을 구분할 것.` : '장중 최저·최고 등락은 확인하지 못함.'} 확인 시각 ${q.at}. ${index ? `대상 종목과의 등락률 차이 ${(price.changePercent - q.changePercent).toFixed(2)}%포인트.` : ''} 배당금 제외. 실시간 보장 없음. 비슷하게 움직였다는 사실만으로 원인을 알 수 없음.`,
        url: `https://finance.yahoo.com/quote/${encodeURIComponent(q.symbol)}/history/`, publisher: 'Yahoo Finance', publishedAt: q.at, checkedAt: packet.checkedAt });
    }
  }
  const cutoff = price ? Date.parse(price.at) : now;
  const earliest = price ? Date.parse(price.baselineDay) - 86400_000 : (session ? Date.parse(session.throughDay) : now) - 7 * 86400_000;
  const dayOf = (at: string) => new Intl.DateTimeFormat('en-CA', { timeZone: kr ? 'Asia/Seoul' : 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
  const throughDay = price?.day ?? session?.throughDay;
  const timely = (at: string) => Date.parse(at) >= earliest && Date.parse(at) <= now && (!throughDay || dayOf(at) <= throughDay);
  const relevant = [...new Map(news.items.filter(item => timely(item.pubDate)).map(item => [item.title, item])).values()].slice(0, 5);
  for (const [index, item] of relevant.entries()) packet.evidence.push({ id: `N${index + 1}`, kind: 'headline', scope: 'company', ...(!session ? { timing: Date.parse(item.pubDate) > cutoff ? 'after-price' as const : 'before-price' as const } : {}), title: item.title.slice(0, 400),
    text: '검색에서 받은 기사 제목만 확인함. 본문·보도 사실·주가 하락 원인은 확인하지 못함.', url: item.link,
    publisher: item.source.slice(0, 100), publishedAt: new Date(item.pubDate).toISOString(), checkedAt: packet.checkedAt });
  if (!canonical.startsWith('^') && !relevant.length) packet.gaps.push(news.unavailable ? '뉴스 검색을 완료하지 못했어요. 소식이 없다는 뜻은 아니에요.' : '비교 기간과 마지막 가격 확인 시각에 맞는 회사 뉴스 제목을 찾지 못했어요.');
  if (news.items.some(item => Date.parse(item.pubDate) > cutoff)) packet.gaps.push('가격 확인 후 나온 기사도 있어요. 기사가 나온 시각과 사건이 일어난 시각은 다를 수 있어요.');
  for (const [index, card] of publications.cards.filter(card => card.symbol === canonical && timely(card.publishedAt) && Date.parse(card.publishedAt) <= cutoff).slice(0, 2).entries()) {
    const source = card.sources.find(s => /^https:\/\//.test(s.url));
    if (!source) continue;
    packet.evidence.push({ id: `D${index + 1}`, kind: 'publication', title: card.title, text: `${card.summary}\n${card.meaning}\n${card.path}\n${card.condition}`.slice(0, 1800),
      url: source.url, publisher: source.label, publishedAt: card.publishedAt, checkedAt: card.checkedAt });
  }
  const market = kr ? 'kr' : us ? 'us' : undefined;
  const relevance = (title: string) => kr
    ? (/코스피|코스닥|한국\s*증시|국내\s*증시/.test(title) ? 4 : /日\s*증시|일본\s*증시|닛케이/.test(title) ? -4 : 0)
    : /미국\s*증시|뉴욕\s*증시|나스닥|S&P|Wall Street|U\.S\. stocks|Nasdaq/i.test(title) ? 4 : 0;
  const events = marketFeed.events.filter(event => (event.market === market || event.market === 'global' && (event.sectors.includes(sectorKey as never) || industryFocus.some(industry => event.sectors.includes(industry as never))))
    && ['market-news', 'industry-news'].includes(event.kind));
  // Article dates below determine relevance, not the RSS batch's last polling time.
  const marketSources = [...new Map(events.flatMap(event => event.sources.filter(source => source.title && /^https:\/\//.test(source.url) && timely(source.at))
    .map(source => ({ ...source, scope: event.kind === 'industry-news' ? 'industry' as const : 'market' as const }))).map(source => [source.url, source])).values()]
    .filter(source => relevance(source.title ?? '') >= 0)
    .sort((a, b) => relevance(b.title ?? '') - relevance(a.title ?? '') || Date.parse(b.at) - Date.parse(a.at)).slice(0, 4);
  for (const [index, source] of marketSources.entries()) packet.evidence.push({ id: `M${index + 1}`, kind: 'headline', scope: source.scope,
    ...(!session ? { timing: Date.parse(source.at) > cutoff ? 'after-price' as const : 'before-price' as const } : {}), title: source.title!.slice(0, 400), text: '시장·업종 관련 검색에서 수집한 기사 제목. 본문과 주가 변동 원인은 확인하지 못함.',
    url: source.url, publisher: source.label, publishedAt: source.at, checkedAt: marketFeed.servedAt });
  if (!marketSources.length) packet.gaps.push('비교 기간에 맞는 시장 전체 소식을 연결하지 못했어요. 회사 뉴스만으로 시장 하락을 설명할 수는 없어요.');
  for (const [index, card] of policies.cards.filter(card => (card.market === market || card.market === 'us' && market === 'kr') && timely(card.publishedAt) && Date.parse(card.publishedAt) <= cutoff).entries()) {
    packet.evidence.push({ id: `F${index + 1}`, kind: 'publication', scope: 'market', title: card.title,
      text: `${card.summary} ${card.meaning} ${card.path.join(' ')} ${card.condition}`, url: card.sourceUrl, publisher: card.authority === 'fed' ? '미국 연방준비제도' : '한국은행',
      publishedAt: card.publishedAt, checkedAt: card.checkedAt });
  }
  return packet;
}
