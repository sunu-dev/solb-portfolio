import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { requireAdmin, resolveUserOutcome } from '@/lib/adminAuth';
import { getServiceClient, resetSupabaseServerClientsForTests } from '@/lib/supabaseServer';

const request = (signal?: AbortSignal) => new NextRequest('https://example.test/api/me/admin', {
  headers: { authorization: 'Bearer test-token' }, signal,
});

describe('provider failure must not become a logout', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    resetSupabaseServerClientsForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetSupabaseServerClientsForTests();
  });

  it.each([429, 500, 503])('keeps HTTP %i as unavailable and returns 503 at the admin gate', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ msg: 'Service temporarily unavailable' }, { status })));
    expect(await resolveUserOutcome(request())).toEqual({ status: 'unavailable' });
    const result = await requireAdmin(request());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.res.status).toBe(503);
  });

  it.each([401, 403])('still rejects an invalid token (HTTP %i)', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ msg: 'Invalid token' }, { status })));
    expect(await resolveUserOutcome(request())).toEqual({ status: 'anonymous' });
  });

  it('returns the verified user when the provider succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'test-user', email: 'test@example.test' })));
    expect(await resolveUserOutcome(request())).toEqual({ status: 'ok', user: { id: 'test-user', email: 'test@example.test' } });
  });

  it('bounds a hung request to five seconds and cancels its fetch', async () => {
    vi.useFakeTimers();
    let transportSignal: AbortSignal | null | undefined;
    vi.stubGlobal('fetch', vi.fn((_input, init?: RequestInit) => {
      transportSignal = init?.signal;
      return new Promise<Response>(() => {});
    }));
    const pending = resolveUserOutcome(request());
    await vi.advanceTimersByTimeAsync(4999);
    expect(transportSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ status: 'unavailable' });
    expect(transportSignal?.aborted).toBe(true);
  });

  it('cancels only the requesting caller, leaving the shared service client usable', async () => {
    const controller = new AbortController();
    let transportSignal: AbortSignal | null | undefined;
    const fetchMock = vi.fn((_input, init?: RequestInit) => {
      transportSignal = init?.signal;
      return new Promise<Response>(() => {});
    });
    vi.stubGlobal('fetch', fetchMock);
    const shared = getServiceClient();
    const pending = resolveUserOutcome(request(controller.signal));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    controller.abort();
    expect(await pending).toEqual({ status: 'unavailable' });
    expect(transportSignal?.aborted).toBe(true);
    expect(getServiceClient()).toBe(shared);
    vi.stubGlobal('fetch', vi.fn(async (_input, init?: RequestInit) => {
      expect(init?.signal?.aborted).not.toBe(true);
      return Response.json({ id: 'other-user' });
    }));
    expect((await shared!.auth.getUser('other-token')).data.user?.id).toBe('other-user');
  });
});
