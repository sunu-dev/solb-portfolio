import { expect, it } from 'vitest';
import { assistantConversationIntent } from '@/lib/assistantIntent';
import { assistantFollowUpStyle, assistantQuestionPrompt, assistantNeedsArticles, assistantNeedsMarketEvidence } from '@/lib/assistantQuestion';

const history = [
  { question: '마이크론은 왜 움직였어?', answer: '첫 질문의 과거 시장 설명' },
  { question: '그럼 지금 더 사도 될까?', answer: '같은 종목에 돈이 더 몰려요. 먼저 산 이유가 유지되는지 확인해요.' },
];
const base = { symbol: 'MU', unclearTerms: [], history };
const example = '아직 어려워. 예를 하나 들어서, 내가 먼저 확인할 것부터 설명해 줘.';

it.each([
  ['더 쉽게 설명해 줘', 'simpler'],
  ['좀 더 쉬운 말로 말해 줘!', 'simpler'],
  ['아직 어려워요. 쉽게 설명해주세요.', 'simpler'],
  ['예를 들어 설명해 줘', 'example'],
  [example, 'example'],
] as const)('recognizes a standalone follow-up: %s', (text, style) => {
  const q = { ...base, text };
  expect(assistantFollowUpStyle(q)).toBe(style);
  expect(assistantNeedsArticles(q)).toBe(false);
  expect(assistantNeedsMarketEvidence(q)).toBe(false);
  expect(assistantConversationIntent(q)).toBe('buy_more');
});

it('rewrites the immediate buy decision instead of restarting the earlier price explanation', () => {
  const prompt = assistantQuestionPrompt({ ...base, text: example }, {});
  expect(prompt).toContain(history[1].answer);
  expect(prompt).not.toContain(history[0].answer);
  expect(prompt).toContain('buy_more');
  expect(prompt).toContain('먼저 확인할 것을 요청하면');
});

it.each(['테슬라도 예를 들어 설명해 줘', 'ETF가 뭐야? 쉽게 설명해 줘', '오늘 새 뉴스도 예를 들어 설명해 줘', '언제 팔까?'])('does not swallow a new subject or decision: %s', text => {
  expect(assistantFollowUpStyle({ ...base, text })).toBeNull();
});

it('preserves the nearest decision through another rewrite or planning answer, stopping at a new topic', () => {
  const continued = [...history, { question: example, answer: '가상의 추가 매수 예시' }];
  expect(assistantConversationIntent({ text: '더 쉽게 설명해 줘', history: continued })).toBe('buy_more');
  expect(assistantConversationIntent({ text: '6개월 정도', history: continued })).toBe('buy_more');
  expect(assistantConversationIntent({ text: '더 쉽게 설명해 줘', history: [...history, { question: 'ETF가 뭐야?', answer: 'ETF 뜻' }] })).toBe('explain');
  expect(assistantConversationIntent({ text: '더 쉽게 설명해 줘', history: [...history, { question: '언제 팔까?', answer: '매도 기준' }] })).toBe('sell_timing');
  expect(assistantFollowUpStyle({ text: example, unclearTerms: [] })).toBeNull();
});
