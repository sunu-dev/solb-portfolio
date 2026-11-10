import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { CASE_CONSENT_VERSION, containsPrivateDetails, parseQualityCase, qualityOutcome, qualityTopic, type QualityEvent } from '@/lib/assistantQuality';
import { signQualityReceipt, verifyQualityReceipt } from '@/lib/assistantQualityServer';

afterEach(() => vi.unstubAllEnvs());
const event = (): QualityEvent => ({ id: randomUUID(), created_at: new Date().toISOString(), topic: 'average_down', asset: 'leveraged', model: 'sonnet', version: 'test', outcome: 'ready', failure: 'none', duration_ms: 1200, sources_ms: 200, generation_ms: 1000 });
describe('minimal question quality collection', () => {
  it.each([
    ['오늘 왜 이렇게 떨어져?', 'price_reason'], ['나 이거 더 사도될까?', 'buy_more'], ['물타는건 어떻게 생각해?', 'average_down'],
    ['언제 팔까?', 'sell_timing'], ['언제 살까?', 'buy_timing'], ['요새 뜨는 종목은 뭐야?', 'trending'], ['ETF가 뭐야?', 'definition'],
  ])('classifies %s without returning original text', (text, topic) => expect(qualityTopic({ text })).toBe(topic));
  it('retains short decision followup context', () => expect(qualityTopic({ text: '6개월 정도', history: [{ question: '물타도 될까?' }] })).toBe('average_down'));
  it('separates generated answers, guard failures, quota failures and source failures', () => {
    expect(qualityOutcome(200, null).outcome).toBe('ready');
    expect(qualityOutcome(502, 'invalid_chart_explanation')).toEqual({ outcome: 'blocked', failure: 'validation' });
    expect(qualityOutcome(503, 'assistant_articles_unavailable').failure).toBe('sources');
    expect(qualityOutcome(503, 'usage_record_failed').failure).toBe('usage');
    expect(qualityOutcome(429, 'daily_user_limit').outcome).toBe('limited');
    expect(qualityOutcome(500, 'private error message')).toEqual({ outcome: 'failed', failure: 'other' });
  });
  it('binds a receipt to its account and rejects tampering / expiry', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key-not-production');
    const value = event(), receipt = signQualityReceipt(value, 'alice')!;
    expect(verifyQualityReceipt(receipt, 'alice')).toEqual(value);
    expect(verifyQualityReceipt(receipt, 'bob')).toBeNull();
    expect(verifyQualityReceipt(receipt.replace(/^./, 'x'), 'alice')).toBeNull();
    expect(verifyQualityReceipt(receipt, 'alice', Date.now() + 31 * 86400_000)).toBeNull();
    expect(JSON.stringify(value)).not.toMatch(/user_id|question|answer|ip|symbol/);
    expect(Buffer.from(receipt.split('.')[0], 'base64url').toString()).not.toContain('alice');
  });
  it('fails closed without a signing secret', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', ''); vi.stubEnv('SUPABASE_SERVICE_KEY', '');
    expect(signQualityReceipt(event(), 'alice')).toBeUndefined(); expect(verifyQualityReceipt('fake', 'alice')).toBeNull();
  });
  it('accepts only explicit current-version consent, exact question and answer fields', () => {
    const body = { question: 'ETF가 뭐예요?', answer: '주식처럼 사고파는 투자 상품이에요.', consent: true, consentVersion: CASE_CONSENT_VERSION, history: ['private'], shares: 100 };
    expect(parseQualityCase(body)).toEqual({ question: body.question, answer: body.answer, consent_version: CASE_CONSENT_VERSION });
    expect(parseQualityCase({ ...body, consent: false })).toBeNull();
    expect(parseQualityCase({ ...body, consentVersion: 'old' })).toBeNull();
    expect(parseQualityCase({ ...body, question: 'a'.repeat(601) })).toBeNull();
  });
  it.each(['메일 test@example.com', '010-1234-5678', '123456-1234567', '계좌: 123456789012', 'sk-abcdefgh12345678'])('rejects obvious private details: %s', text => {
    expect(containsPrivateDetails(text)).toBe(true);
    expect(parseQualityCase({ question: text, answer: '테스트 설명', consent: true, consentVersion: CASE_CONSENT_VERSION })).toBeNull();
  });
  it('does not reject ordinary price and period explanations', () => expect(containsPrivateDetails('6개월 생각해요. 2배 상품이고 오늘 10.5% 내렸어요.')).toBe(false));
});
