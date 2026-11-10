import { describe,it,expect } from 'vitest';
import { ARRIVAL_CITIES } from '@/config/arrivalCities';
import { parseArrivalForecast } from '@/lib/arrivalWeather';
const city=ARRIVAL_CITIES[0];
const xml=(day=0,hour=22,temp=17,pty=0)=>`<category>${city.area}</category><tm>202610182000</tm><data seq="0"><day>${day}</day><hour>${hour}</hour><temp>${temp}</temp><sky>4</sky><pty>${pty}</pty><ws>1.9</ws></data>`;
const now=Date.parse('2026-10-18T21:00:00+09:00');
describe('KMA arrival forecasts',()=>{
 it('uses a fresh, named-area forecast with attribution',()=>{expect(parseArrivalForecast(xml(),city,now)).toMatchObject({city:city.area,group:'cloud',temperature:17,label:'22시 흐림'});});
 it('prioritizes precipitation over temperature',()=>{expect(parseArrivalForecast(xml(0,22,-2,3),city,now)?.group).toBe('snow');});
 it('accepts midnight and next-day forecasts',()=>{const late=Date.parse('2026-10-18T23:30:00+09:00');expect(parseArrivalForecast(xml(0,24),city,late)).not.toBeNull();expect(parseArrivalForecast(xml(1,1),city,late)).not.toBeNull();});
 it('rejects stale, future, wrong-region, missing and sentinel data',()=>{expect(parseArrivalForecast(xml(),city,now+86400000)).toBeNull();expect(parseArrivalForecast(xml(),city,now-7200000)).toBeNull();expect(parseArrivalForecast(xml().replace(city.area,'다른 지역'),city,now)).toBeNull();expect(parseArrivalForecast(xml(0,22,-999),city,now)).toBeNull();expect(parseArrivalForecast(xml().replace('<temp>17</temp>',''),city,now)).toBeNull();});
});
