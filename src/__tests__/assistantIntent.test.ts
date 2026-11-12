import { expect, it, vi, afterEach } from 'vitest';
import { assistantIntent, assistantConversationIntent, assistantDecisionPrompt, assistantShortReply } from '@/lib/assistantIntent';
import { assistantQuestionPrompt, assistantNeedsMarketEvidence, assistantNeedsArticles, assistantGenerationModel } from '@/lib/assistantQuestion';
afterEach(() => vi.unstubAllEnvs());
it.each([
  ['오늘 왜이렇게 떨어져?', 'explain'],
  ['나 이거 더 사도될끼?', 'buy_more'],
  ['물타는건 어떻게 생각해?', 'average_down'],
  ['요새 뜨는 종목은뭐야?', 'trending'],
  ['언제팔까?', 'sell_timing'],
  ['언제 살까?', 'buy_timing'],
  ['물타기가 뭐야?', 'explain'],
  ['지금 들어가도 돼?', 'buy_timing'],
  ['지금 들어가기 어때?', 'buy_timing'],
  ['매수 타이밍 언제야?', 'buy_timing'],
  ['지금 들어가 있는데 왜 떨어져?', 'explain'],
  ['데이터센터에 들어가는 메모리가 뭐야?', 'explain'],
  // 2026-11-12 재검토: 회사의 시장 진입, 지수 편입, '회사도'의 '사도'는 살지 묻는 말이 아니다.
  ['중국 시장 진입할까?', 'explain'],
  ['시장 진입 시점이 언제였어?', 'explain'],
  ['이 종목 코스피200에 이제 들어가면 주가 어떻게 돼?', 'explain'],
  ['이 회사도 배당 줘?', 'explain'],
  ['경쟁사도 떨어졌어?', 'explain'],
  ['지금 진입해도 돼?', 'buy_timing'],
  ['삼성전자 사도 될까?', 'buy_timing'],
  ['사도 괜찮아?', 'buy_timing'],
  ['지금 사도 늦지 않았어?', 'buy_timing'],
] as const)('routes novice wording %s to %s', (text, intent) => expect(assistantIntent(text)).toBe(intent));
it('retains a short answer to the previous planning question but respects a new topic', () => {
  const history = [{ question: '더 사도 돼?' }];
  expect(assistantConversationIntent({ text: '6개월 정도', history })).toBe('buy_more');
  expect(assistantConversationIntent({ text: 'ETF가 뭐야?', history })).toBe('explain');
  expect(assistantConversationIntent({ text: '언제 팔까?', history })).toBe('sell_timing');
  // 주비가 되물은 말에 답한 한마디도 앞 질문의 주제를 이어간다.
  for (const reply of ['네', '응', '아니요', '맞아요', 'ㅇㅇ']) expect(assistantConversationIntent({ text: reply, history })).toBe('buy_more');
  expect(assistantConversationIntent({ text: '네' })).toBe('explain');
  expect(assistantConversationIntent({ text: '네 근데 PER이 뭐야?', history })).toBe('explain');
  expect(assistantConversationIntent({ text: '네?', history })).toBe('explain');
});
it('asks for the missing security without paying for unrelated market retrieval', () => {
  const q = { text: '더 사도 돼?', unclearTerms: [] };
  expect(assistantNeedsMarketEvidence(q)).toBe(false);
  expect(assistantNeedsArticles(q)).toBe(false);
  vi.stubEnv('JOOBI_ASSISTANT_REASONING_MODEL', 'claude-sonnet-5-5');
  expect(assistantGenerationModel(q)).toBe('claude-sonnet-5-5');
  expect(assistantQuestionPrompt(q, {})).toContain('어떤 종목인지 한 가지만');
  expect(assistantNeedsArticles({ ...q, symbol: 'MUU' })).toBe(true);
});
it('keeps averaging down distinct from scheduled investment and does not assume holdings', () => {
  const prompt = assistantQuestionPrompt({ text: '물타도 돼?', symbol: 'MUU', unclearTerms: [] }, {});
  expect(prompt).toContain('적립식 투자와 동일시하지');
  expect(prompt).toContain('수량·평균 매수가·투자 비중·현금·목표를 알고 있다고 가정하지');
  expect(prompt).not.toContain('첫 문장: 출처 이름');
});
it('does not promise a popularity ranking from ordinary news evidence', () => {
  const q = { text: '요즘 뜨는 종목 뭐야?', unclearTerms: [] };
  expect(assistantNeedsArticles(q)).toBe(false);
  expect(assistantQuestionPrompt(q, {})).toContain('전체 시장 인기 순위나 거래량 순위가 없어요');
});

it('tells the model how to take a one-word reply to its own question', () => {
  for (const reply of ['네', '응', '아니요', '맞아요', '네!']) expect(assistantShortReply(reply)).toBe(true);
  // "네?" is a puzzled re-ask, not a yes; acknowledgements are not answers either.
  for (const text of ['네 근데 왜요?', '1년 정도요', '네이버 어때?', '아니 그게 아니라', '네?', '그래?', '알겠어요', '아하', '좋아요']) expect(assistantShortReply(text)).toBe(false);
  const history = [{ question: '더 사도 돼?', answer: '이 돈을 1년 안에 써야 하나요?' }];
  expect(assistantDecisionPrompt({ text: '네', symbol: 'MU', history }, 'buy_more', {}, undefined)).toContain('직전에 물은 것에 대한 짧은 대답');
  expect(assistantDecisionPrompt({ text: '더 사도 돼?', symbol: 'MU' }, 'buy_more', {}, undefined)).not.toContain('직전에 물은 것에 대한 짧은 대답');
});
