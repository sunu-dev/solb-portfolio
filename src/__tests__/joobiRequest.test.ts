import { describe, expect, it } from 'vitest';
import { JoobiRequestError, joobiRequestErrorMessage, readJoobiResponse, withRequestSignal } from '@/lib/joobiRequest';

describe('chat response recovery', () => {
  it('distinguishes a gateway HTML error from a malformed successful answer', async () => {
    await expect(readJoobiResponse(new Response('<html>unavailable</html>', { status: 504 }))).rejects.toMatchObject({ kind: 'server' });
    await expect(readJoobiResponse(new Response('not json', { status: 200 }))).rejects.toMatchObject({ kind: 'format' });
    await expect(readJoobiResponse(new Response('null'))).rejects.toMatchObject({ kind: 'format' });
  });
  it('preserves structured server errors for their specific recovery instructions', async () => {
    const body = { success: false, error: '로그인이 만료됐어요.', remaining: 3 };
    expect(await readJoobiResponse(Response.json(body, { status: 401 }))).toEqual(body);
  });
  it('ends a stalled session lookup when aborted instead of waiting forever', async () => {
    const controller = new AbortController();
    const waiting = withRequestSignal(new Promise(() => {}), controller.signal);
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ kind: 'timeout' });
  });
  it('does not blame the question allowance for offline, timeout or unreadable responses', () => {
    expect(joobiRequestErrorMessage(new Error(), false, true, 'answer')).toContain('인터넷 연결');
    expect(joobiRequestErrorMessage(new Error(), true, false, 'answer')).toContain('늦어져');
    expect(joobiRequestErrorMessage(new JoobiRequestError('format'), false, false, 'answer')).toContain('표시하지 못했어요');
    expect(joobiRequestErrorMessage(new Error(), true, false, 'session')).toContain('로그인 상태');
    expect(joobiRequestErrorMessage(new Error(), false, false, 'answer')).not.toContain('횟수');
  });
});
