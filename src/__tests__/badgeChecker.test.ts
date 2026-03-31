import { describe, it, expect } from 'vitest';
import { checkUnlockedBadges } from '@/utils/badgeChecker';

describe('checkUnlockedBadges', () => {
  const base = {
    totalStocks: 0,
    streak: 0,
    aiUsageCount: 0,
    mentorUsed: new Set<string>(),
    profitCount: 0,
    allProfit: false,
    targetHit: false,
    rainLight: false,
  };

  it('첫 로그인 뱃지 항상 해금', () => {
    const badges = checkUnlockedBadges(base);
    expect(badges.some(b => b.id === 'first-login')).toBe(true);
  });

  it('종목 1개 → 첫 종목 뱃지', () => {
    const badges = checkUnlockedBadges({ ...base, totalStocks: 1 });
    expect(badges.some(b => b.id === 'first-stock')).toBe(true);
  });

  it('종목 3개 → 세 종목 뱃지', () => {
    const badges = checkUnlockedBadges({ ...base, totalStocks: 3 });
    expect(badges.some(b => b.id === 'three-stocks')).toBe(true);
  });

  it('7일 연속 → 스트릭 뱃지', () => {
    const badges = checkUnlockedBadges({ ...base, streak: 7 });
    expect(badges.some(b => b.id === 'streak-7')).toBe(true);
  });

  it('수익 1개 → 첫 수익 뱃지', () => {
    const badges = checkUnlockedBadges({ ...base, profitCount: 1 });
    expect(badges.some(b => b.id === 'first-profit')).toBe(true);
  });

  it('전부 수익 → 전승 뱃지', () => {
    const badges = checkUnlockedBadges({ ...base, totalStocks: 3, allProfit: true });
    expect(badges.some(b => b.id === 'all-profit')).toBe(true);
  });

  it('비광 — 하락장 수익 유지', () => {
    const badges = checkUnlockedBadges({ ...base, rainLight: true });
    expect(badges.some(b => b.id === 'rain-light')).toBe(true);
  });

  it('아무것도 없으면 첫 로그인만', () => {
    const badges = checkUnlockedBadges(base);
    expect(badges.length).toBe(1);
    expect(badges[0].id).toBe('first-login');
  });
});
