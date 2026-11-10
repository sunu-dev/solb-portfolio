import { MARKET_HOLIDAYS_2026 } from './marketHolidays';

export const US_CALENDAR_SOURCE = 'https://www.nyse.com/trade/hours-calendars';
// NYSE published 2026–2028 core-session calendar, checked 2026-11-03.
const holidays = new Map<string, string>([
  ...MARKET_HOLIDAYS_2026.filter(h => h.market !== 'KR').map(h => [h.date, h.label] as [string, string]),
  ['2027-01-01','신정'], ['2027-01-18','마틴 루서 킹 기념일'], ['2027-02-15','대통령의 날'],
  ['2027-03-26','성금요일'], ['2027-05-31','메모리얼 데이'], ['2027-06-18','준틴스 대체휴일'],
  ['2027-07-05','독립기념일 대체휴일'], ['2027-09-06','노동절'], ['2027-11-25','추수감사절'], ['2027-12-24','크리스마스 대체휴일'],
  ['2028-01-17','마틴 루서 킹 기념일'], ['2028-02-21','대통령의 날'], ['2028-04-14','성금요일'],
  ['2028-05-29','메모리얼 데이'], ['2028-06-19','준틴스'], ['2028-07-04','독립기념일'],
  ['2028-09-04','노동절'], ['2028-11-23','추수감사절'], ['2028-12-25','크리스마스'],
]);
// 2028-01-01 is Saturday: NYSE explicitly lists no observed New Year holiday.
const earlyCloses = new Set(['2026-11-27','2026-12-24','2027-11-26','2028-07-03','2028-11-24']);
export function usCalendarDay(key: string) {
  const year = Number(key.slice(0, 4));
  return { known: year >= 2026 && year <= 2028, holiday: holidays.get(key) ?? null, closeMinute: earlyCloses.has(key) ? 780 : 960 };
}
