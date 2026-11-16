/** Bounded, per-process cache for public reads only. Errors are never retained. */
export function createCoalescedRead<T>(ttlMs: number) {
  let entry: { key: number; until: number; promise: Promise<T> } | undefined;
  return {
    clear() { entry = undefined; },
    read(key: number, load: () => Promise<T>): Promise<T> {
      if (entry?.key === key && entry.until > Date.now()) return entry.promise;
      const next = { key, until: Date.now() + ttlMs, promise: Promise.resolve().then(load) };
      entry = next;
      next.promise = next.promise.catch(error => {
        if (entry === next) entry = undefined;
        throw error;
      });
      return next.promise;
    },
  };
}
