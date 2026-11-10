'use client';
import { ARRIVAL_PATTERNS } from '@/config/arrivalPatterns';
import { useSyncExternalStore } from 'react';
import { getArrivalMessage } from '@/utils/arrivalMessage';
import { arrivalContext, EMPTY_ARRIVAL_HISTORY, parseArrivalHistory, selectArrival, type ArrivalHistory, type ArrivalWeather } from '@/utils/arrivalSelection';

let weatherRequest = 0;
export async function refreshArrivalWeather(city?: string) {
  const request = ++weatherRequest;
  try {
    const selected = city ?? localStorage.getItem('joobi-arrival-city-v1');
    if (!selected) { refresh(); return false; }
    const response = await fetch(`/api/arrival-weather?city=${encodeURIComponent(selected)}`, {signal:AbortSignal.timeout(5000)});
    if (!response.ok) return false;
    const weather = await response.json();
    if (request !== weatherRequest || localStorage.getItem('joobi-arrival-city-v1') !== selected) return false;
    if (!arrivalContext(new Date(),weather).weather) return false;
    localStorage.setItem('joobi-arrival-weather-v1',JSON.stringify(weather));
    return true;
  } catch {return false;}
}
const KEY = 'joobi-arrival-history-v1';
const serverMessage = getArrivalMessage();
let snapshot = serverMessage;
let history: ArrivalHistory = EMPTY_ARRIVAL_HISTORY;
let currentKey = '';
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function readWeather(): ArrivalWeather | undefined {
  try { return JSON.parse(localStorage.getItem('joobi-arrival-weather-v1') ?? 'null') ?? undefined; } catch { return undefined; }
}
function refresh(first = false) {
  const now = new Date();
  const weather = readWeather();
  const context = arrivalContext(now, weather);
  if (!first && currentKey === context.key && ARRIVAL_PATTERNS.some(p => p.id === history.visit?.id && context.groups.includes(p.group))) return;
  if (first) {
    try { history = parseArrivalHistory(localStorage.getItem(KEY)); } catch { /* In-memory continuity remains available. */ }
  }
  const result = selectArrival(now, history, Math.random(), weather);
  snapshot = result.message; history = result.history; currentKey = context.key;
  try { localStorage.setItem(KEY, JSON.stringify(history)); } catch { /* Storage is optional. */ }
  listeners.forEach(listener => listener());
}
function onVisible() { if (document.visibilityState === 'visible') refresh(); }
function subscribe(listener: () => void) {
  const first = listeners.size === 0;
  listeners.add(listener);
  if (first) {
    refresh(true);
    void refreshArrivalWeather();
    timer = setInterval(() => refresh(), 60_000);
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); }
  };
}
export function useArrivalMessage() {
  return useSyncExternalStore(subscribe, () => snapshot, () => serverMessage);
}
