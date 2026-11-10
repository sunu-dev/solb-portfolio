import { afterEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readCloudDictionary, writeCloudDictionary, deleteCloudDictionary } from '@/lib/personalDictionaryCloud';
import type { DictionaryEntry } from '@/lib/personalDictionary';
const entry: DictionaryEntry = { id: 'term:etf', termId: 'etf', title: 'ETF', note: '', savedAt: '2026-11-04T00:00:00Z', familiarity: 'new', revision: 2 };
function client(data: unknown[], error: unknown = null) {
  const q = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), update: vi.fn(), insert: vi.fn(), delete: vi.fn(), abortSignal: vi.fn(), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve) };
  for (const key of ['select','eq','order','limit','update','insert','delete','abortSignal'] as const) q[key].mockReturnValue(q);
  return { db: { from: vi.fn().mockReturnValue(q) } as unknown as SupabaseClient, q };
}
it('writes only the expected owner and revision and never puts revision into the stored payload', async () => {
  const { db, q } = client([{ id: entry.id }]);
  expect(await writeCloudDictionary(db, 'alice', entry)).toBe(true);
  expect(q.eq.mock.calls).toEqual([['user_id','alice'],['id','term:etf'],['revision',2]]);
  expect(q.update.mock.calls[0][0].entry).not.toHaveProperty('revision');
});
afterEach(() => vi.useRealTimers());
it('stops a stalled cloud read without inventing an empty dictionary', async () => {
  vi.useFakeTimers();
  const { db, q } = client([]);
  q.then = () => new Promise(() => {});
  const result = readCloudDictionary(db, 'alice');
  const rejection = expect(result).rejects.toThrow('Request deadline exceeded');
  await vi.advanceTimersByTimeAsync(6000);
  await rejection;
  expect((q.abortSignal.mock.calls[0][0] as AbortSignal).aborted).toBe(true);
});
it('does not report success when a write cannot be confirmed', async () => {
  vi.useFakeTimers();
  const { db, q } = client([]);
  q.then = () => new Promise(() => {});
  const result = writeCloudDictionary(db, 'alice', entry);
  const rejection = expect(result).rejects.toThrow('Request deadline exceeded');
  await vi.advanceTimersByTimeAsync(6000);
  await rejection;
  expect((q.abortSignal.mock.calls[0][0] as AbortSignal).aborted).toBe(true);
});
it('does not resurrect missing rows or pretend stale writes and deletes succeeded', async () => {
  const { db } = client([]);
  expect(await writeCloudDictionary(db, 'alice', entry)).toBe(false);
  expect(await deleteCloudDictionary(db, 'alice', entry)).toBe(false);
});
it('validates stored entries and restores server revisions', async () => {
  const { db } = client([{ entry, revision: 4 }, { entry: { note: 'broken' }, revision: 1 }]);
  const entries = await readCloudDictionary(db, 'alice');
  expect(entries).toHaveLength(1);
  expect(entries[0].revision).toBe(4);
});
it('keeps a cloud outage distinct from an empty new dictionary', async () => {
  const { db } = client([], { message: 'offline' });
  await expect(readCloudDictionary(db, 'alice')).rejects.toThrow('dictionary_read_failed');
  expect(await writeCloudDictionary(db, 'alice', entry)).toBe(false);
});
