import { eunNeun } from '@/utils/koreanJosa';
export interface BriefQuote { symbol: string; label: string; day: string; at: string; change: number; unusual: boolean; }
export interface BriefSource { searched?: boolean; title: string; url: string; at: string; publisher: string; }
export interface DailyBrief { version?: number; searchEntry?: string|null; backgroundAttemptAt?: string; backgroundGeneratedAt?: string; symbol: string; checkedAt: string; quote: BriefQuote; comparisons: BriefQuote[]; summary: string; sources: BriefSource[]; background: string | null; watch: string | null; warnings: string[]; }
export const BRIEF_TARGETS = [
  ['MU','마이크론','SOXX'], ['NVDA','엔비디아','SOXX'], ['AMD','AMD','SOXX'], ['AVGO','브로드컴','SOXX'], ['INTC','인텔','SOXX'], ['TSM','TSMC','SOXX'],
  ['MSFT','마이크로소프트','XLK'], ['AAPL','애플','XLK'], ['ORCL','오라클','XLK'], ['PLTR','팔란티어','XLK'],
  ['GOOGL','알파벳','XLC'], ['META','메타','XLC'], ['TSLA','테슬라','XLY'], ['AMZN','아마존','XLY'],
  ['JPM','JP모건','XLF'], ['XOM','엑슨모빌','XLE'], ['LLY','일라이릴리','XLV'], ['WMT','월마트','XLP'],
] as const;
export const BRIEF_BENCHMARKS: Record<string,string> = { '^GSPC':'미국 S&P 500 지수', SOXX:'미국 반도체 ETF', XLK:'미국 기술 업종 ETF', XLC:'미국 통신·미디어 ETF', XLY:'미국 경기소비재 ETF', XLF:'미국 금융 업종 ETF', XLE:'미국 에너지 업종 ETF', XLV:'미국 헬스케어 업종 ETF', XLP:'미국 필수소비재 업종 ETF' };
export function marketDay(seconds: number) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(seconds*1000)); }
export function priceSummary(quote: BriefQuote, comparisons: BriefQuote[]) {
 const peers = comparisons.filter(q=>q.day===quote.day);
 const sector=peers.find(q=>q.symbol!=='^GSPC');
 const market=peers.find(q=>q.symbol==='^GSPC');
 const direction=quote.change>0?'상승':quote.change<0?'하락':'보합';
 let text=`${quote.label}${eunNeun(quote.label)} 전 거래일 대비 ${Math.abs(quote.change).toFixed(2)}% ${direction}했어요.`;
 if(sector) text+=` ${sector.label}는 ${sector.change>0?'+':''}${sector.change.toFixed(2)}%로, ${Math.sign(sector.change)===Math.sign(quote.change)?'같은 방향으로 움직였어요.':'종목과 움직임이 달랐어요.'}`;
 if(market) text+=` 시장 전체와의 등락 차이는 ${(quote.change-market.change).toFixed(2)}%포인트예요.`;
 if(quote.unusual) text+=' 최근 60개 거래일 중에서도 변동 폭이 큰 편이에요.';
 return text;
}
export function validBackground(value: unknown, sources: BriefSource[]): {background:string;watch:string}|null {
 if(!value || typeof value!=='object') return null;
 const x=value as Record<string,unknown>;
 if(typeof x.background!=='string'||x.background.length>600||typeof x.watch!=='string'||x.watch.length>300||!Array.isArray(x.evidence)||!x.evidence.length) return null;
 // Require exact evidence from supplied text; invented citations are never published.
 if(!x.evidence.every(e=> e && Number.isInteger(e.index) && typeof e.quote==='string' && e.quote.length>=8 && sources[e.index]?.title.includes(e.quote))) return null;
 return {background:x.background,watch:x.watch};
}

/** Daily US-close cron, with a two-hour execution/delivery grace period. */
export function isBriefDelayed(checkedAt:string, now=Date.now()) {
 const expected=new Date(now);expected.setUTCHours(23,10,0,0);
 if(expected.getTime()>now)expected.setUTCDate(expected.getUTCDate()-1);
 while(expected.getUTCDay()===0||expected.getUTCDay()===6)expected.setUTCDate(expected.getUTCDate()-1);
 return Date.parse(checkedAt)<expected.getTime()-2*3600000;
}


/** Incident 2026-11-04: search citations alone did not validate dates, returns or company facts.
 * Keep generated backgrounds off until factual evidence validation is implemented, not a prompt-only fix.
 */
export const DAILY_BRIEF_BACKGROUND_ENABLED: boolean = false;
export function publicDailyBrief(brief: DailyBrief): DailyBrief {
  const comparisons = brief.comparisons.filter(q => q.day === brief.quote.day);
  return { ...brief, comparisons, summary: priceSummary(brief.quote, comparisons),
    background: null, watch: null, searchEntry: null,
    warnings: [...new Set([...brief.warnings, '자동 배경 설명에서 자료와 맞지 않는 내용이 발견되어 표시를 중단했어요. 가격 비교와 원문 링크를 확인해 주세요.'])] };
}
