import { unstable_cache } from 'next/cache';
import snapshot from '@/data/economic-schedule.json';
import { MARKET_HOLIDAYS_2026 } from '@/config/marketHolidays';
import { SOURCES, parseBokCalendar, parseCalendarIcs, parseFedCalendar, parseFredHistory } from './economicSources';
import type { EconomicEvent, EconomicFeed, EconomicResult } from './economicEvents';

async function text(url: string) {
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`source unavailable (${r.status})`);
  return r.text();
}
const schedules = unstable_cache(async (source: keyof typeof SOURCES) => {
  const raw = await text(SOURCES[source]);
  const events = source === 'fed' ? parseFedCalendar(raw) : source === 'bok' ? parseBokCalendar(raw) : parseCalendarIcs(raw, source);
  if (!events.length) throw new Error('empty calendar');
  return events;
}, ['economic-schedules-v1'], { revalidate: 3600 });
const history = unstable_cache(async (series: string) => {
  const start = new Date(); start.setUTCFullYear(start.getUTCFullYear() - 2);
  const rows = parseFredHistory(await text(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}&cosd=${start.toISOString().slice(0,10)}`), series);
  if (!rows.size) throw new Error('empty observations');
  return [...rows];
}, ['economic-history-v1'], { revalidate: 900 });
const shiftMonth = (period: string, delta: number) => { const d = new Date(`${period}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + delta); return d.toISOString().slice(0,10); };
const pct = (n: number) => `${n.toFixed(1)}%`;
export function attachEconomicResult(event: EconomicEvent, series: Record<string, Map<string, number>>, now: number): EconomicEvent {
  if (Date.parse(event.at) > now) return { ...event, result: undefined };
  const period = event.period;
  let result: EconomicResult | undefined;
  if (['cpi','pce'].includes(event.kind) && period) {
    const id = event.kind === 'cpi' ? 'CPIAUCNS' : 'PCEPI';
    const values = series[id];
    const current = values?.get(`${period}-01`), yearAgo = values?.get(shiftMonth(period,-12));
    const previous = values?.get(shiftMonth(period,-1)), previousYear = values?.get(shiftMonth(period,-13));
    if (current !== undefined && yearAgo && current > 0) {
      const yoy = (current/yearAgo-1)*100;
      result = { headline: `${Number(period.slice(5))}월 ${event.kind === 'cpi' ? '소비자물가' : '소비지출 물가'}는 1년 전보다 ${pct(Math.abs(yoy))} ${yoy < 0 ? '하락' : '상승'}했어요.`, actual: pct(yoy),
        previous: previous !== undefined && previousYear ? pct((previous/previousYear-1)*100) : undefined,
        meaning: previous !== undefined && previousYear ? (Number(pct(yoy).slice(0,-1)) < Number(pct((previous/previousYear-1)*100).slice(0,-1)) ? '전월 발표 대상보다 물가 상승 속도가 낮아졌어요. 금리 부담이 완화될 가능성을 살펴볼 신호지만, 한 번의 수치만으로 금리 인하를 뜻하지는 않아요.' : Number(pct(yoy).slice(0,-1)) > Number(pct((previous/previousYear-1)*100).slice(0,-1)) ? '전월 발표 대상보다 물가 상승 속도가 높아졌어요. 금리가 높은 수준에 머물 가능성과 기업의 비용 부담을 함께 살펴볼 때예요.' : '전월 발표 대상과 같은 물가 상승률이에요. 물가가 안정됐는지는 여러 달의 흐름과 근원 지표까지 함께 봐야 해요.') : undefined,
        sourceUrl: `https://fred.stlouisfed.org/series/${id}`, note: '전년 동월 대비. 공식 시계열의 현재 확인값으로, 최초 발표 이후 수정치가 포함될 수 있어요.' };
    }
  } else if (event.kind === 'jobs' && period) {
    const rate = series.UNRATE?.get(`${period}-01`), prev = series.UNRATE?.get(shiftMonth(period,-1));
    const jobs = series.PAYEMS?.get(`${period}-01`), prevJobs = series.PAYEMS?.get(shiftMonth(period,-1));
    if (rate !== undefined) result = { headline: `${Number(period.slice(5))}월 미국 실업률은 ${pct(rate)}예요.`, actual: pct(rate), previous: prev === undefined ? undefined : pct(prev), sourceUrl: 'https://fred.stlouisfed.org/series/UNRATE',
      meaning: prev === undefined ? undefined : rate > prev ? '실업률이 이전 달보다 높아졌어요. 소비와 기업 매출이 약해질 가능성, 금리 전망의 변화를 함께 살펴보세요.' : rate < prev ? '실업률이 이전 달보다 낮아졌어요. 고용 상황에는 긍정적일 수 있지만, 금리 인하 기대와는 다르게 작용할 수 있어요.' : '실업률은 이전 달과 같아요. 취업자 수와 임금 변화를 함께 봐야 고용 흐름을 더 잘 이해할 수 있어요.',
      note: `실업률 기준. ${jobs !== undefined && prevJobs !== undefined ? `비농업 고용은 전월보다 ${Math.abs(Math.round((jobs-prevJobs)*1000)).toLocaleString('ko-KR')}명 ${jobs >= prevJobs ? '증가' : '감소'}했어요. ` : ''}공식 시계열의 수정치가 포함될 수 있어요.` };
  } else if (event.kind === 'fomc' && event.result) {
    const date = event.at.slice(0,10), next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate()+1);
    const effective = next.toISOString().slice(0,10);
    const lo = series.DFEDTARL?.get(effective), hi = series.DFEDTARU?.get(effective);
    const oldLo = series.DFEDTARL?.get(date), oldHi = series.DFEDTARU?.get(date);
    if (lo !== undefined && hi !== undefined && hi >= lo) result = { headline: `발표 다음 날 미국 목표금리는 ${lo.toFixed(2)}~${hi.toFixed(2)}%예요.`, actual: `${lo.toFixed(2)}~${hi.toFixed(2)}%`, previous: oldLo !== undefined && oldHi !== undefined ? `${oldLo.toFixed(2)}~${oldHi.toFixed(2)}%` : undefined,
      meaning: oldHi === undefined ? undefined : hi > oldHi ? '목표금리 상단이 발표일보다 높아졌어요. 기업의 자금 조달 비용과 성장주의 가치 평가에 부담이 될 수 있어요. 실제 주가 반응은 시장이 예상한 결정과의 차이에도 달려 있어요.' : hi < oldHi ? '목표금리 상단이 발표일보다 낮아졌어요. 기업의 이자 부담에는 도움이 될 수 있지만, 경기 둔화에 대응한 결정인지는 연준의 설명을 함께 봐야 해요.' : '목표금리는 발표일과 같아요. 동결 자체보다 앞으로 얼마나 오래 유지할지에 대한 연준의 설명이 중요해요.',
      sourceUrl: event.result.sourceUrl, note: '금리 수치는 FRED의 발표일·다음 날 목표금리 기준이에요. 점도표와 향후 정책 설명은 연준 결정문을 함께 확인해보세요.' };
  }
  return result ? { ...event, result } : event;
}
export async function getEconomicFeed(): Promise<EconomicFeed> {
  const warnings: string[] = [];
  const items = new Map((snapshot.events as EconomicEvent[]).map(e => [e.key, e]));
  const ids = ['DFEDTARL','DFEDTARU','CPIAUCNS','PCEPI','UNRATE','PAYEMS'];
  const [calendars, rows] = await Promise.all([
    Promise.allSettled((Object.keys(SOURCES) as (keyof typeof SOURCES)[]).map(key => schedules(key))),
    Promise.allSettled(ids.map(id => history(id))),
  ]);
  calendars.forEach((res, i) => {
    if (res.status === 'fulfilled') res.value.forEach(e => items.set(e.key,e));
    else warnings.push(`${['연준','미국 노동통계국','미국 경제분석국','한국은행'][i]} 일정: 마지막 확인 목록을 사용 중이에요.`);
  });
  const data: Record<string, Map<string, number>> = {};
  rows.forEach((res,i) => { if (res.status === 'fulfilled') data[ids[i]] = new Map(res.value); });
  if (rows.some(row => row.status === 'rejected')) warnings.push('일부 발표 수치를 확인하지 못했어요. 미확인 결과는 브리핑에 넣지 않아요.');
  const now = Date.now();
  const events = [...items.values()].filter(e => Date.parse(e.at) > now - 120 * 86400000).map(e => attachEconomicResult(e,data,now));
  for (const h of MARKET_HOLIDAYS_2026) events.push({ key: `holiday:${h.market}:${h.date}`, kind: 'holiday', title: `${h.market === 'US' ? '미국' : h.market === 'KR' ? '국내' : '국내·미국'} 휴장 · ${h.label}`, at: `${h.date}T00:00:00+09:00`, timeKnown: false, timingNote: '휴장', sourceUrl: h.market === 'US' ? 'https://www.nyse.com/markets/hours-calendars' : 'https://global.krx.co.kr/' });
  return { events: events.sort((a,b) => Date.parse(a.at)-Date.parse(b.at)), checkedAt: new Date(now).toISOString(), warnings };
}
