import { describe, expect, it } from 'vitest';
import { getAgeFromBirthDate, isAdultBirthDate } from '@/lib/aiAgeGate';

const NOW = new Date(2026, 6, 27, 12, 0, 0);

describe('Gemini 성인 게이트', () => {
  it('생일 경계까지 정확히 계산한다', () => {
    expect(getAgeFromBirthDate('2008-07-27', NOW)).toBe(18);
    expect(getAgeFromBirthDate('2008-07-28', NOW)).toBe(17);
    expect(isAdultBirthDate('2008-07-27', NOW)).toBe(true);
    expect(isAdultBirthDate('2008-07-28', NOW)).toBe(false);
  });

  it('잘못된 날짜와 비현실적인 연령을 거부한다', () => {
    expect(isAdultBirthDate('2008-02-30', NOW)).toBe(false);
    expect(isAdultBirthDate('1890-01-01', NOW)).toBe(false);
    expect(isAdultBirthDate('not-a-date', NOW)).toBe(false);
  });
});
