import { describe, expect, it } from 'vitest';
import { EXPLORATION_TOPICS, eventExploration, explorationCompany, explorationTopic, newsExploration, stockExploration } from '@/lib/contextExploration';

describe('contextual reading paths', () => {
  it('has valid, sourced topics and no dead ends', () => {
    const ids = EXPLORATION_TOPICS.map(topic => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of EXPLORATION_TOPICS) {
      expect(topic.related.length).toBeGreaterThanOrEqual(2);
      expect(topic.related).not.toContain(topic.id);
      for (const next of topic.related) expect(ids).toContain(next);
      expect(topic.sources.length).toBeGreaterThan(0);
      for (const source of topic.sources) expect(new URL(source.url).protocol).toBe('https:');
      for (const symbol of topic.companies) expect(explorationCompany(symbol)?.source.url).toMatch(/^https:/);
    }
  });
  it('can reach every topic from every starting explanation', () => {
    for (const start of EXPLORATION_TOPICS) {
      const visited = new Set<string>();
      const pending = [start.id];
      while (pending.length) {
        const next = pending.pop()!;
        if (visited.has(next)) continue;
        visited.add(next);
        pending.push(...explorationTopic(next).related);
      }
      expect(visited.size).toBe(EXPLORATION_TOPICS.length);
    }
  });
  it('connects Micron and Korean semiconductor aliases but never invents an unsupported business', () => {
    expect(stockExploration('MU')).toContain('semiconductors');
    expect(stockExploration('005930.KS')).toEqual(stockExploration('005930'));
    expect(stockExploration('UNVERIFIED')).toEqual(['earnings', 'compare', 'currency']);
    expect(explorationCompany('UNVERIFIED')).toBeUndefined();
  });
  it('matches headline themes with boundaries for Latin abbreviations', () => {
    expect(newsExploration('OpenAI 매출 우려에 마이크론 주가 변동')).toEqual(['semiconductors', 'ai', 'earnings']);
    expect(newsExploration('Retail chain gains again')).toEqual([]);
    expect(newsExploration('CPI 물가 둔화와 금리 전망')).toEqual(['inflation', 'rates']);
    expect(newsExploration('야구 경기 결과')).toEqual([]);
  });
  it('does not turn a market holiday into an economic cause', () => {
    expect(eventExploration('holiday')).toEqual([]);
    expect(eventExploration('earnings')).toEqual(['earnings', 'compare']);
    expect(eventExploration('jobs')).toContain('rates');
  });
});
