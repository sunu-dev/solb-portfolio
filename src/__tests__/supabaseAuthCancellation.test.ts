import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: state.create }));
import { getAuthClient, resetSupabaseServerClientsForTests } from '@/lib/supabaseServer';

beforeEach(() => {
  resetSupabaseServerClientsForTests();
  state.create.mockReset().mockImplementation(() => ({}));
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://auth.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-only');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); resetSupabaseServerClientsForTests(); });

it('passes cancellation to the actual auth fetch without contaminating cached or other-request clients', async () => {
  const cached = getAuthClient();
  const alice = new AbortController(), bob = new AbortController();
  getAuthClient(alice.signal);
  getAuthClient(bob.signal);
  expect(getAuthClient()).toBe(cached);
  expect(state.create).toHaveBeenCalledTimes(3);
  expect(state.create.mock.calls[0][2]).not.toHaveProperty('global');
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  await state.create.mock.calls[1][2].global.fetch('https://auth.test/user', { headers: { Authorization: 'Bearer alice-test' } });
  await state.create.mock.calls[2][2].global.fetch('https://auth.test/user', { headers: { Authorization: 'Bearer bob-test' } });
  alice.abort();
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(fetch.mock.calls[1][1].signal.aborted).toBe(false);
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer bob-test');
});
