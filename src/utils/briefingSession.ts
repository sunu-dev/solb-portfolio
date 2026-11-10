import { usCalendarDay } from '@/config/usTradingCalendar';

const ny = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const previousDay = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
function closedReason(date: string): string | null {
  const holiday = usCalendarDay(date).holiday;
  if (holiday) return holiday === 'Labor Day' ? '노동절' : holiday;
  return [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? '주말' : null;
}

/** 뉴욕 개장 전에는 직전 현지 날짜를 브리핑 대상으로 삼는다. 브라우저 시간대와 무관하다. */
export function getBriefingSession(now: number) {
  const parts = Object.fromEntries(ny.formatToParts(now).map(p => [p.type, p.value]));
  let date = `${parts.year}-${parts.month}-${parts.day}`;
  if (Number(parts.hour) * 60 + Number(parts.minute) < 570) date = previousDay(date);
  // 달력 범위 밖은 거래일로 추정하지 않는다.
  if (!usCalendarDay(date).known) return { date, reason: null, lastTradingDate: null, known: false };
  const reason = closedReason(date);
  let lastTradingDate = date;
  for (let i = 0; i < 10 && closedReason(lastTradingDate); i++) {
    lastTradingDate = previousDay(lastTradingDate);
    if (!usCalendarDay(lastTradingDate).known) return { date, reason, lastTradingDate: null, known: false };
  }
  return { date, reason, lastTradingDate, known: true };
}
