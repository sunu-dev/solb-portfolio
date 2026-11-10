import { DEFAULT_JOOBI_CHARACTER, isJoobiCharacter, type JoobiCharacter } from '@/config/joobiCharacters';

// Browser appearance preference, like a theme. No account or investment data.
export const JOOBI_CHARACTER_STORAGE_KEY = 'joobi-character-v1';
const CHANGE_EVENT = 'joobi-character-change';

export function getServerJoobiCharacter(): JoobiCharacter {
  return DEFAULT_JOOBI_CHARACTER;
}

export function readJoobiCharacter(): JoobiCharacter {
  if (typeof window === 'undefined') return DEFAULT_JOOBI_CHARACTER;
  try {
    const value = window.localStorage.getItem(JOOBI_CHARACTER_STORAGE_KEY);
    return isJoobiCharacter(value) ? value : DEFAULT_JOOBI_CHARACTER;
  } catch {
    return DEFAULT_JOOBI_CHARACTER;
  }
}

/** Change the appearance only after persistence succeeds. Never claim a failed save worked. */
export function saveJoobiCharacter(value: JoobiCharacter): boolean {
  if (typeof window === 'undefined' || !isJoobiCharacter(value)) return false;
  try {
    window.localStorage.setItem(JOOBI_CHARACTER_STORAGE_KEY, value);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

export function subscribeJoobiCharacter(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    try {
      if (event.storageArea === window.localStorage &&
        (event.key === JOOBI_CHARACTER_STORAGE_KEY || event.key === null)) onChange();
    } catch { /* Storage can be disabled while this page is open. */ }
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
