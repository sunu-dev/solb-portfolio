export type ProviderFailure = 'rate_limited' | 'access_denied' | 'invalid_request' | 'timeout' | 'network' | 'provider_unavailable' | 'unknown';
export interface ProviderAttempt {inputCeiling?:number;tokenCounted?:boolean; stage: 'draft' | 'review'; model: string; elapsedMs: number; status: string; failure?: ProviderFailure }
/** Closed taxonomy only. Never log messages, URLs, request bodies, headers or keys. */
export function classifyProviderFailure(error: unknown): ProviderFailure {
  const wrapped: Record<string, ProviderFailure> = {
    'Retryable HTTP Error: Too Many Requests': 'rate_limited',
    'Retryable HTTP Error: Service Unavailable': 'provider_unavailable',
    'Retryable HTTP Error: Internal Server Error': 'provider_unavailable',
    'Retryable HTTP Error: Gateway Timeout': 'timeout',
    'Non-retryable exception Bad Request sending request': 'invalid_request',
    'Non-retryable exception Unauthorized sending request': 'access_denied',
    'Non-retryable exception Forbidden sending request': 'access_denied',
  };
  let current = error;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth++) {
    const e = current as { status?: unknown; name?: unknown; code?: unknown; message?: unknown; cause?: unknown };
    const status = Number(e.status);
    if (status === 429) return 'rate_limited';
    if (status === 401 || status === 403) return 'access_denied';
    if (status === 400) return 'invalid_request';
    if (status === 408 || status === 504) return 'timeout';
    if (status >= 500 && status <= 599) return 'provider_unavailable';
    if (typeof e.message === 'string' && Object.hasOwn(wrapped, e.message)) return wrapped[e.message];
    if (e.name === 'APIConnectionTimeoutError' || e.name === 'TimeoutError' || e.name === 'AbortError' || ['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT'].includes(String(e.code))) return 'timeout';
    if (['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_SOCKET'].includes(String(e.code))) return 'network';
    current = e.cause;
  }
  return 'unknown';
}
