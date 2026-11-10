import { ARRIVAL_CITIES } from '@/config/arrivalCities';
import { parseArrivalForecast } from '@/lib/arrivalWeather';

export async function GET(request: Request) {
  const city = ARRIVAL_CITIES.find(item => item.id === new URL(request.url).searchParams.get('city'));
  if (!city) return Response.json({error:'지원하지 않는 지역이에요.'},{status:400});
  try {
    const response = await fetch(`https://www.weather.go.kr/w/rss/dfs/hr1-forecast.do?zone=${city.zone}`, {signal:AbortSignal.timeout(4000),next:{revalidate:1800}});
    if (!response.ok) throw new Error('Forecast unavailable');
    const weather = parseArrivalForecast(await response.text(), city);
    if (!weather) throw new Error('No fresh forecast');
    return Response.json(weather,{headers:{'Cache-Control':'public, max-age=300, s-maxage=300'}});
  } catch {
    return Response.json({error:'새 예보를 확인하지 못했어요.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
