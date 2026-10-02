import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise the real hook lifecycle with the project's Node-only test setup.
const hooks = vi.hoisted(() => {
  type Effect = { kind: 'effect'; deps: unknown[]; setup: () => void | (() => void); cleanup?: () => void };
  type Scope = { slots: unknown[]; pending: (() => void)[]; cursor: number };
  let current: Scope;
  const scopes: Scope[] = [];
  return {
    create() { const scope = { slots: [], pending: [], cursor: 0 }; scopes.push(scope); return scope; },
    render<T>(scope: Scope, callback: () => T): T {
      current = scope;
      scope.cursor = 0;
      const result = callback();
      scope.pending.splice(0).forEach(effect => effect());
      return result;
    },
    replayEffects(scope: Scope) {
      const effects = scope.slots.filter((slot): slot is Effect => (slot as Effect)?.kind === 'effect');
      effects.forEach(effect => effect.cleanup?.());
      effects.forEach(effect => { effect.cleanup = effect.setup() || undefined; });
    },
    unmount(scope: Scope) {
      scope.slots.forEach(slot => { if ((slot as Effect)?.kind === 'effect') (slot as Effect).cleanup?.(); });
      scope.slots = [];
    },
    reset() { scopes.splice(0).forEach(scope => this.unmount(scope)); },
    useRef(value: unknown) {
      const index = current.cursor++;
      return current.slots[index] ??= { current: value };
    },
    useState(initial: unknown) {
      const scope = current;
      const index = scope.cursor++;
      const state = scope.slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      const slot = state as { value: unknown };
      return [slot.value, (next: unknown) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useEffect(setup: () => void | (() => void), deps: unknown[]) {
      const scope = current;
      const index = scope.cursor++;
      const previous = scope.slots[index] as Effect | undefined;
      if (previous && deps.length === previous.deps.length && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return;
      scope.pending.push(() => {
        previous?.cleanup?.();
        scope.slots[index] = { kind: 'effect', deps, setup, cleanup: setup() || undefined };
      });
    },
  };
});
vi.mock('react', () => ({ useState: hooks.useState, useRef: hooks.useRef, useEffect: hooks.useEffect }));

import { useGuideNotebook } from '@/hooks/useGuideNotebook';
import { emptyNotebook, GUIDE_NOTEBOOK_KEY, parseGuideNotebook, updateGuideEntry } from '@/lib/guideNotebook';

const savedAt = Date.parse('2026-10-02T12:00:00Z');
const initial = updateGuideEntry(emptyNotebook(), 'inflation', { explanation: '물가의 비교 기간도 살펴봐요.', savedAt });
const values = new Map<string, string>();
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
const getItem = vi.fn((key: string) => values.get(key) ?? null);
const setItem = vi.fn((key: string, value: string) => { values.set(key, value); });
const render = (scope: ReturnType<typeof hooks.create>) => hooks.render(scope, useGuideNotebook);
function flushFrames() {
  const scheduled = [...frames.values()];
  frames.clear();
  scheduled.forEach(callback => callback(0));
}
function storageEvent(key: string | null) {
  const event = new Event('storage');
  Object.defineProperty(event, 'key', { value: key });
  window.dispatchEvent(event);
}

beforeEach(() => {
  vi.clearAllMocks();
  values.clear(); frames.clear(); frameId = 0;
  getItem.mockImplementation(key => values.get(key) ?? null);
  setItem.mockImplementation((key, value) => { values.set(key, value); });
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('localStorage', { getItem, setItem });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => { hooks.reset(); vi.unstubAllGlobals(); });

describe('guide notebook hook boundaries', () => {
  it('waits for storage restoration before allowing a write', () => {
    values.set(GUIDE_NOTEBOOK_KEY, JSON.stringify(initial));
    const scope = hooks.create();
    const loading = render(scope);
    expect(loading.ready).toBe(false);
    expect(loading.save('rates', { explanation: '금리', savedAt })).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    flushFrames();
    expect(render(scope)).toMatchObject({ ready: true, notebook: initial });
  });

  it('survives StrictMode effect setup/cleanup/setup with one active subscription', () => {
    values.set(GUIDE_NOTEBOOK_KEY, JSON.stringify(initial));
    const scope = hooks.create();
    render(scope);
    hooks.replayEffects(scope);
    expect(frames.size).toBe(1);
    flushFrames();
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(render(scope)).toMatchObject({ ready: true, notebook: initial });
    storageEvent(GUIDE_NOTEBOOK_KEY);
    expect(getItem).toHaveBeenCalledTimes(2);
  });

  it('does not restore or save old-account data after logout, including a captured save callback', () => {
    values.set(GUIDE_NOTEBOOK_KEY, JSON.stringify(initial));
    const scope = hooks.create();
    render(scope); flushFrames();
    const oldSave = render(scope).save;
    window.dispatchEvent(new Event('solb-user-storage-clearing'));
    // Delayed storage signals may still reference the previous account before removal completes.
    storageEvent(GUIDE_NOTEBOOK_KEY);
    window.dispatchEvent(new Event('joobi-guide-notebook-changed'));
    expect(render(scope)).toMatchObject({ ready: false, notebook: emptyNotebook() });
    expect(oldSave('inflation', { explanation: 'stale text', savedAt })).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('blocks a pending initial restore once account clearing starts', () => {
    values.set(GUIDE_NOTEBOOK_KEY, JSON.stringify(initial));
    const scope = hooks.create();
    render(scope);
    window.dispatchEvent(new Event('solb-user-storage-clearing'));
    flushFrames();
    expect(getItem).not.toHaveBeenCalled();
    expect(render(scope)).toMatchObject({ ready: false, notebook: emptyNotebook() });
  });

  it('allows reading the guide when storage is denied but reports a failed save', () => {
    getItem.mockImplementation(() => { throw new Error('storage denied'); });
    const changed = vi.fn();
    window.addEventListener('joobi-guide-notebook-changed', changed);
    const scope = hooks.create();
    render(scope); flushFrames();
    const current = render(scope);
    expect(current).toMatchObject({ ready: true, notebook: emptyNotebook() });
    expect(current.save('inflation', { explanation: '내 설명', savedAt })).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });

  it('preserves the previous visible note and sends no change event when a storage write fails', () => {
    values.set(GUIDE_NOTEBOOK_KEY, JSON.stringify(initial));
    const scope = hooks.create();
    render(scope); flushFrames();
    const changed = vi.fn();
    window.addEventListener('joobi-guide-notebook-changed', changed);
    setItem.mockImplementation(() => { throw new Error('quota exceeded'); });
    expect(render(scope).save('inflation', { explanation: '새 설명', savedAt })).toBe(false);
    expect(render(scope).notebook).toEqual(initial);
    expect(changed).not.toHaveBeenCalled();
  });

  it('merges another tab’s newer guide before saving and notifies other mounted readers', () => {
    values.set(GUIDE_NOTEBOOK_KEY, JSON.stringify(initial));
    const first = hooks.create(), second = hooks.create();
    render(first); render(second); flushFrames();
    const latest = updateGuideEntry(initial, 'rates', { explanation: '금리를 내린 이유', savedAt });
    values.set(GUIDE_NOTEBOOK_KEY, JSON.stringify(latest));
    expect(render(first).save('inflation', { checkCorrect: false, checkedAt: savedAt })).toBe(true);
    const stored = parseGuideNotebook(values.get(GUIDE_NOTEBOOK_KEY)!);
    expect(stored.entries.rates).toEqual(latest.entries.rates);
    expect(stored.entries.inflation).toEqual({ ...initial.entries.inflation, checkCorrect: false, checkedAt: savedAt });
    expect(render(second).notebook).toEqual(stored);
  });

  it('refreshes for relevant cross-tab updates and clearing, but not unrelated keys', () => {
    const scope = hooks.create();
    render(scope); flushFrames(); getItem.mockClear();
    storageEvent('unrelated');
    expect(getItem).not.toHaveBeenCalled();
    values.set(GUIDE_NOTEBOOK_KEY, JSON.stringify(initial));
    storageEvent(GUIDE_NOTEBOOK_KEY);
    expect(render(scope).notebook).toEqual(initial);
    values.clear(); storageEvent(null);
    expect(render(scope).notebook).toEqual(emptyNotebook());
  });

  it('cancels the pending restore and removes listeners when unmounted', () => {
    const scope = hooks.create();
    render(scope);
    hooks.unmount(scope);
    flushFrames();
    storageEvent(GUIDE_NOTEBOOK_KEY);
    window.dispatchEvent(new Event('joobi-guide-notebook-changed'));
    expect(getItem).not.toHaveBeenCalled();
  });
});
