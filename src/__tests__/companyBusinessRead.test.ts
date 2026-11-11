import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// 읽기 전용 호출 하나가 멈춰도 회사 설명이 '자료 없음'으로 빠지지 않아야 한다.
const m = vi.hoisted(() => ({ calls: [] as { signal: AbortSignal }[], behaviour: [] as ((signal: AbortSignal) => Promise<{ data: unknown; error: unknown }>)[] }));
vi.mock('@/lib/supabaseServer', () => ({
  requireServiceClient: () => { throw new Error('not used'); },
  getServiceClient: () => ({ rpc: () => ({ abortSignal: (signal: AbortSignal) => { m.calls.push({ signal }); return m.behaviour[m.calls.length - 1](signal); } }) }),
}));
import { readPublishedBusiness } from '@/lib/companyBusiness/store';

const answers = (data: unknown, afterMs = 5) => () => new Promise<{ data: unknown; error: unknown }>(resolve => setTimeout(() => resolve({ data, error: null }), afterMs));
const stalls = () => (signal: AbortSignal) => new Promise<{ data: unknown; error: unknown }>((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
const fails = (afterMs: number) => () => new Promise<{ data: unknown; error: unknown }>(resolve => setTimeout(() => resolve({ data: null, error: { message: 'temporarily unavailable' } }), afterMs));
beforeEach(() => { m.calls.length = 0; m.behaviour.length = 0; });
afterEach(() => vi.restoreAllMocks());

it('uses one read when it answers promptly', async () => {
  m.behaviour.push(answers(null));
  expect(await readPublishedBusiness('NVDA')).toEqual({ status: 'none' });
  expect(m.calls).toHaveLength(1);
});

it('sends a second read when the first stalls and uses whichever answers', async () => {
  m.behaviour.push(stalls(), answers({ withheld: true }));
  const started = Date.now();
  expect(await readPublishedBusiness('NVDA')).toEqual({ status: 'withheld' });
  expect(m.calls).toHaveLength(2);
  // It did not wait for the stalled request to time out.
  expect(Date.now() - started).toBeLessThan(1500);
});

it('reads again at once after a quick failure', async () => {
  m.behaviour.push(fails(10), answers(null));
  const started = Date.now();
  expect(await readPublishedBusiness('NVDA')).toEqual({ status: 'none' });
  expect(m.calls).toHaveLength(2); expect(Date.now() - started).toBeLessThan(300);
});

it('reports unavailable, never a guess, when both reads fail', async () => {
  m.behaviour.push(fails(400), fails(100));
  expect(await readPublishedBusiness('NVDA')).toEqual({ status: 'unavailable' });
  expect(m.calls).toHaveLength(2);
});

it('never sends more than two reads', async () => {
  m.behaviour.push(fails(10), fails(10), answers(null));
  expect(await readPublishedBusiness('NVDA')).toEqual({ status: 'unavailable' });
  expect(m.calls).toHaveLength(2);
});
