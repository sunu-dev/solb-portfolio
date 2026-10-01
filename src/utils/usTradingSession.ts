import { MARKET_HOLIDAYS_2026 } from '@/config/marketHolidays';

const EARLY_CLOSE = new Set(['2026-11-27', '2026-12-24']);
// NYSE 2026 core session calendar: https://www.nyse.com/markets/hours-calendars
export function getEasternClock(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (key: string) => Number(parts.find(p => p.type === key)!.value);
  const day = new Date(Date.UTC(value('year'), value('month') - 1, value('day')));
  return { day, key: day.toISOString().slice(0, 10), minutes: value('hour') * 60 + value('minute') };
}

function isTradingDay(day: Date) {
  return ![0, 6].includes(day.getUTCDay()) && !MARKET_HOLIDAYS_2026.some(
    h => h.date === day.toISOString().slice(0, 10) && h.market !== 'KR',
  );
}

// Resolve the offset on the target trading date, not today's offset (DST weekends).
function atEasternMinute(day: Date, minute: number) {
  const noon = new Date(day.getTime() + 12 * 3600000);
  const offsetMinutes = 720 - getEasternClock(noon).minutes;
  return day.getTime() + (minute + offsetMinutes) * 60000;
}

export function getUsTradingSession(now: Date) {
  const { day, key, minutes } = getEasternClock(now);
  const closeMinute = EARLY_CLOSE.has(key) ? 780 : 960;
  let nextOpen: number | null = null;
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(day.getTime() + i * 86400000);
    if (candidate.getUTCFullYear() !== 2026) break;
    if (!isTradingDay(candidate)) continue;
    const opens = atEasternMinute(candidate, 570);
    if (opens > now.getTime()) { nextOpen = opens; break; }
  }
  const known = day.getUTCFullYear() === 2026;
  const trading = known && isTradingDay(day);
  const phase = !known ? 'unknown' : !trading
    ? ([0, 6].includes(day.getUTCDay()) ? 'weekend' : 'holiday')
    : minutes < 570 ? 'pre' : minutes >= closeMinute ? 'post' : 'open';
  return { phase, minutes, closeMinute, nextOpen, closeAt: atEasternMinute(day, closeMinute) };
}
