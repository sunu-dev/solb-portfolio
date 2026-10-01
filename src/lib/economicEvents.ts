export type EconomicKind = 'fomc' | 'cpi' | 'pce' | 'jobs' | 'bok' | 'earnings' | 'holiday';
export interface EconomicResult {
  headline: string;
  meaning?: string;
  actual?: string;
  previous?: string;
  forecast?: string;
  sourceUrl: string;
  note?: string;
}
export interface EconomicEvent {
  key: string;
  kind: EconomicKind;
  title: string;
  at: string;
  timeKnown: boolean;
  period?: string;
  symbol?: string;
  timingNote?: string;
  sourceUrl: string;
  result?: EconomicResult;
}
export interface EconomicFeed {
  events: EconomicEvent[];
  checkedAt: string;
  warnings: string[];
}
export const ECON_EXPLAIN: Record<EconomicKind, { why: string; watch: string }> = {
  fomc: { why: '미국의 기준금리는 기업이 돈을 빌리는 비용과 주식의 가치를 평가하는 기준에 영향을 줘요. 금리 결정과 앞으로의 정책 설명을 함께 봐야 해요.', watch: '미국 주식을 보유했다면 미국 국채금리와 달러 움직임을 함께 확인해보세요. 금리가 내려도 이미 예상된 결정이면 주가가 오르지 않을 수 있어요.' },
  cpi: { why: '소비자가 자주 사는 상품과 서비스의 가격이 얼마나 변했는지 보여줘요. 물가 흐름은 연준의 금리 판단과 기업의 비용에 영향을 줄 수 있어요.', watch: '물가 상승률이 낮아져도 물가 자체가 내려갔다는 뜻은 아니에요. 전년 대비와 전월 대비, 에너지·식품을 제외한 근원 물가를 구분해 보세요.' },
  pce: { why: '미국 소비지출의 가격 변화를 보여주는 지표예요. 연준이 물가 목표를 판단할 때 사용하는 지표라 금리 전망과 연결돼요.', watch: '일시적인 품목 변화와 지속적인 물가 흐름을 구분해야 해요. 성장주·금리 민감 자산은 발표 후 국채금리도 함께 확인해보세요.' },
  jobs: { why: '미국의 일자리와 실업률은 사람들이 얼마나 일하고 소비할 수 있는지 보여줘요. 기업 매출 전망과 연준의 금리 판단에 모두 관련돼요.', watch: '고용이 늘면 소비에는 도움이 될 수 있지만 금리 인하 기대는 약해질 수 있어요. 고용 증가만으로 주가 방향을 단정하지 마세요.' },
  bok: { why: '한국 기준금리는 국내 기업의 자금 조달 비용과 가계의 이자 부담에 영향을 줘요. 소비와 투자, 원화 움직임도 함께 살펴볼 부분이에요.', watch: '국내 주식은 업종별 차이가 커요. 금융회사와 차입이 많은 기업에 같은 영향을 준다고 볼 수 없어요.' },
  earnings: { why: '회사가 실제로 얼마나 벌었는지 확인하는 날이에요. 주당순이익뿐 아니라 매출과 앞으로의 사업 전망을 함께 봐야 해요.', watch: '예상치를 웃돌아도 향후 전망이 약하면 주가가 내려갈 수 있어요. 발표 수치와 회사가 설명한 다음 분기 전망을 구분하세요.' },
  holiday: { why: '시장이 쉬는 날에는 정규장 거래와 새로운 종가가 없어요.', watch: '휴장 중 보이는 가격은 최근 거래일의 가격일 수 있어요.' },
};
export function eventState(event: EconomicEvent, now = Date.now()): 'scheduled' | 'pending' | 'released' | 'closed' {
  if (event.kind === 'earnings' && event.result && !event.timeKnown) {
    const day = (at: string | number) => new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
    if (day(event.at) <= day(now)) return 'released';
  }
  if (new Date(event.at).getTime() > now) return 'scheduled';
  if (event.kind === 'holiday') return 'closed';
  return event.result ? 'released' : 'pending';
}
export function kstDay(at: string | number) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at)); }
export function eventTime(event: EconomicEvent) {
  if (event.timingNote) return event.timingNote;
  if (!event.timeKnown) return '시각 미정';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(event.at));
}
export function recentResults(events: EconomicEvent[], now = Date.now()) {
  return events.filter(e => eventState(e, now) === 'released' && now - Date.parse(e.at) < 7 * 86400000)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
export function unseenResults(events: EconomicEvent[], seen: string[], now = Date.now()) {
  return recentResults(events, now).filter(e => !seen.includes(e.key));
}
export function inUserPortfolio(event: EconomicEvent, symbols: string[]) {
  if (event.symbol) return symbols.includes(event.symbol);
  if (event.kind === 'bok') return symbols.some(s => /\.K[SQ]$|^\d{6}$/.test(s));
  return event.kind !== 'holiday' && symbols.some(s => !/\.K[SQ]$|^\d{6}$/.test(s));
}
