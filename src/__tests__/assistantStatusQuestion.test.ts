import { describe, expect, it } from 'vitest';
import { assistantAsksAboutPriceMove, assistantNeedsArticles, assistantNeedsMarketEvidence, assistantPrincipleQuestion, assistantQuestionPrompt, assistantStatusQuestion, parseAssistantQuestion, type AssistantQuestion } from '@/lib/assistantQuestion';
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
  it.each(['이번 주에 왜 이렇게 움직였어요?', '며칠째 왜 이래요?', '이번 달에 무슨 일 있었어요?'])('%s 는 가격과 소식을 확인한다', text => {
    expect(assistantNeedsMarketEvidence(q(text, '035420.KS'))).toBe(true);
    expect(assistantNeedsArticles(q(text, '035420.KS'))).toBe(true);
  });
  it.each(['PER이 뭐야?', 'ETF는 주식과 뭐가 달라요?', '상한가가 무슨 뜻이에요?', '배당이 뭐예요?'])('%s 는 여전히 뜻풀이다', text => {
    expect(assistantNeedsMarketEvidence(q(text, '000660.KS'))).toBe(false);
  });
  // 초보자가 가장 자주 묻는 꼴. 오늘 일어난 일이 아니라 일반 원리를 묻는 말이라 시세·기사를 찾지 않는다.
  it.each([['금리가 오르면 왜 채권 가격이 떨어져?', undefined], ['금리가 오르면 채권 가격이 떨어지는 이유가 뭐야?', undefined], ['환율이 오르면 수출 기업에 좋은 이유가 뭐예요?', undefined],
    ['금리가 오르면 주가가 왜 떨어져요?', '005930.KS'], ['실적이 좋으면 왜 주가가 올라?', '005930.KS'], ['배당락일에 가격이 떨어지는 원인이 뭐예요?', '005930.KS'], ['금리가 오를 때 왜 주가가 떨어져?', undefined],
    ['PER이 높으면 왜 비싸다고 해?', undefined], ['공매도가 늘면 주가가 왜 떨어져?', undefined], ['유상증자를 하면 왜 주가가 떨어져요?', '005930.KS'], ['금리를 인하하면 어떤 영향이 있어?', undefined], ['환율이 오르면 어떻게 돼?', undefined],
    ['배당을 주면 왜 주가가 떨어져?', '005930.KS'], ['돈을 풀면 왜 주가가 올라?', undefined], ['회사가 자사주를 사면 왜 주가가 올라?', '005930.KS'], ['금리가 오르면, 왜 채권 가격이 떨어져?', undefined], ['금리 인상 시 채권 가격이 떨어지는 이유는?', undefined],
  ])('%s 는 원리를 묻는 말이라 시세와 기사를 찾지 않는다', (text, symbol) => {
    const question = q(text, symbol);
    expect(assistantPrincipleQuestion(text)).toBe(true);
    expect(assistantNeedsMarketEvidence(question)).toBe(false);
    expect(assistantNeedsArticles(question)).toBe(false);
  });
  it.each(['ETF 가격이 순자산가치와 차이 나는 이유가 뭐야?', '배당락일에 가격이 떨어지는 원인이 뭐예요?', '채권 시장에서 가격이 떨어지는 이유가 뭐야?'])('%s 는 종목 없이 물으면 뜻풀이다', text => {
    expect(assistantNeedsMarketEvidence(q(text))).toBe(false);
  });
  it.each([['코스피랑 비교하면 왜 더 떨어졌어?', '005930.KS'], ['그러면 왜 떨어진 거야?', '005930.KS'], ['실적이 좋은데 왜 떨어졌어?', '005930.KS'], ['오늘 금리가 오르면서 왜 떨어졌어?', '005930.KS'],
    ['계속 떨어지는 이유가 뭐야?', '005930.KS'], ['코스피가 빠지는 이유가 뭐야?', undefined], ['시장이 떨어지는 이유가 뭐야?', undefined], ['계속 밀리는 이유가 뭐야?', '005930.KS'],
    ['왜 떨어져?', '005930.KS'], ['오늘 왜 이렇게 빠져요?', '005930.KS'], ['어제 급락한 이유 알려줘', '005930.KS'], ['요즘 왜 이렇게 올라?', '005930.KS'], ['주가가 떨어지는 이유가 뭐야?', '005930.KS'],
    // 2026-11-12 재검토: 지금 보고 있는 종목·시장의 일을 가리키는 말은 조건문 꼴이어도 실제 움직임 질문이다.
    ['실적 발표 때 왜 이렇게 빠져?', '005930.KS'], ['장 시작할 때 왜 이렇게 떨어져?', '005930.KS'], ['이 회사는 실적 발표하면 왜 맨날 떨어져?', '005930.KS'], ['환율이 오르면 왜 이 주식이 떨어지는 거야?', '005930.KS'], ['오르면 왜 다시 떨어져?', '005930.KS'],
    ['지금 떨어지는 이유가 뭐야?', undefined], ['요즘 계속 빠지는 이유가 뭐야?', undefined], ['이렇게 오르는 이유가 뭐야?', undefined],
  ])('%s 는 실제로 움직인 이유를 묻는 말이다', (text, symbol) => {
    expect(assistantPrincipleQuestion(text)).toBe(false);
    expect(assistantNeedsMarketEvidence(q(text, symbol))).toBe(true);
  });
  it('asks for the principle itself, without a note about missing articles', () => {
    expect(assistantQuestionPrompt(q('금리가 오르면 왜 채권 가격이 떨어져?'), {})).toContain('일반 원리를 묻는 질문이에요');
    expect(assistantQuestionPrompt(q('ETF가 뭐야?'), {})).not.toContain('일반 원리를 묻는 질문이에요');
  });
  it('keeps a follow-up to a principle question on the concept path', () => {
    const history = [{ question: '금리가 오르면 왜 채권 가격이 떨어져?', answer: '새 채권이 이자를 더 주기 때문이에요.' }];
    for (const text of ['그럼 주식은 어떻게 돼?', '네', '예를 하나 들어줘']) {
      expect(assistantNeedsMarketEvidence(q(text, undefined, history))).toBe(false);
      expect(assistantNeedsArticles(q(text, undefined, history))).toBe(false);
    }
    // 실제 움직임을 물은 앞 질문은 그대로 이어진다.
    expect(assistantNeedsMarketEvidence(q('그게 나한테 왜 중요해?', '005930.KS', [{ question: '삼성전자 오늘 왜 떨어졌어?', answer: '전 거래일보다 내렸어요.' }]))).toBe(true);
  });
  it('does not take a pointer to an earlier moment for a general principle', () => {
    for (const text of ['그때 왜 그래?', '이럴 때 왜 떨어졌어?', '비교하면 왜 이래?', '내일 왜 오를까?', '반면 삼성전자는 왜 떨어져?', '그렇다면 왜 떨어져?', '그러면 왜 그래?', '이런 측면 왜 중요해?']) expect(assistantPrincipleQuestion(text)).toBe(false);
  });
  it.each(['배당은 어때요?', '장기 투자로 어때?', 'PER은 어때?'])('%s 는 최근 가격을 묻는 말이 아니라서 등락률을 앞세우지 않는다', text => {
    const question = q(text, '005930.KS');
    expect(assistantStatusQuestion(question)).toBe(false);
    expect(assistantAsksAboutPriceMove(question)).toBe(false);
  });
  it('lets a one-character reply through only inside a conversation', () => {
    const body = { questionConsent: true, questionText: '네', symbol: '005930.KS', historySymbol: '005930.KS' };
    expect(parseAssistantQuestion(body)).toBeNull();
    const history = [{ question: '지금 사도 될까?', answer: '이 돈을 1년 안에 써야 하나요?', symbol: '005930.KS' }];
    expect(parseAssistantQuestion({ ...body, questionHistory: history })?.text).toBe('네');
    // 그 한 글자 답이 다음 질문의 대화 기록에 실려도 거절하지 않는다.
    expect(parseAssistantQuestion({ ...body, questionText: '3년은 안 써요', questionHistory: [...history, { question: '네', answer: '그렇다면 오래 묶어둘 수 있는 돈인지부터 보면 돼요.', symbol: '005930.KS' }] })?.history).toHaveLength(2);
    expect(parseAssistantQuestion({ ...body, questionText: '', questionHistory: history })).toBeNull();
    // 한 글자 예외는 예·아니요 대답에만 열려 있다.
    for (const text of ['?', 'ㅋ', '왜', '아']) expect(parseAssistantQuestion({ ...body, questionText: text, questionHistory: history })).toBeNull();
    expect(parseAssistantQuestion({ ...body, questionText: '응', questionHistory: history })?.text).toBe('응');
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

