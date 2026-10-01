import { describe, expect, it } from 'vitest';
import { getAgeFromBirthDate, isAdultBirthDate } from '@/lib/aiAgeGate';

const NOW = new Date(2026, 6, 27, 12, 0, 0);

describe('Gemini 성인 게이트', () => {
  it('숫자 8자리 직접 입력에서도 만 18세 생일 경계를 지킨다', () => {
    expect(isAdultBirthDate('20080727', NOW)).toBe(true);
    expect(isAdultBirthDate('20080728', NOW)).toBe(false);
    expect(getAgeFromBirthDate('19950123', NOW)).toBe(31);
  });

  it.each(['', '2008', '2008072', '200807270', '2008-0727', '20080230', '20270201', '20081301', '20080001', '20080100', '18900101', 'abcdefgh'])(
    '불완전하거나 잘못된 직접 입력 %s는 허용하지 않는다', (value) => {
      expect(getAgeFromBirthDate(value, NOW)).toBeNull();
      expect(isAdultBirthDate(value, NOW)).toBe(false);
    },
  );

  it('윤년 날짜를 검증한다', () => {
    expect(isAdultBirthDate('20000229', NOW)).toBe(true);
    expect(isAdultBirthDate('20010229', NOW)).toBe(false);
  });
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
