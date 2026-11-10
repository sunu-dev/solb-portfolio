import { withDeadline } from './withDeadline';

/** Covers headers AND the response body; also cancels work when the deadline wins. */
export async function boundedFetch<T>(url: string, ms: number, read: (response: Response) => Promise<T>, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  try {
    return await withDeadline((async () => {
      const response = await fetch(url, { ...init, signal: init.signal
        ? AbortSignal.any([init.signal, controller.signal]) : controller.signal });
      if (!response.ok) throw new Error(`source unavailable (${response.status})`);
      return await read(response);
    })(), ms);
  } finally {
    controller.abort();
  }
}
