import { expect, it } from 'vitest';
import { getKrMarketLabel } from '@/utils/krMarketLabel';
import { PRESET_EVENTS } from '@/config/constants';

it.each([
  ['2026-09-10T14:00:00+09:00', 'live', '1시간 30분'],
  ['2026-09-10T08:59:00+09:00', 'soon', '개장 전'],
  ['2026-09-10T09:00:00+09:00', 'live', '6시간 30분'],
  ['2026-09-10T15:20:00+09:00', 'live', '10분'],
  ['2026-09-10T15:30:00+09:00', 'closed', '마감'],
  ['2026-09-12T14:00:00+09:00', 'closed', '주말'],
  ['2026-09-24T14:00:00+09:00', 'closed', '추석'],
  ['2026-02-17T14:00:00+09:00', 'closed', '설날'],
  ['2026-10-05T14:00:00+09:00', 'closed', '개천절 대체'],
  ['2027-09-10T14:00:00+09:00', 'closed', '확인 필요'],
])('%s의 국장 정규장 상태', (date, accent, text) => {
  const label = getKrMarketLabel(new Date(date));
  expect(label.accent).toBe(accent);
  expect(label.text).toContain(text);
});

it('코로나는 감염병 기간이 아닌 비교 구간과 기준을 명시한다', () => {
  const event = PRESET_EVENTS.find(e => e.id === 'covid')!;
  expect(event.name).toBe('코로나 초기 충격·반등');
  expect(event.endDate).toBe('2020-06-08');
  expect(event.description).toContain('감염병의 지속 기간이 아니');
  expect(event.periodNote).toContain('2019년 말');
  expect(event.periodNote).toContain('코로나 종료일은 아니');
  expect(event.periodSource).toContain('spglobal.com');
  expect(event.keyFacts?.join()).not.toContain('115일');
});
