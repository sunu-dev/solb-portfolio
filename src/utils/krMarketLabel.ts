import { MARKET_HOLIDAYS_2026 } from '@/config/marketHolidays';

/** KRX 정규장 기준. NXT·시간외 거래 상태와 구분한다. */
export function getKrMarketLabel(now: Date) {
  const kst = new Date(now.getTime() + 9 * 3600000);
  const date = kst.toISOString().slice(0, 10);
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const closed = (text: string) => ({ emoji: '⚪', text, accent: 'closed' as const });
  if (kst.getUTCFullYear() !== 2026) return closed('국장 · 거래 일정 확인 필요');
  const holiday = MARKET_HOLIDAYS_2026.find(h => h.date === date && h.market !== 'US');
  if (holiday) return closed(`국장 휴장 · ${holiday.label}`);
  if ([0, 6].includes(kst.getUTCDay())) return closed('국장 휴장 · 주말');
  if (minutes < 540) return { emoji: '🌅', text: '국장 개장 전 · 09:00 정규장', accent: 'soon' as const };
  if (minutes >= 930) return closed('국장 정규장 마감 · 15:30');
  const remaining = 930 - minutes;
  const duration = remaining >= 60 ? `${Math.floor(remaining / 60)}시간${remaining % 60 ? ` ${remaining % 60}분` : ''}` : `${remaining}분`;
  return { emoji: '🟢', text: `국장 진행 중 · 정규장 마감까지 ${duration}`, accent: 'live' as const };
}
