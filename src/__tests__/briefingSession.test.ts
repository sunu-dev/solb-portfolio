import { describe, expect, it } from 'vitest';
import { getBriefingSession } from '@/utils/briefingSession';

describe('미국 브리핑 거래일 기준', () => {
  it('노동절 다음날 한국 점심에 휴장과 직전 금요일을 안내한다', () => {
    expect(getBriefingSession(Date.parse('2026-09-08T12:17:00+09:00'))).toMatchObject({
      date: '2026-09-07', reason: '노동절', lastTradingDate: '2026-09-04',
    });
  });
  it('뉴욕 날짜가 바뀐 한국 저녁에도 개장 전까지 휴장 안내를 유지한다', () => {
    expect(getBriefingSession(Date.parse('2026-09-08T21:00:00+09:00')).reason).toBe('노동절');
  });
  it('정규장이 열린 후에는 휴장으로 표시하지 않는다', () => {
    expect(getBriefingSession(Date.parse('2026-09-08T22:30:00+09:00'))).toMatchObject({ date: '2026-09-08', reason: null });
  });
  it('한국 월요일 아침의 미국 주말을 구분한다', () => {
    expect(getBriefingSession(Date.parse('2026-09-14T08:00:00+09:00'))).toMatchObject({ reason: '주말', lastTradingDate: '2026-09-11' });
  });
  it('겨울철에도 뉴욕 시간대로 판정한다', () => {
    expect(getBriefingSession(Date.parse('2026-12-26T08:00:00+09:00'))).toMatchObject({ reason: '크리스마스', date: '2026-12-25' });
  });
  it('달력 범위 밖을 정상 거래일로 추정하지 않는다', () => {
    expect(getBriefingSession(Date.parse('2027-07-06T08:00:00+09:00')).known).toBe(false);
  });
});
