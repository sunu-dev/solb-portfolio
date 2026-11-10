import { CIRCUIT_RULE_URL, type WatchTarget } from '@/config/marketWatch';
import type { WatchCandidate, WatchEvent, WatchSource } from './marketWatch';
import { buildYahooQuote } from '@/utils/yahooQuote';

const DAY = 86400000;
export interface RssItem { title: string; url: string; at: string; publisher: string; category: string }
function decodeXml(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[\da-f]+|\d+);/gi, entity => {
      const known: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
      if (known[entity]) return known[entity];
      const number = entity.startsWith('&#x') ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
      return Number.isFinite(number) && number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '';
    }).trim();
}
export function parseWatchRss(xml: string, now: number): RssItem[] {
  if (!/<rss[\s>]/i.test(xml) || !/<channel[\s>]/i.test(xml) || !/<\/rss>/i.test(xml)) throw new Error('Invalid RSS response');
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].flatMap(([, item]) => {
    const tag = (name: string) => decodeXml(item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '');
    const title = tag('title');
    const url = tag('link');
    const time = Date.parse(tag('pubDate'));
    if (!title || title.length > 1000 || !/^https?:\/\//.test(url) || !Number.isFinite(time) || time > now + 60000) return [];
    return [{ title, url, at: new Date(time).toISOString(), publisher: tag('author') || tag('source'), category: tag('category') }];
  });
}

export const watchDay = (at: number | string, market: 'kr' | 'us' | 'global') => new Intl.DateTimeFormat('en-CA', {
  timeZone: market === 'kr' ? 'Asia/Seoul' : 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(at));

/** Titles from the exchange itself, exact market author/category, and receipt-specific URLs only. */
export function krxWatchEvents(items: RssItem[], now: number): WatchCandidate[] {
  const groups = new Map<string, { items: RssItem[]; marketName: string; kind: 'circuit-breaker' | 'sidecar' }>();
  for (const item of items) {
    if (item.category !== '시장조치' || !['유가증권시장', '코스닥시장'].includes(item.publisher)
      || now - Date.parse(item.at) > 2 * DAY) continue;
    const url = new URL(item.url);
    const receipt = url.searchParams.get('acptNo');
    if (url.hostname !== 'kind.krx.co.kr' || url.pathname !== '/common/disclsviewer.do' || !/^\d{14}$/.test(receipt ?? '')) continue;
    // A result from an earlier session must not be relabelled as today's event.
    if (receipt!.slice(0, 8) !== watchDay(item.at, 'kr').replaceAll('-', '')) continue;
    const circuit = /(?:CB|서킷\s*브레이커)\s*(?:발동|해제)|(?:CB|서킷\s*브레이커)/i.test(item.title);
    const sidecar = /사이드\s*카|Side\s*car/i.test(item.title);
    if ((!circuit && !sidecar) || /미발동|발동\s*(?:예정|가능|조건|요건|임박)|제도\s*안내/.test(item.title)) continue;
    if (!/발동|해제|재개|종료/.test(item.title)) continue;
    const kind = circuit ? 'circuit-breaker' : 'sidecar';
    const marketName = item.publisher === '유가증권시장' ? '코스피' : '코스닥';
    const id = `krx:${marketName}:${kind}:${watchDay(item.at, 'kr')}`;
    const group = groups.get(id) ?? { items: [], marketName, kind };
    group.items.push({ ...item, url: `https://kind.krx.co.kr/common/disclsviewer.do?method=searchInitInfo&acptNo=${receipt}` });
    groups.set(id, group);
  }
  return [...groups].map(([id, group]) => {
    const notices = group.items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.url.localeCompare(b.url));
    const last = notices.at(-1)!;
    const resumed = /해제|재개/.test(last.title);
    const closed = /3단계|당일.*종료/.test(last.title) && !resumed;
    const stage = last.title.match(/([123])단계/)?.[1];
    const circuit = group.kind === 'circuit-breaker';
    const label = circuit ? '서킷브레이커' : '사이드카';
    const state = resumed ? '해제 공시' : closed ? '당일 거래 종료 공시' : '발동 공시';
    return {
      id, kind: group.kind, market: 'kr', title: `${group.marketName} ${stage ? `${stage}단계 ` : ''}${label} ${state}`,
      summary: `한국거래소가 ${resumed ? '조치 해제와 거래 재개' : closed ? '당일 거래 종료' : circuit ? '해당 시장의 거래 일시 중단' : '프로그램매매 주문의 일시 제한'}를 공시했어요. 표시한 시각은 공시 시각이며 실제 조치 시각과 다를 수 있어요.`,
      meaning: circuit ? '시장이 급격히 하락할 때 해당 시장의 거래를 멈추는 장치예요. 국내 1단계는 지수가 전일 종가보다 8% 이상 하락한 상태가 1분간 이어지면 발동하며, 20분간 거래를 중단해요. 실제 적용 단계와 후속 조치는 공시에서 확인해야 해요.'
        : '선물시장이 크게 움직일 때 프로그램매매 주문의 효력을 5분간 제한하는 장치예요. 시장 전체의 거래 중단과는 달라요.',
      path: circuit ? ['거래소의 시장 전체 거래 중단 조치', '단계에 따른 거래 중단 또는 종료', '거래소의 후속 재개 공시 확인']
        : ['선물시장의 급격한 변화', '프로그램매매 주문 효력의 일시 제한', '해제 여부와 현물시장 움직임 확인'],
      watch: resumed ? '해제 공시가 나왔어도 주가 회복을 뜻하지 않아요. 이후 공시와 실제 체결 상태를 함께 확인해보세요.'
        : '적용 시장과 단계를 확인하고, 이후 해제·재개 공시를 살펴보세요. 정해진 시간이 지났다는 이유만으로 거래가 재개됐다고 표시하지 않아요.',
      limits: '거래소 RSS는 실시간 공시와 시차가 있을 수 있어요. 마지막 확인 공시를 보여주며, 가격 하락 원인이나 다음 주가 방향을 뜻하지 않아요.',
      sectors: [], status: resumed ? 'resumed' : closed ? 'closed' : circuit ? 'halted' : 'observed', priority: circuit ? 100 : 85,
      sources: [...notices.map(item => ({ label: '한국거래소 KIND · 공시 원문', url: item.url, at: item.at, title: item.title })),
        { label: '제도 설명 · 생활법령정보', url: CIRCUIT_RULE_URL, at: last.at }],
      asOf: last.at, fingerprint: notices.map(item => item.url).join('|'),
    } satisfies WatchCandidate;
  });
}

export interface WatchChart {
  meta?: { symbol?: string; regularMarketPrice?: number; regularMarketTime?: number; previousClose?: number };
  timestamp?: number[];
  indicators?: { quote?: Array<{ close?: Array<number | null> }> };
}
export function quoteWatchEvent(target: WatchTarget, chart: WatchChart, now: number): WatchCandidate | null {
  const quote = buildYahooQuote(chart, true);
  if (!quote || quote.dp === null || quote.pc === null || !quote.t || quote.t * 1000 > now + 60000
    || now - quote.t * 1000 > 7 * DAY) return null;
  const asOf = new Date(quote.t * 1000).toISOString();
  const date = watchDay(asOf, target.market);
  const closes = chart.indicators?.quote?.[0]?.close ?? [];
  const returns: number[] = [];
  for (let i = Math.max(1, closes.length - 32); i < closes.length; i++) {
    const before = closes[i - 1]; const current = closes[i]; const stamp = chart.timestamp?.[i];
    if (!stamp || watchDay(stamp * 1000, target.market) >= date || typeof before !== 'number' || !Number.isFinite(before)
      || before <= 0 || typeof current !== 'number' || !Number.isFinite(current) || current <= 0) continue;
    returns.push((current / before - 1) * 100);
  }
  const average = returns.reduce((sum, value) => sum + value, 0) / Math.max(1, returns.length);
  const std = Math.sqrt(returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, returns.length));
  const z = returns.length >= 20 && std > 0 ? Math.abs((quote.dp - average) / std) : null;
  const delta = Number((quote.c - quote.pc).toFixed(6));
  const notable = target.kind === 'yield' ? Math.abs(delta) >= target.threshold
    : Math.abs(quote.dp) >= target.threshold || (z !== null && z >= 2 && Math.abs(quote.dp) >= 0.5);
  const number = target.kind === 'yield' ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%포인트`
    : `${quote.dp >= 0 ? '+' : ''}${quote.dp.toFixed(2)}%`;
  const current = target.kind === 'yield' ? `, 금리 수준 ${quote.c.toFixed(2)}%` : '';
  return {
    id: `quote:${target.symbol}`, kind: 'move', market: target.market, sectors: target.sectors,
    title: `${target.label} ${number}`,
    summary: `${date} 거래 자료의 전일 종가 대비 변화예요${current}. ${notable ? '관찰 기준에 해당하는 움직임이 확인됐어요.' : '현재 변화는 큰 움직임 관찰 기준보다 작아요.'}`,
    meaning: target.meaning, path: target.path, watch: target.watch,
    limits: `${target.kind === 'sector' ? '미국 ETF의 관찰 결과이며 한국 업종이나 전 세계 산업 전체의 수익률이 아니에요. ' : ''}시세는 지연될 수 있어요. 가격 변화만으로 원인을 단정하지 않아요.${target.kind !== 'yield' && returns.length < 20 ? ' 과거 자료가 부족해 고정된 등락 기준으로 관찰했어요.' : ''}`,
    sources: [{ label: 'Yahoo Finance · 시세 기준', url: `https://finance.yahoo.com/quote/${encodeURIComponent(target.symbol)}/`, at: asOf }],
    status: 'observed', priority: notable ? Math.min(70, 25 + Math.abs(quote.dp) * 4 + (target.kind === 'index' ? 10 : 0)) : 0,
    asOf, fingerprint: `${date}:${notable}:${Math.round((target.kind === 'yield' ? delta * 10 : quote.dp) * 2)}`,
    measure: { symbol: target.symbol, change: target.kind === 'yield' ? delta : quote.dp, unit: target.kind === 'yield' ? '%포인트' : '%', date },
  };
}

/** Compare the same US session only. ETF dispersion is not proof of fund flows. */
export function sectorRotationEvent(candidates: WatchCandidate[]): WatchCandidate | null {
  const broad = new Set(['XLK', 'XLC', 'XLY', 'XLP', 'XLE', 'XLF', 'XLV', 'XLI', 'XLB', 'XLRE', 'XLU']);
  const sectors = candidates.filter(event => event.measure && broad.has(event.measure.symbol));
  const latest = sectors.map(event => event.measure!.date).sort().at(-1);
  const comparable = sectors.filter(event => event.measure!.date === latest).sort((a, b) => b.measure!.change - a.measure!.change);
  if (comparable.length < 8) return null;
  const first = comparable[0]; const last = comparable.at(-1)!;
  const spread = first.measure!.change - last.measure!.change;
  if (spread < 2) return null;
  return {
    id: 'rotation:us', kind: 'move', market: 'us', title: '미국 업종별 움직임에 차이가 있어요',
    summary: `${latest}의 같은 거래일 자료 ${comparable.length}개 중 ${first.title}, ${last.title}로 등락률 차이가 ${spread.toFixed(2)}%포인트예요.`,
    meaning: '같은 시장에서도 업종마다 움직임이 다를 수 있어요. 시장 지수 한 개로는 보이지 않는 차이를 비교한 결과예요.',
    path: ['같은 거래일의 미국 업종 ETF 비교', '상대적으로 강한 업종과 약한 업종 확인', '기업별 실적·비용·수요 자료 비교'],
    watch: '덜 하락한 업종도 강한 쪽으로 표시될 수 있어요. 업종 간 자금이 실제로 이동했는지는 거래·자금 자료가 더 필요해요.',
    limits: `미국 주요 업종 ETF 11개 중 ${comparable.length}개를 비교했어요. 세계 모든 산업이나 한국 업종의 순위가 아니며, 자금 유입·유출을 확인한 결과도 아니에요.`,
    sectors: [...new Set([...first.sectors, ...last.sectors])], sources: [...first.sources, ...last.sources],
    status: 'observed', priority: 40, asOf: first.asOf,
    fingerprint: `${latest}:${first.id}:${last.id}:${Math.round(spread)}`,
  };
}

/** Seed official notice history too: a first scan may already contain both the halt and its release. */
export function noticeHistory(candidate: WatchCandidate): WatchEvent['history'] {
  return candidate.sources.filter(source => source.title).map((source: WatchSource) => {
    const resumed = /재개|해제/.test(source.title!); const closed = /3단계/.test(source.title!);
    const market = /코스닥/.test(source.title!) ? '코스닥' : '코스피';
    const circuit = candidate.kind === 'circuit-breaker';
    return { at: source.at, asOf: source.at,
      title: `${market} ${resumed ? '거래 재개 공시' : closed ? '당일 거래 종료 공시' : circuit ? '거래 일시 중단 공시' : '프로그램매매 일시 제한 공시'}`,
      summary: circuit ? resumed ? '서킷브레이커 해제를 알렸어요.' : closed ? '3단계 서킷브레이커 발동을 알렸어요.' : '서킷브레이커 발동을 알렸어요.' : '사이드카 조치를 알렸어요.',
      status: resumed ? 'resumed' as const : closed ? 'closed' as const : circuit ? 'halted' as const : 'observed' as const,
    };
  });
}
