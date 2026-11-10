import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const handlers = new Map<string, (event: unknown) => void>();
const put = vi.fn(), match = vi.fn(), open = vi.fn(), remove = vi.fn(), request = vi.fn();
const keys = vi.fn();
beforeEach(() => {
  vi.resetAllMocks(); handlers.clear();
  put.mockResolvedValue(undefined); match.mockResolvedValue(undefined);
  open.mockResolvedValue({ put, match }); remove.mockResolvedValue(true);
  keys.mockResolvedValue([]);
  request.mockResolvedValue(new Response('asset', { headers: { 'Content-Type': 'image/png' } }));
  runInNewContext(source, {
    self: { location: { origin: 'https://joobi.kr' }, addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler) },
    caches: { open, keys, delete: remove }, clients: { claim: vi.fn() },
    fetch: request, URL, Response,
  });
});
async function dispatch(url: string, options: RequestInit & { navigation?: boolean } = {}) {
  const req = new Request(url, options);
  if (options.navigation) Object.defineProperty(req, 'mode', { value: 'navigate' });
  let response: Promise<Response> | undefined;
  const waits: Promise<unknown>[] = [];
  handlers.get('fetch')!({ request: req, respondWith: (value: Promise<Response>) => { response = value; }, waitUntil: (value: Promise<unknown>) => waits.push(value) });
  const result = await response;
  await Promise.all(waits);
  return result;
}

describe('PWA cache privacy and release boundaries', () => {
  it.each(['/api/private.svg', '/auth/callback?code=secret', '/_next/static/chunk.js', '/illustrations/sectors/energy-light.svg'])('never intercepts %s', async path => {
    expect(await dispatch(`https://joobi.kr${path}`)).toBeUndefined();
    expect(open).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
  });
  it('does not cache account HTML, JSON, RSC, credentialed requests or token-bearing URLs', async () => {
    await dispatch('https://joobi.kr/admin', { navigation: true });
    await dispatch('https://joobi.kr/?_rsc=account', { headers: { RSC: '1' } });
    await dispatch('https://joobi.kr/export.json');
    await dispatch('https://joobi.kr/icon-192.png?token=private');
    await dispatch('https://joobi.kr/icon-192.png', { headers: { Authorization: 'Bearer test' } });
    expect(open).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled();
  });
  it('stores only a successful public static response and tolerates unavailable cache storage', async () => {
    expect((await dispatch('https://joobi.kr/icon-192.png'))?.status).toBe(200);
    expect(put).toHaveBeenCalledOnce();
    open.mockRejectedValueOnce(Error('blocked'));
    expect((await dispatch('https://joobi.kr/icon-512.png'))?.status).toBe(200);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it.each(['private, max-age=3600', 'no-store'])('respects the response cache policy %s', async policy => {
    request.mockResolvedValue(new Response('private asset', { headers: { 'Content-Type': 'image/png', 'Cache-Control': policy } }));
    await dispatch('https://joobi.kr/icon-192.png');
    expect(put).not.toHaveBeenCalled();
  });
  it('never caches a login/error HTML response behind an image path', async () => {
    request.mockResolvedValue(new Response('<html>account</html>', { headers: { 'Content-Type': 'text/html' } }));
    await dispatch('https://joobi.kr/icon-192.png');
    expect(put).not.toHaveBeenCalled();
  });
  it('returns an explicit offline notice without using a previous account document', async () => {
    request.mockRejectedValue(Error('offline'));
    const response = await dispatch('https://joobi.kr/', { navigation: true });
    expect(response?.status).toBe(503); expect(await response?.text()).toContain('오프라인');
    expect(open).not.toHaveBeenCalled(); expect(match).not.toHaveBeenCalled();
  });
  it('removes older Joobi document caches on activation without deleting unrelated caches', async () => {
    keys.mockResolvedValue(['joobi-v1', 'joobi-v2', 'joobi-static-v3', 'unrelated']);
    let finished: Promise<unknown> | undefined;
    handlers.get('activate')!({ waitUntil: (value: Promise<unknown>) => { finished = value; } });
    await finished;
    expect(remove.mock.calls.map(([name]) => name)).toEqual(['joobi-v1', 'joobi-v2']);
  });
});
