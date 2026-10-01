import { getKrMarketLabel } from '@/utils/krMarketLabel';
import { getUsTradingSession } from '@/utils/usTradingSession';
import { getMarketLabel, getMarketStatus as getUsStatus } from '@/utils/marketHours';

export interface MarketStatus {
  status: 'open' | 'preparing' | 'extended' | 'closed';
  labelSimple: string;
  color: string;
  dot: string;
  nextEvent: string;
}
export interface DualMarketStatus {
  kr: MarketStatus;
  us: MarketStatus;
  isWeekend: boolean;
}
export function isUSPreMarket(now: Date = new Date()): boolean {
  const session = getUsTradingSession(now);
  return session.phase === 'pre' && session.minutes >= 240;
}
export function getMarketStatus(now: Date = new Date()): DualMarketStatus {
  const kr = getKrMarketLabel(now);
  const us = getMarketLabel(getUsStatus(now));
  const convert = (label: typeof kr | typeof us): MarketStatus => ({
    status: label.accent === 'live' ? 'open' : label.accent === 'soon' ? 'preparing' : 'closed',
    labelSimple: label.accent === 'live' ? '정규장 진행' : label.accent === 'soon' ? '개장 전' : '정규장 종료·휴장',
    color: label.accent === 'live' ? '#16A34A' : label.accent === 'soon' ? '#F59E0B' : '#8B95A1',
    dot: label.emoji,
    nextEvent: label.text,
  });
  const kst = new Date(now.getTime() + 9 * 3600000);
  return { kr: convert(kr), us: convert(us), isWeekend: [0, 6].includes(kst.getUTCDay()) };
}
