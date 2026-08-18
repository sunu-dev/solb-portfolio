'use client';

import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let nowSnapshot = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function emitCurrentTime() {
  nowSnapshot = Date.now();
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  const wasEmpty = listeners.size === 0;
  listeners.add(listener);

  if (wasEmpty) {
    emitCurrentTime();
    timer = setInterval(emitCurrentTime, 60_000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  return nowSnapshot;
}

function getServerSnapshot() {
  return 0;
}

/** Hydration 이후 현재 시각을 제공하고, 열린 화면에서는 1분마다 갱신한다. */
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
