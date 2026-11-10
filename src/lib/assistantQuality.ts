import { assistantConversationIntent } from './assistantIntent';

export const QUALITY_VERSION = '2026-11-07-v1';
export const CASE_CONSENT_VERSION = '2026-11-07-case-v1';
export const QUALITY_TOPICS = {
  price_reason: '주가가 움직인 이유', buy_more: '추가 매수', average_down: '물타기',
  buy_timing: '매수 시점', sell_timing: '매도 시점', trending: '관심 종목 찾기',
  definition: '용어 설명', explain: '그 밖의 설명',
} as const;
export const QUALITY_REASONS = {
  unrelated: '질문과 달라요', insufficient: '내용이 부족해요', difficult: '어려워요',
  incorrect: '사실과 달라요', slow: '너무 오래 걸려요',
} as const;
export type QualityTopic = keyof typeof QUALITY_TOPICS;
export type QualityReason = keyof typeof QUALITY_REASONS;
export function qualityTopic(question: { text: string; history?: { question: string }[] }): QualityTopic {
  const intent = assistantConversationIntent(question);
  if (intent !== 'explain') return intent;
  const text = question.text.replace(/\s/g, '');
  if (/왜.*(?:떨어|내려|하락|올라|상승|급락|급등)|(?:떨어|하락|상승|급락|급등).*이유/.test(text)) return 'price_reason';
  if (/뭐야|뭔가요|뭔데|무엇|무슨뜻|뜻이|뭐예요/.test(text)) return 'definition';
  return 'explain';
}

/** No free text, account identifier, ticker, IP, or history belongs in this row. */
export interface QualityEvent {
  id: string; created_at: string; topic: QualityTopic; asset: 'market' | 'stock' | 'fund' | 'leveraged';
  model: 'sonnet' | 'haiku' | 'other' | 'none'; version: string;
  outcome: 'ready' | 'blocked' | 'failed' | 'limited'; failure: 'none' | 'validation' | 'sources' | 'usage' | 'limit' | 'other';
  duration_ms: number; sources_ms: number; generation_ms: number;
}
export function qualityOutcome(status: number, code: unknown): Pick<QualityEvent, 'outcome' | 'failure'> {
  if (status >= 200 && status < 300) return { outcome: 'ready', failure: 'none' };
  if (status === 429) return { outcome: 'limited', failure: 'limit' };
  if (typeof code === 'string' && /^invalid_(?:user_answer|chart_explanation|ai_response)$/.test(code)) return { outcome: 'blocked', failure: 'validation' };
  if (code === 'assistant_sources_unavailable' || code === 'assistant_articles_unavailable') return { outcome: 'failed', failure: 'sources' };
  if (code === 'usage_record_failed') return { outcome: 'failed', failure: 'usage' };
  return { outcome: 'failed', failure: 'other' };
}

/** A second barrier, not a claim that all personal information can be detected. */
export function containsPrivateDetails(text: string): boolean {
  return /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+82|0\d{1,2})[- .]?\d{3,4}[- .]?\d{4}|\d{6}[- ]?[1-4]\d{6}|(?:\d[- ]?){10,}|(?:sk-|sb_secret_|Bearer\s)[A-Za-z0-9_-]{10,}|(?:계좌|비밀번호|인증번호|주소|연락처)\s*[:：=]\s*\S+/i.test(text);
}
export function parseQualityCase(body: unknown): { question: string; answer: string; consent_version: string } | null {
  if (!body || typeof body !== 'object') return null;
  const value = body as Record<string, unknown>;
  if (value.consent !== true || value.consentVersion !== CASE_CONSENT_VERSION || typeof value.question !== 'string' || typeof value.answer !== 'string') return null;
  const question = value.question.trim(), answer = value.answer.trim();
  if (question.length < 2 || question.length > 600 || answer.length < 2 || answer.length > 5000 || containsPrivateDetails(`${question}\n${answer}`)) return null;
  return { question, answer, consent_version: CASE_CONSENT_VERSION };
}
