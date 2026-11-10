import { MARKET_HOLIDAYS_2026 } from '@/config/marketHolidays';
import { getUsTradingSession } from '@/utils/usTradingSession';

export type ArrivalMessage = { text: string; context: string; restful: boolean };
const NEUTRAL: ArrivalMessage = {
  text: '오늘의 소식부터, 천천히.', context: '주비와 함께 살펴봐요', restful: false,
};

/** Public calendar only: never infer a person's mood from their returns. */
export function getArrivalMessage(now?: Date): ArrivalMessage {
  if (!now || !Number.isFinite(now.getTime())) return NEUTRAL;
  const kst = new Date(now.getTime() + 9 * 3600000);
  const us = getUsTradingSession(now);
  if (kst.getUTCFullYear() !== 2026 || us.phase === 'unknown') return NEUTRAL;
  const krDayOff = [0, 6].includes(kst.getUTCDay()) || MARKET_HOLIDAYS_2026.some(
    h => h.date === kst.toISOString().slice(0, 10) && h.market !== 'US',
  );
  const usDayOff = us.phase === 'weekend' || us.phase === 'holiday';
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  if (krDayOff && usDayOff) return {
    text: '오늘은 잠깐 쉬어가도 좋아요.', context: '한국·미국 증시 쉬는 날', restful: true,
  };
  if (!krDayOff && minutes >= 540 && minutes < 930) return {
    text: '오늘의 흐름, 차분히 살펴봐요.', context: '한국 증시 정규장 거래 중', restful: false,
  };
  if (us.phase === 'open') return {
    text: '오늘의 흐름, 차분히 살펴봐요.', context: '미국 증시 정규장 거래 중', restful: false,
  };
  if (!krDayOff && minutes < 540) return {
    text: '시작 전에, 알아둘 소식부터.', context: '한국 증시 개장 전', restful: false,
  };
  if (us.phase === 'pre') return {
    text: '시작 전에, 알아둘 소식부터.', context: '미국 증시 개장 전', restful: false,
  };
  return { text: '지난 거래의 소식부터, 천천히.', context: '정규장 마감 후', restful: false };
}
