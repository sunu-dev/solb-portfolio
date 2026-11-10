import { describe, expect, it } from 'vitest';
import { assistantNeedsArticles, assistantNeedsMarketEvidence, assistantStatusQuestion, type AssistantQuestion } from '@/lib/assistantQuestion';
import { resolveAssistantSubject } from '@/lib/assistantSubject';

const q = (text: string, symbol?: string, history: AssistantQuestion['history'] = []): AssistantQuestion => ({ text, symbol, unclearTerms: [], period: '1d', market: 'kr', history });
describe('근황 질문', () => {
  it.each([['이 회사 요즘 어때?', '005930.KS'], ['요즘 어때?', 'MU'], ['주가 어때?', 'NVDA'], ['요즘 시장 분위기 어때?', undefined], ['삼성전자 근황 알려줘', '005930.KS']])('%s looks up prices and news', (text, symbol) => {
    const question = q(text, symbol);
    expect(assistantStatusQuestion(question)).toBe(true);
    expect(assistantNeedsMarketEvidence(question)).toBe(true);
    // 기사가 없어도 답한다: 원인 질문처럼 기사 본문을 필수로 요구하지 않는다.
    expect(assistantNeedsArticles(question)).toBe(false);
  });
  it.each([['PER이 높으면 어때?', undefined], ['ETF는 뭐야?', '005930.KS'], ['이 종목을 쉽게 설명해 주세요', '005930.KS'], ['요즘 뜨는 종목 뭐야?', undefined], ['지금 사도 어때?', 'MU'], ['분할 매수하는 건 장기적으로 봤을 때 어때 보여?', 'MU']])('%s is not a status question', (text, symbol) => {
    expect(assistantStatusQuestion(q(text, symbol))).toBe(false);
  });
  it('reads 요즘 as the recent five sessions and keeps the follow-up connected', () => {
    const resolved = resolveAssistantSubject(q('삼성전자 요즘 어때?')).question;
    expect(resolved).toMatchObject({ symbol: '005930.KS', period: '5d' });
    const followUp = q('응 근데 그게 나한테 왜 중요해?', '005930.KS', [{ question: '삼성전자 요즘 어때?', answer: '최근 5거래일 동안 내렸어요.', symbol: '005930.KS', period: '5d' }]);
    expect(assistantNeedsMarketEvidence(followUp)).toBe(true);
  });
});
