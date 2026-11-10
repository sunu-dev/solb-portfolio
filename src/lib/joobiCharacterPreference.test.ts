import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getServerJoobiCharacter, JOOBI_CHARACTER_STORAGE_KEY, readJoobiCharacter, saveJoobiCharacter, subscribeJoobiCharacter } from './joobiCharacterPreference';

describe('Joobi character browser preference', () => {
  let target: EventTarget;
  let storage: Storage;

  beforeEach(() => {
    const values = new Map<string, string>();
    storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: key => { values.delete(key); },
      clear: () => values.clear(),
      key: index => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    };
    target = Object.assign(new EventTarget(), { localStorage: storage });
    vi.stubGlobal('window', target);
  });

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('starts with F sprout and restores D dog from saved browser storage after a module reload', async () => {
    expect(readJoobiCharacter()).toBe('sprout');
    expect(saveJoobiCharacter('dog')).toBe(true);
    vi.resetModules();
    const reloaded = await import('./joobiCharacterPreference');
    expect(reloaded.readJoobiCharacter()).toBe('dog');
    expect(reloaded.saveJoobiCharacter('sprout')).toBe(true);
    expect(storage.getItem(JOOBI_CHARACTER_STORAGE_KEY)).toBe('sprout');
  });

  it('updates all open views immediately and removes listeners when a view closes', () => {
    const first = vi.fn(() => readJoobiCharacter());
    const second = vi.fn();
    const closeFirst = subscribeJoobiCharacter(first);
    const closeSecond = subscribeJoobiCharacter(second);
    saveJoobiCharacter('dog');
    expect(first).toHaveReturnedWith('dog');
    expect(second).toHaveBeenCalledTimes(1);
    closeFirst();
    saveJoobiCharacter('sprout');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    closeSecond();
  });

  it('reflects another tab changing or clearing this preference, ignoring other storage', () => {
    const changed = vi.fn();
    const stop = subscribeJoobiCharacter(changed);
    const event = (key: string | null, storageArea = storage) => {
      target.dispatchEvent(Object.assign(new Event('storage'), { key, storageArea }));
    };
    storage.setItem(JOOBI_CHARACTER_STORAGE_KEY, 'dog');
    event('unrelated');
    event(JOOBI_CHARACTER_STORAGE_KEY, {} as Storage);
    expect(changed).not.toHaveBeenCalled();
    event(JOOBI_CHARACTER_STORAGE_KEY);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(readJoobiCharacter()).toBe('dog');
    storage.clear();
    event(null);
    expect(changed).toHaveBeenCalledTimes(2);
    expect(readJoobiCharacter()).toBe('sprout');
    stop();
  });

  it('keeps the previous character and reports failure when saving is blocked', () => {
    saveJoobiCharacter('dog');
    const changed = vi.fn();
    const stop = subscribeJoobiCharacter(changed);
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(saveJoobiCharacter('sprout')).toBe(false);
    expect(readJoobiCharacter()).toBe('dog');
    expect(changed).not.toHaveBeenCalled();
    stop();
  });

  it('falls back safely for retired, malformed or unavailable stored values', () => {
    for (const value of ['owl', 'null', '{"character":"dog"}']) {
      storage.setItem(JOOBI_CHARACTER_STORAGE_KEY, value);
      expect(readJoobiCharacter()).toBe('sprout');
    }
    vi.spyOn(storage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readJoobiCharacter()).toBe('sprout');
  });

  it('uses the same default for server rendering and the first hydration snapshot', () => {
    saveJoobiCharacter('dog');
    expect(getServerJoobiCharacter()).toBe('sprout');
    vi.stubGlobal('window', undefined);
    expect(readJoobiCharacter()).toBe('sprout');
    expect(saveJoobiCharacter('dog')).toBe(false);
    expect(() => subscribeJoobiCharacter(() => {})()).not.toThrow();
  });
});
