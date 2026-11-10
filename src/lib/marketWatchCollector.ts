import { KRX_RSS_URL, WATCH_TARGETS, type WatchTarget } from '@/config/marketWatch';
import { SECTORS, SECTOR_COMPANY_EVIDENCE, type SectorDefinition } from '@/lib/sectorExploration';
import { ECON_EXPLAIN, recentResults } from '@/lib/economicEvents';
import { getEconomicFeed, readEconomicSchedule } from '@/lib/economicFeed';
import { krxWatchEvents, parseWatchRss, quoteWatchEvent, sectorRotationEvent, watchDay, type RssItem, type WatchChart } from './marketWatchAnalysis';
import type { WatchCandidate, WatchCoverage, WatchScope } from './marketWatch';
import { setTimeout as delay } from 'node:timers/promises';

type Request = typeof fetch;
const headers = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'application/rss+xml, application/json, text/xml', 'Cache-Control': 'no-cache',
};
async function read(url: string, request: Request, requestHeaders: Record<string, string> = headers, allowForbidden = false): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await request(url, { cache: 'no-store', headers: requestHeaders, signal: AbortSignal.timeout(7000) });
    } catch (error) { if (attempt === 1) throw error; else continue; }
    if (response.ok || allowForbidden && response.status === 403) return response;
    if (attempt === 0 && response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const seconds = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter)
        : retryAfter ? (Date.parse(retryAfter) - Date.now()) / 1000 : 1;
      // A longer provider cooldown belongs to the next scheduled scan, not a burst retry.
      if (!Number.isFinite(seconds) || seconds > 2) throw new Error('Source returned 429');
      await delay(Math.max(0, seconds) * 1000);
      continue;
    }
    if (attempt === 0 && response.status >= 500) continue;
    throw new Error(`Source returned ${response.status}`);
  }
  throw new Error('Source unavailable');
}
async function rss(url: string, now: number, request: Request) {
  const xml = await (await read(url, request)).text();
  if (xml.length > 4_000_000) throw new Error('RSS too large');
  return parseWatchRss(xml, now);
}
async function mapLimited<T, R>(items: T[], task: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(5, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { status: 'fulfilled', value: await task(items[index]) }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  }));
  return results;
}
const newsUrl = (query: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:1d`)}&hl=ko&gl=KR&ceid=KR:ko`;
// The registry is the common coverage denominator; adding a new industry automatically adds its search.
const queryAliases: Record<string, string> = {
  energy: '(석유 OR 원유 OR 천연가스 OR 에너지)', healthcare: '(헬스케어 OR 제약 OR 바이오 OR 의료)',
  technology: '(정보기술 OR 소프트웨어)', communication: '(통신 OR 미디어)',
  'consumer-discretionary': '(경기소비재 OR 유통 OR 여행)', 'consumer-staples': '(필수소비재 OR 식품)',
  'real-estate': '(부동산 OR 리츠)', 'fuel-cells': '(연료전지 OR 분산발전)',
  'post-quantum-security': '(양자내성암호 OR 양자내성보안)', quantum: '양자컴퓨팅',
  photonics: '(광통신 OR 포토닉스)', equipment: '(반도체 장비 OR 소부장)',
  'nand-storage': '(낸드 OR 플래시메모리)', 'hdd-storage': '(하드디스크 OR HDD)',
};
function industryQuery(sector: SectorDefinition) {
  return `${queryAliases[sector.id] ?? `(${sector.name.split('·').join(' OR ')})`} (주식 OR 기업 OR 실적 OR 투자 OR 수주 OR 정책)`;
}
function withRelatedSymbols(candidate: WatchCandidate): WatchCandidate {
  if (candidate.relatedSymbols?.length) return candidate;
  if (candidate.measure && WATCH_TARGETS.some(target => target.symbol === candidate.measure!.symbol && target.kind === 'company')) {
    return { ...candidate, relatedSymbols: [candidate.measure.symbol] };
  }
  return { ...candidate, relatedSymbols: [...new Set(SECTORS.filter(sector => candidate.sectors.includes(sector.id)
    || sector.parent && candidate.sectors.includes(sector.parent)).flatMap(sector => sector.companies))] };
}

export function relevantIndustryHeadline(title: string, sector: SectorDefinition): boolean {
  if (/기후주간|기념식|시민.*행사|박람회|세미나|포럼.*개최|행사.*개막/.test(title)) return false;
  const names = SECTOR_COMPANY_EVIDENCE.filter(company => sector.companies.includes(company.symbol)).map(company => company.name);
  const terms = (queryAliases[sector.id] || sector.name).replace(/[()]/g, '').split(/ OR |·/);
  const matchesSector = [...names, ...terms].some(term => term.length > 1 && title.includes(term));
  const hasEvent = /실적|매출|영업이익|순이익|수주|계약|공급|생산|수출|수입|승인|임상|규제|관세|인수|합병|파산|증설|감산|가격|유가|급등|급락|상장|배당|금리|[조억]원.*투자|투자.*[조억]원/.test(title);
  return matchesSector && hasEvent;
}

function newsEvent(id: string, label: string, articles: RssItem[], now: number, sector?: SectorDefinition): WatchCandidate | null {
  const unique = new Map<string, RssItem>();
  for (const item of articles) {
    if (now - Date.parse(item.at) > 36 * 3600000) continue;
    const title = item.title.replace(/\s*-\s*[^-]+$/, '').replace(/\s+/g, ' ').trim();
    if (sector && !relevantIndustryHeadline(title, sector)) continue;
    if (!unique.has(title)) unique.set(title, { ...item, title });
  }
  const recent = [...unique.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 4);
  if (!recent.length) return null;
  const last = recent[0];
  const publishers = new Set(recent.map(item => item.publisher).filter(Boolean));
  const impact = recent.some(item => /급락|급등|금리|관세|거래.*중단|서킷|사이드카|규제|실적|수주|승인|공급|수출/.test(item.title));
  return {
    id: `news:${id}:${watchDay(last.at, 'kr')}`, kind: sector ? 'industry-news' : 'market-news', market: sector ? 'global' : id === 'kr' ? 'kr' : 'us',
    title: last.title, topic: label, summary: last.title,
    meaning: sector?.intro ?? '시장·정책·기업에 관한 최근 보도예요. 기사에서 제시한 해석은 공식 발표나 시세 관찰과 구분해서 읽어야 해요.',
    path: sector?.steps.map(step => `${step.title}: ${step.body}`) ?? ['보도에서 제기한 변화 확인', '발표 주체의 원문과 실제 수치 확인', '관련 시장·산업의 후속 변화 관찰'],
    watch: sector?.check ?? '기사에 나온 발표일과 대상 시장을 확인해보세요. 함께 움직였다는 사실만으로 원인이라고 단정하지 않아요.',
    limits: '기사 제목을 모은 관련 검색 결과예요. 본문 검증이나 오늘 주가 변동의 원인 분석은 아니에요. 아래 영향 경로는 일반적인 배경 설명이에요.',
    sources: recent.map(item => ({ label: item.publisher || '관련 기사', url: item.url, at: item.at, title: item.title })),
    sectors: sector ? [sector.id] : [], status: 'reported', priority: (sector ? 15 : 35) + Math.min(8, publishers.size * 2) + (impact ? 8 : 0),
    asOf: last.at, fingerprint: recent.map(item => item.url).sort().join('|'),
  };
}

export interface WatchCollection { candidates: WatchCandidate[]; coverage: WatchCoverage[]; warnings: string[] }
async function readExchange(now: number, request: Request): Promise<RssItem[]> {
  const url = new URL(KRX_RSS_URL);
  url.searchParams.set('_checked', String(Math.floor(now / 60000)));
  const home = 'https://kind.krx.co.kr/disclosure/todaydisclosure.do?method=searchTodayDisclosureMain';
  const exchangeHeaders = { ...headers,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.7', Referer: home };
  let response = await read(url.toString(), request, exchangeHeaders, true);
  if (response.status === 403) {
    // The public RSS can require the same anonymous session as the disclosure page.
    const session = await read(home, request, exchangeHeaders, true);
    const cookie = session.ok ? session.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ') : '';
    if (cookie) response = await read(url.toString(), request, { ...exchangeHeaders, Cookie: cookie });
  }
  if (!response.ok) throw new Error(`Exchange source returned ${response.status}`);
  const xml = await response.text();
  if (xml.length > 4_000_000) throw new Error('RSS too large');
  const channelHeader = xml.split(/<item\b/i)[0];
  const buildDate = channelHeader.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/i)?.[1];
  const builtAt = Date.parse(buildDate ?? '');
  // KIND omits lastBuildDate when today's public feed is empty (including midnight).
  // Require its exact empty-feed shape and a fresh, uncached origin response; an
  // empty result only means this feed supplied no items, never proof of no halt.
  if (!buildDate && !/<item\b/i.test(xml) && /<title>\s*오늘의공시\s*::\s*<\/title>/.test(channelHeader)) {
    const servedAt = Date.parse(response.headers.get('Date') ?? '');
    const age = response.headers.get('Age');
    if (Number.isFinite(servedAt) && Math.abs(servedAt - now) <= 60000 && (age === null || age === '0')) {
      return parseWatchRss(xml, now);
    }
  }
  if (!Number.isFinite(builtAt) || builtAt > now + 60000 || now - builtAt > 30 * 60000) throw new Error('Stale exchange feed');
  return parseWatchRss(xml, now);
}
async function readQuote(target: WatchTarget, now: number, request: Request): Promise<WatchCandidate> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(target.symbol)}`;
  const daily = await (await read(`${url}?range=3mo&interval=1d`, request)).json() as { chart?: { result?: WatchChart[] } };
  const chart = daily.chart?.result?.[0];
  if (chart?.meta?.symbol && chart.meta.symbol !== target.symbol) throw new Error('Quote symbol mismatch');
  let candidate = chart ? quoteWatchEvent(target, chart, now) : null;
  // FX daily charts can have a null preceding bar. Intraday metadata supplies an
  // explicit previous close; never skip that bar or use the three-month start.
  if (!candidate && target.kind === 'fx') {
    const intraday = await (await read(`${url}?range=1d&interval=5m`, request)).json() as { chart?: { result?: WatchChart[] } };
    const current = intraday.chart?.result?.[0];
    if (current?.meta?.symbol === target.symbol && typeof current.meta.previousClose === 'number'
      && Number.isFinite(current.meta.previousClose) && current.meta.previousClose > 0) {
      candidate = quoteWatchEvent(target, { ...chart, meta: current.meta }, now);
    }
  }
  if (!candidate) throw new Error('Missing dated quote or previous close');
  return candidate;
}
/** Fixed public sources only. Cron authentication guards the caller; no publishing or notifications. */
export async function probeWatchSources(now = Date.now()) {
  const probes = [
    { source: 'krx', run: () => readExchange(now, fetch).then(items => ({ items: items.length })) },
    { source: 'bls', run: () => readEconomicSchedule('bls').then(events => ({ events: events.length })) },
    { source: 'fx', run: () => readQuote(WATCH_TARGETS.find(target => target.kind === 'fx')!, now, fetch).then(event => ({ asOf: event.asOf })) },
  ];
  return Promise.all(probes.map(async probe => {
    try { return { source: probe.source, ok: true, ...await probe.run() }; }
    catch (error) { return { source: probe.source, ok: false, reason: error instanceof Error ? error.message : 'unknown' }; }
  }));
}
export async function collectMarketWatch(scope: WatchScope, now = Date.now(), request: Request = fetch): Promise<WatchCollection> {
  const checkedAt = new Date(now).toISOString();
  const candidates: WatchCandidate[] = []; const coverage: WatchCoverage[] = []; const warnings: string[] = [];
  if (scope === 'industries') {
    const results = await mapLimited(SECTORS, async sector => newsEvent(sector.id, sector.name,
      await rss(newsUrl(industryQuery(sector)), now, request), now, sector));
    results.forEach(result => { if (result.status === 'fulfilled' && result.value) candidates.push(result.value); });
    const available = results.filter(result => result.status === 'fulfilled').length;
    coverage.push({ id: 'industry-news', label: '산업별 기사 검색', available, total: SECTORS.length, checkedAt, selected: candidates.length });
    const failed = SECTORS.filter((_, index) => results[index].status === 'rejected').map(sector => sector.name);
    if (failed.length) warnings.push(`산업 소식 검색 미완료: ${failed.join(' · ')}`);
    return { candidates: candidates.map(withRelatedSymbols), coverage, warnings };
  }

  const [quotes, notices, economics, news] = await Promise.all([
    mapLimited(WATCH_TARGETS, target => readQuote(target, now, request)),
    readExchange(now, request).then(items => {
      if (items.length >= 3000) warnings.push('거래소 RSS의 최대 조회 건수에 도달했어요. 앞선 공시가 누락됐을 수 있어요.');
      return krxWatchEvents(items, now);
    }).then(value => ({ ok: true as const, value })).catch(error => {
      console.warn('Market watch exchange source unavailable:', error instanceof Error ? error.message : 'unknown');
      return { ok: false as const, value: [] };
    }),
    getEconomicFeed().then(value => ({ ok: true as const, value })).catch(() => ({ ok: false as const })),
    mapLimited([{ id: 'kr', label: '한국 시장', query: '(코스피 OR 코스닥 OR 한국 증시)' },
      { id: 'us', label: '미국 시장·정책', query: '(미국 증시 OR 연준 OR 관세)' }], async item => newsEvent(item.id, item.label,
      await rss(newsUrl(item.query), now, request), now)),
  ]);
  quotes.forEach(result => { if (result.status === 'fulfilled') candidates.push(result.value); });
  const rotation = sectorRotationEvent(candidates);
  if (rotation) candidates.push(rotation);
  coverage.push({ id: 'quotes', label: '지수·미국 업종 ETF·주요 기업·환율·원자재·국채금리', available: quotes.filter(result => result.status === 'fulfilled').length, total: WATCH_TARGETS.length, checkedAt });
  const missing = WATCH_TARGETS.filter((_, index) => quotes[index].status === 'rejected').map(target => target.label);
  if (missing.length) warnings.push(`시세 비교 미확인: ${missing.join(' · ')}`);
  candidates.push(...notices.value);
  coverage.push({ id: 'krx', label: '한국거래소 시장조치 공시', available: notices.ok ? 1 : 0, total: 1, checkedAt });
  if (!notices.ok) warnings.push('거래소 공시를 갱신하지 못했어요. 이전 발동·해제 상태는 마지막 확인 기록이에요.');
  coverage.push({ id: 'economics', label: '경제 일정·발표 자료 전체 확인', available: economics.ok && economics.value.warnings.length === 0 ? 1 : 0, total: 1, checkedAt });
  if (economics.ok) {
    warnings.push(...economics.value.warnings);
    for (const event of recentResults(economics.value.events, now)) {
      if (!event.result || event.kind === 'holiday') continue;
      const explanation = ECON_EXPLAIN[event.kind];
      candidates.push({ id: `economic:${event.key}`, kind: 'economic', market: event.kind === 'bok' || event.symbol && /(?:\.K[SQ]|^\d{6}$)/.test(event.symbol) ? 'kr' : 'us',
        title: event.title, summary: event.result.actual ? `${event.result.headline}${event.result.previous ? ` 이전 수치 ${event.result.previous}.` : ''}` : '공식 원문이 공개됐어요. 발표 수치는 아직 확인 중이에요.', meaning: event.result.meaning || explanation.why,
        path: [explanation.why, explanation.watch], watch: explanation.watch,
        limits: event.result.note || '확인된 발표 수치와 시장의 반응은 구분해서 살펴보세요.',
        sectors: [], sources: [{ label: event.result.actual ? '발표 수치 출처' : '공식 발표 원문', url: event.result.sourceUrl, at: event.at }],
        ...(event.symbol ? { relatedSymbols: [event.symbol] } : {}),
        status: event.result.actual ? 'released' : 'publication', priority: event.result.actual ? 50 : 20, asOf: event.at, fingerprint: JSON.stringify(event.result),
      });
    }
  } else warnings.push('경제 발표 수치를 갱신하지 못했어요.');
  news.forEach(result => { if (result.status === 'fulfilled' && result.value) candidates.push(result.value); });
  coverage.push({ id: 'market-news', label: '한국·미국 시장 기사 검색', available: news.filter(result => result.status === 'fulfilled').length, total: 2, checkedAt, selected: news.filter(result => result.status === 'fulfilled' && result.value).length });
  if (news.some(result => result.status === 'rejected')) warnings.push('일부 시장 기사 검색을 완료하지 못했어요.');
  return { candidates: candidates.map(withRelatedSymbols), coverage, warnings };
}
