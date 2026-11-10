import { expect, it } from 'vitest';
import { assistantPromptBlocks } from '@/lib/claudeAnalysis';
import { assistantQuestionPrompt } from '@/lib/assistantQuestion';

it('shares instructions across questions without caching user history, facts or the question', () => {
  const make = (text: string) => assistantQuestionPrompt({ text, unclearTerms: [], history: [{ question: 'PRIVATE_HISTORY', answer: 'PRIVATE_ANSWER' }] }, { business: 'CHANGING_BUSINESS_FACTS' });
  const prompt = make('PRIVATE_QUESTION_ONE');
  const first = assistantPromptBlocks(prompt), second = assistantPromptBlocks(make('PRIVATE_QUESTION_TWO'));
  expect(first.map(block => block.text).join('')).toBe(prompt);
  expect(first[0]).toEqual(second[0]);
  expect(first[0].cache_control).toEqual({ type: 'ephemeral' });
  expect(first[0].text).not.toMatch(/PRIVATE_|CHANGING_BUSINESS_FACTS/);
  expect(first[1].text).toContain('PRIVATE_HISTORY');
  expect(first[1].text).toContain('PRIVATE_QUESTION_ONE');
  expect(first[1].text).toContain('CHANGING_BUSINESS_FACTS');
  expect(first[1].cache_control).toBeUndefined();
});

it('does not mark unknown prompt formats for caching', () => {
  expect(assistantPromptBlocks('a different request')).toEqual([{ type: 'text', text: 'a different request' }]);
});
