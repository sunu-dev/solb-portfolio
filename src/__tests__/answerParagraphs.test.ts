import { expect, it } from 'vitest';
import { answerParagraphs } from '@/lib/answerParagraphs';

it('preserves prices, dates, qualifications and every original word while separating a long answer', () => {
  const text = '2026-11-09 가격은 78.32달러였어요. 가격이 올랐다는 사실만으로 특정 뉴스가 원인이라고 단정할 수는 없어요. '.repeat(5);
  const result = answerParagraphs(text);
  expect(result.length).toBeGreaterThan(1);
  expect(result.join('')).toBe(text);
  expect(result.every(p => !p.endsWith('78.'))).toBe(true);
});
it('keeps brief answers and explicit paragraphs intact', () => {
  expect(answerParagraphs('짧은 설명이에요.')).toEqual(['짧은 설명이에요.']);
  expect(answerParagraphs('첫 설명.\n\n다음 설명.')).toEqual(['첫 설명.', '다음 설명.']);
  expect(answerParagraphs('')).toEqual([]);
});
