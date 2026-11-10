import { describe, expect, it, vi } from 'vitest';
import { createConversationStore, type ConversationAnswer } from '@/lib/joobiConversation';
import { assistantFollowUpStyle, assistantNeedsArticles, assistantNeedsMarketEvidence } from '@/lib/assistantQuestion';
import { companyNewsIdentity } from '@/lib/companyNewsIdentity';

const answer = (i: number): ConversationAnswer => ({ turnId: i, question: `질문 ${i}`, symbol: 'MU', currentStatus: `답변 ${i}`, keyAdvice: [], conclusion: { desc: '' } });
describe('tab conversation ownership and continuity', () => {
  it('carries an unsent question to a selected stock without replacing its existing draft or copying history', () => {
    const store = createConversationStore();
    store.update('GENERAL:kr:1d', () => ({ question: '왜 떨어졌어?', answers: [answer(0)] }));
    store.copyDraft('GENERAL:kr:1d', 'MU:kr:1d');
    expect(store.get('MU:kr:1d')).toEqual({ question: '왜 떨어졌어?', answers: [] });
    store.update('SOXL:kr:1d', () => ({ question: '배수가 뭐야?', answers: [] }));
    store.copyDraft('GENERAL:kr:1d', 'SOXL:kr:1d');
    expect(store.get('SOXL:kr:1d').question).toBe('배수가 뭐야?');
    expect(store.get('GENERAL:kr:1d').question).toBe('왜 떨어졌어?');
  });
  it('shares draft and answers across entries without mixing companies or periods', () => {
    const store = createConversationStore(); const listener = vi.fn(); const release = store.subscribe(listener);
    store.update('MU:us:1d', () => ({ question: '그러면요?', answers: [answer(0)] }));
    expect(store.get('MU:us:1d').question).toBe('그러면요?');
    expect(store.get('MU:us:1w').answers).toEqual([]);
    expect(store.get('SOXL:us:1d').answers).toEqual([]);
    expect(listener).toHaveBeenCalledOnce(); release();
    store.clear('MU:us:1d'); expect(store.get('MU:us:1d').question).toBe('');
    expect(listener).toHaveBeenCalledOnce();
  });
  it('limits visible turns independently of the three-turn API context and clears the owner scope', () => {
    const a = createConversationStore(), b = createConversationStore();
    a.update('MU:us:1d', () => ({ question: '', answers: Array.from({ length: 25 }, (_, i) => answer(i)) }));
    expect(a.get('MU:us:1d').answers).toHaveLength(20);
    expect(a.get('MU:us:1d').answers[0].turnId).toBe(5);
    expect(b.get('MU:us:1d').answers).toEqual([]);
    a.clear(); expect(a.get('MU:us:1d').answers).toEqual([]);
  });
});

describe('follow-up intent', () => {
  const history = [{ question: '오늘 마이크론은 왜 떨어졌어?', answer: '금리 우려와 반도체 수요를 비교해야 해요.' }];
  it('re-explains the prior answer without starting another market/news search', () => {
    for (const [text, style] of [['더 쉽게 설명해 줘', 'simpler'], ['예를 들어 설명해 줘', 'example']] as const) {
      const question = { text, history, unclearTerms: [] };
      expect(assistantFollowUpStyle(question)).toBe(style);
      expect(assistantNeedsMarketEvidence(question)).toBe(false);
      expect(assistantNeedsArticles(question)).toBe(false);
    }
  });
  it('still gathers facts for a new market question and ambiguous causal follow-up', () => {
    expect(assistantFollowUpStyle({ text: '오늘 주가가 왜 떨어졌는지 더 쉽게 설명해 줘', history, unclearTerms: [] })).toBeNull();
    expect(assistantNeedsArticles({ text: '그러면 왜 그런 거야?', history, unclearTerms: [] })).toBe(true);
    expect(assistantFollowUpStyle({ text: '더 쉽게 설명해 줘', unclearTerms: [] })).toBeNull();
  });
});

describe('issuer identity in Korean headlines', () => {
  it('rejects Hana Micron while accepting Micron, its full name and Korean particles', () => {
    const identity = companyNewsIdentity('MU');
    for (const title of ['하나마이크론 주가 급등', '하나마이크론은 수주 확대', '하나마이크론의 실적']) expect(identity.matches(title)).toBe(false);
    for (const title of ['마이크론 주가 하락', '마이크론은 수요 증가', '마이크론의 전망', '마이크론테크놀로지 실적', 'Micron earnings', '(MU) 실적']) expect(identity.matches(title)).toBe(true);
  });
  it('does not confuse an issuer with an affiliated company', () => {
    const identity = companyNewsIdentity('005930.KS');
    expect(identity.matches('삼성전자서비스 채용')).toBe(false);
    expect(identity.matches('삼성전자는 투자 확대')).toBe(true);
  });
});
