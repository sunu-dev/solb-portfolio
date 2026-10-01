import { describe, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
import { parseCalendarIcs, parseFredHistory, parseFedCalendar, parseBokCalendar, zonedIso } from '@/lib/economicSources';
import { attachEconomicResult } from '@/lib/economicFeed';
import { eventState, kstDay, unseenResults, type EconomicEvent } from '@/lib/economicEvents';
import { toEarningsEvent } from '@/lib/earningsEvents';

const now = Date.parse('2026-09-19T12:00:00+09:00');
const cpi: EconomicEvent = { key:'cpi:2026-08', kind:'cpi', title:'CPI', at:'2026-09-11T12:30:00Z', period:'2026-08', timeKnown:true, sourceUrl:'https://www.bls.gov/schedule/' };

describe('economic calendar and verified results', () => {
  it('converts the same US release hour across daylight saving time', () => {
    expect(zonedIso('2026-09-16','14:00')).toBe('2026-09-16T18:00:00.000Z');
    expect(zonedIso('2026-12-09','14:00')).toBe('2026-12-09T19:00:00.000Z');
    expect(kstDay(zonedIso('2026-09-16','14:00'))).toBe('2026-09-17');
  });
  it('unfolds official ICS lines and binds the observation month, not release month', () => {
    const events = parseCalendarIcs('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE-TIME:20260930T123000Z\r\nSUMMARY:Personal Income and Outlays\\, August\r\n  2026\r\nEND:VEVENT\r\nEND:VCALENDAR','bea');
    expect(events[0]).toMatchObject({key:'pce:2026-08',period:'2026-08',at:'2026-09-30T12:30:00Z'});
  });
  it('treats a past date as pending until actual reference-period data exists', () => {
    expect(eventState(cpi,now)).toBe('pending');
    expect(attachEconomicResult(cpi,{CPIAUCNS:new Map([['2026-07-01',300],['2025-07-01',290]])},now).result).toBeUndefined();
  });
  it('never assigns a known historical observation to an unreleased future event', () => {
    const future = {...cpi, at:'2026-10-14T12:30:00Z', result:{headline:'stale',sourceUrl:cpi.sourceUrl}};
    expect(attachEconomicResult(future,{},now).result).toBeUndefined();
  });
  it('calculates YoY and labels comparison without fabricating a consensus estimate', () => {
    const event = attachEconomicResult(cpi,{CPIAUCNS:new Map([['2026-08-01',303],['2025-08-01',300],['2026-07-01',302],['2025-07-01',300]])},now);
    expect(event.result).toMatchObject({actual:'1.0%',previous:'0.7%'});
    expect(event.result?.forecast).toBeUndefined();
  });
  it('keeps missing FRED values separate from a real zero', () => {
    expect([...parseFredHistory('observation_date,RATE\n2026-01-01,.\n2026-01-02,\n2026-01-03,0','RATE')]).toEqual([['2026-01-03',0]]);
  });
  it('requires a published FOMC statement rather than only elapsed time', () => {
    const html='<div class="panel panel-default"><div class="panel-heading"><h4><a>2026 FOMC Meetings</a></h4></div><div class="row fomc-meeting"><div class="fomc-meeting__month"><strong>September</strong></div><div class="fomc-meeting__date">15-16*</div></div>';
    expect(parseFedCalendar(html)[0]?.result).toBeUndefined();
    const published=html.replace('</div></div>','<a href="/newsevents/pressreleases/monetary20260916a.htm">Statement</a></div></div>');
    expect(parseFedCalendar(published)[0]?.result?.sourceUrl).toContain('monetary20260916a.htm');
  });
  it('only marks a BOK result after a decision document is present', () => {
    const prefix='<option value="2026" selected="selected">';
    const row='<tr><th scope="row">08월 27일(목)</th><td>준비중</td></tr>';
    expect(parseBokCalendar(prefix+row)[0]?.result).toBeUndefined();
  });
  it('accepts zero EPS and never treats an estimate alone as a result', () => {
    expect(toEarningsEvent({symbol:'AAPL',date:'2026-09-16',epsActual:0,epsEstimate:1})?.result?.actual).toBe('$0.00');
    expect(toEarningsEvent({symbol:'AAPL',date:'2026-09-16',epsActual:null,epsEstimate:1})?.result).toBeUndefined();
  });
  it('does not repeat seen results and excludes stale results from popups', () => {
    const released={...cpi,at:'2026-09-17T18:00:00Z',result:{headline:'confirmed',sourceUrl:cpi.sourceUrl}};
    expect(unseenResults([released],[],now)).toHaveLength(1);
    expect(unseenResults([released],[released.key],now)).toHaveLength(0);
    expect(unseenResults([{...released,at:'2026-08-01T12:00:00Z'}],[],now)).toHaveLength(0);
  });
});
