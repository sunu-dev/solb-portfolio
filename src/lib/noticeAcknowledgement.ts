// Public notice IDs only; no questions, holdings, account identifiers or analytics.
export const NOTICE_ACK_KEY = 'joobi-notice-ack-v1';
const EVENT = 'joobi-notice-ack-changed';
const valid = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9-]{1,100}$/.test(id);
function readIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(NOTICE_ACK_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter(valid).slice(-40) : [];
  } catch { return []; }
}
export const isNoticeAcknowledged = (id?: string) => !!id && readIds().includes(id);
export function acknowledgeNotice(id: string): boolean {
  if (typeof window === 'undefined' || !valid(id)) return false;
  try { window.localStorage.setItem(NOTICE_ACK_KEY, JSON.stringify([...new Set([...readIds(), id])].slice(-40))); }
  catch { return false; }
  window.dispatchEvent(new Event(EVENT));
  return true;
}
export function subscribeNoticeAcknowledgement(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  const storage = (event: StorageEvent) => { if (event.key === NOTICE_ACK_KEY || event.key === null) onChange(); };
  window.addEventListener(EVENT, onChange); window.addEventListener('storage', storage);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener('storage', storage); };
}
