import { usCalendarDay } from '@/config/usTradingCalendar';
import { getEasternClock, getUsTradingSession } from './usTradingSession';

const DAY = 86400000;
const sunday = (year: number, month: number, occurrence: number) => 1 + (7 - new Date(Date.UTC(year, month, 1)).getUTCDay()) % 7 + (occurrence - 1) * 7;
function easternOffset(at: number) {
  const clock = getEasternClock(new Date(at));
  return (clock.day.getTime() + clock.minutes * 60000 - Math.floor(at / 60000) * 60000) / 60000;
}
function koreanTime(minutes: number) {
  const h = Math.floor(minutes / 60) % 24, m = minutes % 60;
  return `${h < 12 ? '오전' : h < 18 ? '오후' : '밤'} ${h % 12 || 12}시${m ? ` ${m}분` : ''}`;
}

/** NIST clock rules, checked against the runtime's New York timezone data.
 * Only announce a first trading session covered by the published NYSE calendar.
 */
export function getUsClockChangeNotice(now: Date) {
  const at = now.getTime(), year = now.getUTCFullYear();
  if (!Number.isFinite(at) || !usCalendarDay(`${year}-01-01`).known) return null;
  const transitions = [
    { at: Date.UTC(year, 2, sunday(year, 2, 2), 7), later: false },
    { at: Date.UTC(year, 10, sunday(year, 10, 1), 6), later: true },
  ];
  for (const change of transitions) {
    if (at < change.at - 7 * DAY || at >= change.at + 9 * DAY) continue;
    const before = easternOffset(change.at - 60000), after = easternOffset(change.at + 60000);
    if (after - before !== (change.later ? -60 : 60)) continue;
    const firstOpen = getUsTradingSession(new Date(change.at)).nextOpen;
    if (firstOpen === null || at >= firstOpen + 7 * DAY) continue;
    const upcoming = at < firstOpen;
    const opening = koreanTime(570 - after + 540), closing = koreanTime(960 - after + 540);
    const oldOpening = koreanTime(570 - before + 540);
    const first = new Date(firstOpen + 9 * 3600000);
    return {
      id: `us-clock-${year}-${change.later ? 'end' : 'start'}`,
      status: upcoming ? 'upcoming' as const : 'applied' as const,
      firstOpen,
      title: `미국 정규장 시간이 한 시간 ${change.later ? upcoming ? '늦어져요' : '늦어졌어요' : upcoming ? '빨라져요' : '빨라졌어요'}`,
      message: `${first.getUTCMonth() + 1}월 ${first.getUTCDate()}일 거래일부터 한국 시간 ${oldOpening}이던 개장 시각이 ${opening}으로 ${upcoming ? '바뀌어요' : '바뀌었어요'}.`,
      hours: `정규장: ${opening} ~ 다음 날 ${closing}`,
      explanation: `서머타임은 여름철에 시계를 한 시간 앞당기는 제도예요. 미국에서 서머타임이 ${change.later ? '끝나' : '시작되'}면 한국과 미국의 시차가 바뀌어, 한국에서 보는 거래 시간도 달라져요.`,
    };
  }
  return null;
}
