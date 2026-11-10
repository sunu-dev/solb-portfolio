import { describe, expect, it } from 'vitest';
import { ARRIVAL_PATTERNS } from '@/config/arrivalPatterns';
import { arrivalContext, EMPTY_ARRIVAL_HISTORY, parseArrivalHistory, selectArrival, type ArrivalWeather } from '@/utils/arrivalSelection';
const sunday = new Date('2026-10-18T03:00:00Z');
describe('edited arrival library and repeat protection', () => {
  it('has 200 distinct messages with stable distinct IDs', () => {
    expect(ARRIVAL_PATTERNS).toHaveLength(200);
    expect(new Set(ARRIVAL_PATTERNS.map(p=>p.id)).size).toBe(200);
    expect(new Set(ARRIVAL_PATTERNS.map(p=>p.text)).size).toBe(200);
  });
  it('keeps startup and home identical during a visit, including reloads', () => {
    const first=selectArrival(sunday,EMPTY_ARRIVAL_HISTORY,.4);
    expect(selectArrival(new Date(+sunday+60_000),first.history,.9).message).toEqual(first.message);
  });
  it('does not repeat eligible copy until it has exhausted the matching pool', () => {
    let history=EMPTY_ARRIVAL_HISTORY;
    const pool=ARRIVAL_PATTERNS.filter(p=>arrivalContext(sunday).groups.includes(p.group));
    const seen=new Set<string>();
    for(let i=0;i<pool.length;i++) {
      const result=selectArrival(sunday,{...history,visit:undefined},.5);
      expect(seen.has(result.history.visit!.id)).toBe(false);
      seen.add(result.history.visit!.id);history=result.history;
    }
    const next=selectArrival(sunday,{...history,visit:undefined},.5);
    expect(next.history.visit!.id).toBe([...seen][0]);
  });
  it('changes on a new visit after 30 minutes and retains only bounded history', () => {
    const a=selectArrival(sunday,EMPTY_ARRIVAL_HISTORY,0);
    const b=selectArrival(new Date(+sunday+31*60_000),a.history,0);
    expect(a.message.text).not.toBe(b.message.text);
    expect(b.history.seen.length).toBeLessThanOrEqual(200);
  });
  it('never uses weather copy without a fresh valid forecast', () => {
    const weather:ArrivalWeather={city:'서울',label:'비',group:'rain',issuedAt:+sunday-3600_000,validUntil:+sunday+3600_000,temperature:17,sourceUrl:'https://www.weather.go.kr/plus/rss.jsp'};
    expect(arrivalContext(sunday).groups).not.toContain('rain');
    expect(arrivalContext(sunday,weather).groups).toContain('rain');
    expect(arrivalContext(sunday,{...weather,validUntil:+sunday-1}).groups).not.toContain('rain');
    expect(arrivalContext(sunday,{...weather,issuedAt:+sunday+1}).groups).not.toContain('rain');
  });
  it('does not reuse a rest message after a real market opens', () => {
    const a=selectArrival(sunday,EMPTY_ARRIVAL_HISTORY,0);
    const next=selectArrival(new Date('2026-10-19T01:00:00Z'),a.history,0);
    expect(next.message.restful).toBe(false);
    expect(next.history.visit?.id.startsWith('rest')).toBe(false);
  });
  it('rejects malformed history and unknown IDs', () => {
    expect(parseArrivalHistory('{bad')).toEqual(EMPTY_ARRIVAL_HISTORY);
    expect(parseArrivalHistory('{"version":1,"seen":["evil",null,5,"rest-01"]}').seen).toEqual(['rest-01']);
  });
});
