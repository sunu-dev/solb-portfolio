import { expect, it, vi, afterEach } from 'vitest';
import { assistantIntent, assistantConversationIntent } from '@/lib/assistantIntent';
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
] as const)('routes novice wording %s to %s', (text, intent) => expect(assistantIntent(text)).toBe(intent));
it('retains a short answer to the previous planning question but respects a new topic', () => {
  const history = [{ question: '더 사도 돼?' }];
  expect(assistantConversationIntent({ text: '6개월 정도', history })).toBe('buy_more');
  expect(assistantConversationIntent({ text: 'ETF가 뭐야?', history })).toBe('explain');
  expect(assistantConversationIntent({ text: '언제 팔까?', history })).toBe('sell_timing');
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
