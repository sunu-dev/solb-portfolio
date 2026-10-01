import { expect, it } from 'vitest';
import { yahooPreviousClose } from '@/utils/yahooPreviousClose';
import { GET } from '@/app/api/ws-token/route';

it('전일 종가 우선, 5일 조회 기준가는 사용하지 않는다', () => {
  const result = { meta: { previousClose: 110, chartPreviousClose: 90 }, indicators: { quote: [{ close: [95, 100, 105, 110, 120] }] } };
  expect(yahooPreviousClose(result)).toBe(110);
  expect(yahooPreviousClose({ ...result, meta: {} })).toBe(110);
});
it('직전 일봉이 누락되면 며칠 전 종가나 현재가로 0%를 만들어내지 않는다', () => {
  expect(yahooPreviousClose({ indicators: { quote: [{ close: [90, 100, null, 120] }] } })).toBeNull();
  expect(yahooPreviousClose({ meta: {} })).toBeNull();
});
it('폐쇄된 실시간 경로는 API 키를 전달하지 않는다', async () => {
  const response = await GET();
  expect(response.status).toBe(410);
  expect(await response.json()).not.toHaveProperty('token');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});
