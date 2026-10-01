import type { EconomicEvent } from './economicEvents';
export const SOURCES = {
  fed: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
  bls: 'https://www.bls.gov/schedule/news_release/bls.ics',
  bea: 'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics',
  bok: 'https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?menuNo=200755&mtgSe=A',
};
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const pad = (n: number) => String(n).padStart(2, '0');
export function zonedIso(date: string, time: string, zone = 'America/New_York') {
  const target = Date.parse(`${date}T${time}:00Z`);
  let value = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
    const get = (key: string) => parts.find(p => p.type === key)?.value;
    const represented = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
    value += target - represented;
  }
  return new Date(value).toISOString();
}
export function parseCalendarIcs(text: string, source: 'bls' | 'bea'): EconomicEvent[] {
  const out: EconomicEvent[] = [];
  for (const block of text.replace(/\r?\n[ \t]/g, '').split('BEGIN:VEVENT').slice(1)) {
    const title = block.match(/\nSUMMARY:(.+)/)?.[1]?.trim().replace(/\\,/g, ',') || '';
    const kind = /Consumer Price Index/.test(title) ? 'cpi' : /Employment Situation/.test(title) ? 'jobs' : /Personal Income and Outlays/.test(title) ? 'pce' : null;
    const dt = block.match(/DTSTART([^:]*):(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/);
    const period = title.match(new RegExp(`(${months.join('|')})\\s+(20\\d{2})`));
    if (!kind || !dt || !period) continue;
    const ref = `${period[2]}-${pad(months.indexOf(period[1]) + 1)}`;
    const date = `${dt[2]}-${dt[3]}-${dt[4]}`;
    const at = dt[8] ? `${date}T${dt[5]}:${dt[6]}:${dt[7]}Z` : zonedIso(date, `${dt[5]}:${dt[6]}`);
    out.push({ key: `${kind}:${ref}`, kind, period: ref, title: kind === 'cpi' ? '미국 소비자물가 CPI' : kind === 'jobs' ? '미국 고용보고서' : '미국 소비지출 물가 PCE', at, timeKnown: true, sourceUrl: source === 'bls' ? 'https://www.bls.gov/schedule/' : 'https://www.bea.gov/news/schedule' });
  }
  return out;
}
export function parseFedCalendar(html: string): EconomicEvent[] {
  const events: EconomicEvent[] = [];
  const panels = html.split(/(?=<div class="panel panel-default"><div class="panel-heading"><h4>)/);
  for (const panel of panels) {
    const year = panel.match(/>(20\d{2}) FOMC Meetings</)?.[1];
    if (!year) continue;
    const blocks = panel.split(/<div class="[^"]*row fomc-meeting"/).slice(1);
    for (const block of blocks) {
      const monthName = block.match(/fomc-meeting__month[^>]*>\s*<strong>([^<]+)/)?.[1]?.split('/').at(-1);
      const day = block.match(/fomc-meeting__date[^>]*>([\d\-*]+)/)?.[1]?.replaceAll('*','').split('-').at(-1);
      const month = months.findIndex(m => m === monthName || m.slice(0,3) === monthName) + 1;
      if (!month || !day) continue;
      const date = `${year}-${pad(month)}-${day.padStart(2,'0')}`;
      const statement = block.match(/href="(\/newsevents\/pressreleases\/monetary\d{8}a\.htm)"/)?.[1];
      events.push({ key: `fomc:${date}`, kind: 'fomc', title: '미국 FOMC 금리 결정', at: zonedIso(date, '14:00'), timeKnown: true, sourceUrl: SOURCES.fed,
        ...(statement ? { result: { headline: '연준의 금리 결정문이 공개됐어요.', sourceUrl: `https://www.federalreserve.gov${statement}`, note: '금리 수치와 향후 정책 설명은 공식 결정문에서 확인할 수 있어요.' } } : {}) });
    }
  }
  return events;
}
export function parseBokCalendar(html: string): EconomicEvent[] {
  const year = html.match(/option value="(20\d{2})" selected/)?.[1];
  if (!year) return [];
  const out: EconomicEvent[] = [];
  for (const row of html.match(/<tr[\s\S]*?<\/tr>/g) || []) {
    const day = row.match(/<th scope="row">(\d{2})월 (\d{2})일/);
    if (!day) continue;
    const date = `${year}-${day[1]}-${day[2]}`;
    const pdf = row.match(/href="([^"]+)" title="국문보도자료[^"\n]*\.pdf"/);
    out.push({ key: `bok:${date}`, kind: 'bok', title: '한국은행 기준금리 결정', at: `${date}T00:00:00+09:00`, timeKnown: false, sourceUrl: SOURCES.bok,
      ...(pdf ? { result: { headline: '한국은행의 기준금리 결정문이 공개됐어요.', sourceUrl: `https://www.bok.or.kr${pdf[1].replaceAll('&amp;','&')}`, note: '기준금리와 결정 이유는 한국은행 원문에서 확인할 수 있어요.' } } : {}) });
  }
  return out;
}
export function parseFredHistory(csv: string, series: string): Map<string, number> {
  const lines = csv.trim().split(/\r?\n/);
  const col = lines[0].split(',').indexOf(series);
  const out = new Map<string, number>();
  if (col < 1) return out;
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cells[0]) || !cells[col]?.trim() || cells[col] === '.') continue;
    const value = Number(cells[col]);
    if (Number.isFinite(value)) out.set(cells[0], value);
  }
  return out;
}
