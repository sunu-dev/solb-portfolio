import { ARRIVAL_PATTERNS, type ArrivalGroup } from '@/config/arrivalPatterns';
import { getArrivalMessage, type ArrivalMessage } from './arrivalMessage';

export interface ArrivalWeather {
  city: string; label: string; group: ArrivalGroup; validUntil: number;
  issuedAt: number; temperature: number; sourceUrl: string;
}
export interface ArrivalVisit { key: string; id: string; at: number }
export interface ArrivalHistory { version: 1; seen: string[]; visit?: ArrivalVisit }
export const EMPTY_ARRIVAL_HISTORY: ArrivalHistory = { version: 1, seen: [] };
const MAX_AGE = 30 * 60_000;
const WEATHER_GROUPS = new Set(['clear','cloud','rain','snow','hot','cold','mild','wind']);
export function arrivalContext(now: Date, weather?: ArrivalWeather) {
  const base = getArrivalMessage(now);
  const kst = new Date(now.getTime() + 9 * 3600000);
  const hour = kst.getUTCHours(), month = kst.getUTCMonth() + 1;
  const market: ArrivalGroup = base.restful ? 'rest' : base.context.includes('거래 중') ? 'live'
    : base.context.includes('개장 전') ? 'pre' : base.context.includes('마감 후') ? 'closed' : 'neutral';
  const season: ArrivalGroup = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
  const time: ArrivalGroup = hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : hour >= 18 && hour < 22 ? 'evening' : 'night';
  const validWeather = weather && typeof weather.city === 'string' && typeof weather.label === 'string' && weather.sourceUrl === 'https://www.weather.go.kr/plus/rss.jsp' && WEATHER_GROUPS.has(weather.group) && weather.issuedAt <= now.getTime()
    && now.getTime() - weather.issuedAt <= 12 * 3600_000 && weather.validUntil > now.getTime()
    && Number.isFinite(weather.temperature) && weather.temperature >= -60 && weather.temperature <= 60;
  const groups: ArrivalGroup[] = [market, season, time];
  if (validWeather) groups.push(weather.group);
  return { base, groups, key: `${kst.toISOString().slice(0,10)}:${base.context}:${time}`, weather: validWeather ? weather : undefined };
}
export function parseArrivalHistory(raw: string | null): ArrivalHistory {
  try {
    const data = JSON.parse(raw ?? 'null');
    if (data?.version !== 1 || !Array.isArray(data.seen)) return EMPTY_ARRIVAL_HISTORY;
    const known = new Set(ARRIVAL_PATTERNS.map(p => p.id));
    const seen = [...new Set<string>(data.seen.filter((id: unknown) => typeof id === 'string' && known.has(id)))].slice(-200);
    const visit = data.visit && known.has(data.visit.id) && typeof data.visit.key === 'string' && Number.isFinite(data.visit.at) ? data.visit : undefined;
    return { version: 1, seen, visit };
  } catch { return EMPTY_ARRIVAL_HISTORY; }
}
export function selectArrival(now: Date, history: ArrivalHistory, random = Math.random(), weather?: ArrivalWeather): { message: ArrivalMessage; history: ArrivalHistory } {
  const context = arrivalContext(now, weather);
  const pool = ARRIVAL_PATTERNS.filter(p => context.groups.includes(p.group));
  const age = history.visit ? now.getTime() - history.visit.at : Infinity;
  const retained = history.visit?.key === context.key && age >= 0 && age < MAX_AGE ? pool.find(p => p.id === history.visit?.id) : undefined;
  let selected = retained;
  if (!selected) {
    const unseen = pool.filter(p => !history.seen.includes(p.id));
    // Exhaust eligible unseen messages before reusing the least recently seen one.
    const candidates = unseen.length ? unseen : [...pool].sort((a,b) => history.seen.indexOf(a.id) - history.seen.indexOf(b.id)).slice(0,1);
    selected = candidates[Math.min(candidates.length-1, Math.max(0, Math.floor((Number.isFinite(random) ? random : 0) * candidates.length)))];
  }
  const isWeather = WEATHER_GROUPS.has(selected.group);
  return {
    message: { ...context.base, text: selected.text, context: isWeather && context.weather ? `기상청 · ${context.weather.city} · ${context.weather.label} · ${context.weather.temperature}°C 예보` : context.base.context },
    history: retained ? history : { version: 1, seen: [...history.seen.filter(id => id !== selected.id), selected.id].slice(-200), visit: { key: context.key, id: selected.id, at: now.getTime() } },
  };
}
