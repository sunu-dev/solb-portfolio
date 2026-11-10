/** 로그인 전에 적은 질문을 로그인 이동(새로고침) 뒤에도 입력창에 돌려준다.
 * 이 탭의 sessionStorage에만 잠시 두고, 한 번 꺼내면 지운다. 서버로 보내거나 자동 전송하지 않는다. */
const KEY = 'joobi_pending_question_v1';
const MAX_AGE_MS = 15 * 60_000;
export interface PendingQuestion { text: string; symbol?: string }

function read(now: number): PendingQuestion | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (!value || typeof value.text !== 'string' || typeof value.at !== 'number' || now - value.at > MAX_AGE_MS || now < value.at) return null;
    const text = value.text.slice(0, 600);
    if (text.trim().length < 2) return null;
    return { text, ...(typeof value.symbol === 'string' && /^[A-Z0-9^.=-]{1,32}$/i.test(value.symbol) ? { symbol: value.symbol } : {}) };
  } catch { return null; }
}
export function savePendingQuestion(text: string, symbol?: string, now = Date.now()) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ text: text.slice(0, 600), symbol, at: now })); } catch { /* Private mode: the draft simply is not restored. */ }
}
export function peekPendingQuestion(now = Date.now()): PendingQuestion | null {
  if (typeof window === 'undefined') return null;
  return read(now);
}
export function takePendingQuestion(now = Date.now()): PendingQuestion | null {
  if (typeof window === 'undefined') return null;
  const value = read(now);
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  return value;
}
export function clearPendingQuestion() { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } }
