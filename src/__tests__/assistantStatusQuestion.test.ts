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

describe('질문을 엉뚱한 종류로 보내지 않는다', () => {
  it.each(['하이닉스 급등한 이유가 뭐야?', '뭐 때문에 내렸어?', '떨어진 원인이 뭐예요?', '오늘 올랐는데 배경이 뭐야?'])('%s 는 뜻풀이가 아니라 가격이 움직인 이유를 묻는 말이다', text => {
    const question = q(text, '000660.KS');
    expect(assistantNeedsMarketEvidence(question)).toBe(true);
    expect(assistantNeedsArticles(question)).toBe(true);
  });
  it.each(['PER이 뭐야?', 'ETF는 주식과 뭐가 달라요?', '상한가가 무슨 뜻이에요?', '배당이 뭐예요?'])('%s 는 여전히 뜻풀이다', text => {
    expect(assistantNeedsMarketEvidence(q(text, '000660.KS'))).toBe(false);
  });
  it('keeps a buy or sell question on the stock being viewed after a detour about the market', () => {
    const history = [{ question: '오늘 왜 움직였어요?', answer: '전 거래일보다 올랐어요.', symbol: '035420.KS', market: 'kr' as const, period: '1d' as const },
      { question: '그럼 코스피랑 비교하면 어때요?', answer: '코스피가 더 올랐어요.', symbol: 'GENERAL', market: 'kr' as const, period: '1d' as const }];
    expect(resolveAssistantSubject(q('그럼 지금 더 사도 될까요?', '035420.KS', history)).question.symbol).toBe('035420.KS');
    expect(resolveAssistantSubject(q('언제 팔아야 해요?', '035420.KS', history)).question.symbol).toBe('035420.KS');
    // Without a stock on screen there is nothing to fall back to, and a follow-up about the market stays on the market.
    expect(resolveAssistantSubject(q('그럼 지금 더 사도 될까요?', undefined, history.slice(1))).question.symbol).toBeUndefined();
    expect(resolveAssistantSubject(q('그럼 내일은 어떨까요?', '035420.KS', history)).question.symbol).toBeUndefined();
  });
});

