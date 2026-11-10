import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ getServiceClient: () => ({ from: mocks.from }) }));
import { getAnalysisUsage } from '@/lib/analysisUsage';
const ok = (count: number | null) => ({ count, error: null, status: 200 });
const failed = (code = '', status = 503) => ({ count: null, error: { code, message: 'private DB detail' }, status });
function setup(results: Array<unknown | (() => Promise<unknown>)>) {
  mocks.from.mockReset().mockImplementation(() => {
    const result = results.shift();
    const query = { select: () => query, eq: () => query, or: () => query,
      abortSignal: () => typeof result === 'function' ? result() : Promise.resolve(result) };
    return query;
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it('returns fresh counts after one transient read error, including a newly reached user limit', async () => {
  setup([failed(), ok(2), ok(250), ok(3)]);
  expect(await getAnalysisUsage('qa-user')).toMatchObject({ available: true, userCount: 3, totalCount: 250 });
  expect(mocks.from).toHaveBeenCalledTimes(4);
  expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('private DB detail');
});
it.each([failed('42501',403), failed('42P01',404), ok(null)])('fails closed without retry for permanent errors or invalid counts', result => {
  setup([result, ok(1)]);
  return getAnalysisUsage('qa-user').then(value => {
    expect(value.available).toBe(false);
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });
});
it('does not retry normal successful reads', async () => {
  setup([ok(10), ok(2)]);
  expect(await getAnalysisUsage('qa-user')).toMatchObject({ available: true, totalCount: 10, userCount: 2 });
  expect(mocks.from).toHaveBeenCalledTimes(2);
});
it('bounds two stalled attempts to 4.5 seconds and never invents usable counts', async () => {
  vi.useFakeTimers(); const hang = () => new Promise(() => {});
  setup([hang, hang, hang, hang]);
  const promise = getAnalysisUsage('qa-user');
  await vi.advanceTimersByTimeAsync(4500);
  expect(await promise).toMatchObject({ available: false });
  expect(mocks.from).toHaveBeenCalledTimes(4);
});
it('recovers a stalled first read with a fresh pair', async () => {
  vi.useFakeTimers(); const hang = () => new Promise(() => {});
  setup([hang, hang, ok(20), ok(3)]);
  const promise = getAnalysisUsage('qa-user');
  await vi.advanceTimersByTimeAsync(3000);
  expect(await promise).toMatchObject({ available: true, totalCount: 20, userCount: 3 });
});
