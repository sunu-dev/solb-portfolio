/** Bound the caller's wait and cancel the underlying request at the same time.
 * A timed-out write may already have committed: callers must not retry it blindly.
 */
export async function withAbortDeadline<T>(
  work: (signal: AbortSignal) => PromiseLike<T>,
  ms = 3000,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const expired = new Promise<never>((_, reject) => {
    const stop = (error: unknown) => {
      controller.abort(error);
      reject(error);
    };
    timer = setTimeout(() => stop(new Error('Request deadline exceeded')), ms);
    onAbort = () => stop(parentSignal?.reason ?? new Error('Request cancelled'));
    if (parentSignal?.aborted) onAbort();
    else parentSignal?.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return work(controller.signal);
    }), expired]);
  } finally {
    clearTimeout(timer);
    if (onAbort) parentSignal?.removeEventListener('abort', onAbort);
  }
}
