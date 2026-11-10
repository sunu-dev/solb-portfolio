import { JOOBI_STAGES, type JoobiProgress } from './joobiProgress';
/** Transport errors must not be presented as a depleted question allowance. */
export class JoobiRequestError extends Error {
  constructor(public readonly kind: 'timeout' | 'server' | 'format') { super(kind); }
}

export function withRequestSignal<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new JoobiRequestError('timeout'));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function readJoobiResponse(response: Response, progress?: JoobiProgress) {
  if (response.headers?.get('Content-Type')?.includes('application/x-ndjson')) {
    const reader = response.body?.getReader();
    if (!reader) throw new JoobiRequestError('format');
    const decoder = new TextDecoder(); let buffer = '', bytes = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) throw new JoobiRequestError('format');
        bytes += value.byteLength;
        if (bytes > 1_000_000) throw new JoobiRequestError('format');
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
          const event = JSON.parse(line);
          if (event.type === 'stage' && Object.hasOwn(JOOBI_STAGES, event.stage)) progress?.(event.stage);
          if (event.type === 'result' && event.body && typeof event.body === 'object' && !Array.isArray(event.body)) return { ...event.body, httpStatus: event.status };
        }
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  let data;
  try { data = await response.json(); }
  catch { throw new JoobiRequestError(response.status >= 500 ? 'server' : 'format'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new JoobiRequestError('format');
  return data;
}

export function joobiRequestErrorMessage(error: unknown, timedOut: boolean, offline: boolean, phase: 'session' | 'answer') {
  if (offline) return '인터넷 연결이 끊겼어요. 연결한 뒤 다시 보내주세요. 질문은 그대로 남겨뒀어요.';
  if (phase === 'session') return '로그인 상태를 확인하지 못했어요. 잠시 후 다시 보내주세요. 계속되면 다시 로그인해 주세요.';
  if (timedOut || error instanceof JoobiRequestError && error.kind === 'timeout') return '답변이 늦어져 기다리기를 멈췄어요. 질문은 남겨뒀어요. 잠시 후 다시 보내주세요.';
  if (error instanceof JoobiRequestError && error.kind === 'server') return '답변 서버가 잠시 응답하지 못했어요. 잠시 후 다시 보내주세요.';
  if (error instanceof JoobiRequestError && error.kind === 'format') return '받은 답변을 화면에 표시하지 못했어요. 질문은 남겨뒀어요. 다시 보내주세요.';
  return '답변을 받는 도중 연결이 끊겼어요. 질문은 남겨뒀어요. 잠시 후 다시 보내주세요.';
}
