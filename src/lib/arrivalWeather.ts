import { ARRIVAL_CITIES } from '@/config/arrivalCities';
import type { ArrivalWeather } from '@/utils/arrivalSelection';

export function parseArrivalForecast(xml: string, city: typeof ARRIVAL_CITIES[number], now = Date.now()): ArrivalWeather | null {
  if (xml.length > 200_000) return null;
  const tag = (body: string, name: string) => body.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1];
  if (tag(xml, 'category') !== city.area) return null;
  const tm = tag(xml, 'tm');
  if (!tm || !/^\d{12}$/.test(tm)) return null;
  const issuedAt = Date.parse(`${tm.slice(0,4)}-${tm.slice(4,6)}-${tm.slice(6,8)}T${tm.slice(8,10)}:${tm.slice(10,12)}:00+09:00`);
  if (!Number.isFinite(issuedAt) || issuedAt > now || now-issuedAt > 12*3600000) return null;
  const midnight = Date.parse(`${tm.slice(0,4)}-${tm.slice(4,6)}-${tm.slice(6,8)}T00:00:00+09:00`);
  for (const match of xml.matchAll(/<data\b[^>]*>([\s\S]*?)<\/data>/g)) {
    const body = match[1];
    const number = (name: string) => { const value = tag(body, name); return value === undefined || !value.trim() ? NaN : Number(value); };
    const day=number('day'), hour=number('hour'), temperature=number('temp'), sky=number('sky'), pty=number('pty'), wind=number('ws');
    if (![day,hour,temperature,sky,pty,wind].every(Number.isFinite) || ![0,1,2].includes(day) || hour<1 || hour>24 || temperature < -60 || temperature > 60 || ![1,3,4].includes(sky) || ![0,1,2,3,4].includes(pty) || wind<0) continue;
    const forecastAt=midnight+(day*24+hour)*3600000;
    if (forecastAt < now || forecastAt-now > 3*3600000) continue;
    const group = pty===2 || pty===3 ? 'snow' : pty ? 'rain' : temperature>=30 ? 'hot' : temperature<=0 ? 'cold' : wind>=8 ? 'wind' : sky===1 ? (temperature>=15 && temperature<=25 ? 'mild' : 'clear') : 'cloud';
    const label = `${hour === 24 ? '다음 날 0' : hour}시 ${pty===2?'비·눈':pty===3?'눈':pty?'비':sky===1?'맑음':'흐림'}`;
    return {city:city.area,label,group,temperature,issuedAt,validUntil:forecastAt+3600000,sourceUrl:'https://www.weather.go.kr/plus/rss.jsp'};
  }
  return null;
}
