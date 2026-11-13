import type { ForwardedRef } from 'react';

/** react-pageflip appends every non-null ref call; React 19 replays refs in StrictMode. */
export function uniquePageFlipRef<T extends object>(ref: ForwardedRef<T>) {
  const registered = new WeakSet<T>();
  return (node: T | null) => {
    if (typeof ref !== 'function') {
      if (ref) ref.current = node;
      return;
    }
    if (node && registered.has(node)) return;
    if (node) registered.add(node);
    ref(node);
  };
}
