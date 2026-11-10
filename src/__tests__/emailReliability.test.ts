import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { sendEmail } from '@/utils/email';
const request = vi.fn();
beforeEach(() => { vi.stubEnv('RESEND_API_KEY', 'test-not-a-key'); vi.stubEnv('EMAIL_FROM', 'Joobi <test@example.test>'); vi.stubGlobal('fetch', request); request.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const options = { to: 'recipient@example.test', subject: 'test', text: 'test', idempotencyKey: 'stable-message' };
it('sets a deadline and provider idempotency key without changing the payload', async () => {
 request.mockResolvedValue(Response.json({ id: 'accepted' }));
 expect(await sendEmail(options)).toMatchObject({ ok: true, id: 'accepted' });
 expect(request.mock.calls[0][1].headers['Idempotency-Key']).toBe('stable-message');
 expect(request.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
it.each([[429,true],[503,true],[400,false],[401,false]])('classifies provider %s for bounded retry', async (status, retryable) => {
 request.mockResolvedValue(Response.json({ message: 'private provider message' }, { status: Number(status) }));
 expect(await sendEmail(options)).toMatchObject({ ok: false, retryable, error: `http_${status}` });
});
it('retries a network timeout only when a stable idempotency key exists', async () => {
 request.mockRejectedValue(new Error('network detail'));
 expect(await sendEmail(options)).toMatchObject({ ok: false, retryable: true });
 expect(await sendEmail({ ...options, idempotencyKey: undefined })).toMatchObject({ ok: false, retryable: false });
});
it.each([[401, false], [502, true]])('keeps HTTP %s classification when an intermediary returns HTML', async (status, retryable) => {
 request.mockResolvedValue(new Response('<html>unavailable</html>', { status: Number(status) }));
 expect(await sendEmail(options)).toMatchObject({ ok: false, retryable, error: `http_${status}` });
});
it('distinguishes retryable concurrent idempotency from a permanently mismatched payload', async () => {
 request.mockResolvedValueOnce(Response.json({ name: 'concurrent_idempotent_requests' }, { status: 409 }));
 expect(await sendEmail(options)).toMatchObject({ ok: false, retryable: true });
 request.mockResolvedValueOnce(Response.json({ name: 'invalid_idempotent_request' }, { status: 409 }));
 expect(await sendEmail(options)).toMatchObject({ ok: false, retryable: false });
});
it('requires an acceptance receipt, and only retries an ambiguous success with its original key', async () => {
 request.mockImplementation(async () => Response.json({}));
 expect(await sendEmail(options)).toMatchObject({ ok: false, retryable: true, error: 'missing_provider_receipt' });
 expect(await sendEmail({ ...options, idempotencyKey: undefined })).toMatchObject({ ok: false, retryable: false });
});
it('uses the production origin for one-click unsubscribe when an app URL is not configured', async () => {
 vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
 vi.stubEnv('EMAIL_UNSUB_SECRET', 'test-unsubscribe-secret');
 request.mockResolvedValue(Response.json({ id: 'accepted' }));
 expect(await sendEmail({ ...options, unsubscribe: { userId: 'test-user', kind: 'morning_brief' } })).toMatchObject({ ok: true });
 const body = JSON.parse(request.mock.calls[0][1].body);
 expect(body.headers['List-Unsubscribe']).toMatch(/^<https:\/\/joobi\.kr\/api\/email\/unsubscribe\?token=/);
 expect(body.text).toContain('https://joobi.kr/api/email/unsubscribe');
 expect(body.text).not.toContain('solb-portfolio.vercel.app');
});
