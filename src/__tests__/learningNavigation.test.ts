import { describe, expect, it } from 'vitest';
import { STOCK_LESSONS } from '@/config/stockLearning';
import { LEARNING_LINKS, LEARNING_TERMS } from '@/config/stockLearningGraph';
import { learningNeighbors, learningTermLinks, restoreLearningReading } from '@/lib/learningNavigation';

describe('contextual learning navigation', () => {
  it('every editorial edge reaches a real different lesson and explains the connection', () => {
    const ids = new Set<string>(STOCK_LESSONS.map(lesson => lesson.id));
    for (const [origin, edges] of Object.entries(LEARNING_LINKS)) {
      expect(ids.has(origin), origin).toBe(true);
      expect(new Set(edges.map(([id]) => id)).size).toBe(edges.length);
      for (const [target, reason] of edges) {
        expect(ids.has(target), `${origin} → ${target}`).toBe(true);
        expect(target).not.toBe(origin);
        expect(reason.trim().length).toBeGreaterThan(8);
      }
    }
    for (const [, target] of LEARNING_TERMS) expect(ids.has(target)).toBe(true);
  });

  it('follows a bounded relevant path even when every related explanation was visited', () => {
    const adjacent = LEARNING_LINKS.earnings.map(([id]) => id);
    expect(learningNeighbors('earnings')).toHaveLength(2);
    const visited = learningNeighbors('earnings', adjacent);
    expect(visited).toHaveLength(2);
    expect(visited.every(item => item.visited && adjacent.includes(item.lesson.id))).toBe(true);
    expect(learningNeighbors('missing')).toEqual([]);
  });

  it('avoids immediately sending readers back while preserving an explicit revisit route', () => {
    const next = learningNeighbors('cash', ['earnings', 'debt']);
    expect(next.map(item => item.lesson.id)).toEqual(['capex', 'dividends']);
    expect(learningNeighbors('cash', ['debt', 'capex', 'dividends'])[0].lesson.id).toBe('debt');
  });

  it('does not recommend company accounting lessons to fund readers', () => {
    for (const lesson of STOCK_LESSONS) expect(learningNeighbors(lesson.id, [], 'fund')).toEqual([]);
  });

  it('links meaningful terms without nested overlaps, self-links or repeated targets', () => {
    const text = '배당수익률과 배당, 영업활동 현금흐름과 현금 흐름, 금리를 살펴봐요.';
    const links = learningTermLinks(text, 'rates');
    expect(links.map(item => item.word)).toEqual(['배당수익률', '영업활동 현금흐름']);
    expect(learningTermLinks('순이익과 현금 흐름', 'earnings').map(item => item.id)).toEqual(['cash']);
    expect(learningTermLinks('확인된 설명이 없어요.', 'earnings')).toEqual([]);
  });
});


describe('restoring a concept reading visit', () => {
  it('preserves the selected question and serializable return trail over the original entry lesson', () => {
    const saved = { active: 'cash', trail: [{ id: 'earnings', top: 420, trigger: '[data-learning-related="cash"]' }] };
    expect(restoreLearningReading(JSON.parse(JSON.stringify(saved)), 'valuation')).toEqual(saved);
    expect(restoreLearningReading(undefined, 'valuation')).toEqual({ active: 'valuation', trail: [] });
  });
  it('drops unavailable targets and unsafe selectors without changing the restored topic', () => {
    expect(restoreLearningReading({ active: 'cash', trail: [
      { id: 'unknown', top: 10 },
      { id: 'earnings', top: -12, trigger: 'body button' },
    ] })).toEqual({ active: 'cash', trail: [{ id: 'earnings', top: 0 }] });
    expect(restoreLearningReading({ active: null, trail: [] }, 'earnings')).toEqual({ active: null, trail: [] });
  });
});
