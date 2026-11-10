import { usCalendarDay } from '@/config/usTradingCalendar';
import { getEasternClock, getUsTradingSession } from '@/utils/usTradingSession';

export type AssistantSessionReference = 'latest' | 'previous';
export interface AssistantSessionSelection {
  reference: 'previous';
  throughDay: string;
  description: string;
}
const previousDay = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`) - 86400_000).toISOString().slice(0, 10);
const isKorean = (symbol: string) => /\.(KS|KQ)$/.test(symbol) || ['^KS11', '^KQ11'].includes(symbol);

/** Korean users call the last completed US overnight session "어제 미장".
 * Keep that interpretation explicit; never include a newly opened US session.
 * For Korean shares, yesterday excludes today's session even after its close.
 */
export function assistantSessionSelection(symbol: string, reference: AssistantSessionReference = 'latest', now = Date.now()): AssistantSessionSelection | undefined {
  if (reference !== 'previous') return undefined;
  if (isKorean(symbol)) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    return { reference, throughDay: previousDay(today), description: '한국 시간으로 오늘 이전의 최근 거래일' };
  }
  const clock = getEasternClock(new Date(now));
  const session = getUsTradingSession(new Date(now));
  let day = session.phase === 'post' ? clock.key : previousDay(clock.key);
  for (let count = 0; count < 10; count++, day = previousDay(day)) {
    const calendar = usCalendarDay(day);
    if (!calendar.known) return undefined;
    if (![0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay()) && !calendar.holiday) {
      return { reference, throughDay: day, description: '최근 마감한 미국 정규장' };
    }
  }
  return undefined;
}
