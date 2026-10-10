import { describe, expect, it } from 'vitest';
import { EXPLORATION_TOPICS, SEMICONDUCTOR_COMPANIES, companyExploration, eventExploration, explorationCompany, explorationTopic, newsExploration, stockExploration } from '@/lib/contextExploration';
import { SECTORS, classifiedSectors, sectorOverview } from '@/lib/sectorExploration';

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
    expect(stockExploration('000660')).toEqual(stockExploration('MU'));
    expect(explorationCompany('000660.KS')?.name).toBe('SK하이닉스');
    expect(stockExploration('UNVERIFIED')).toEqual(['earnings', 'compare', 'currency']);
    expect(explorationCompany('UNVERIFIED')).toBeUndefined();
  });
  it('gives each featured semiconductor company a sourced path into specific follow-up reading', () => {
    for (const item of SEMICONDUCTOR_COMPANIES) {
      expect(explorationCompany(item.symbol)?.source.url).toMatch(/^https:/);
      expect(companyExploration(item.symbol)).toEqual(item.related);
      for (const id of item.related) expect(explorationTopic(id)).toBeDefined();
    }
    expect(companyExploration('MU')).toContain('memory-cycle');
    expect(companyExploration('NVDA')).toContain('gpu');
    expect(companyExploration('000660')).toEqual(companyExploration('000660.KS'));
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
  it('covers all 11 major industries and every configured sub-industry with a sourced representative', () => {
    expect(SECTORS.filter(sector => !sector.parent)).toHaveLength(11);
    expect(SECTORS.filter(sector => sector.parent)).toHaveLength(10);
    expect(new Set(SECTORS.map(sector => sector.id)).size).toBe(SECTORS.length);
    for (const sector of SECTORS) {
      expect(sector.companies).toContain(sector.anchor);
      expect(sector.flow).toHaveLength(3);
      expect(sector.connections.length).toBeGreaterThan(0);
      if (sector.parent) expect(SECTORS.find(item => item.id === sector.parent)?.parent).toBeNull();
      for (const symbol of sector.companies) {
        expect(explorationCompany(symbol)?.source.url).toMatch(/^https:/);
        expect(classifiedSectors(symbol).sectors.map(item => item.id)).toContain(sector.id);
      }
      for (const target of sector.connections) expect(explorationTopic(sectorOverview(target))).toBeDefined();
    }
  });
  it('uses reviewed roles before provider categories and preserves multiple business contexts', () => {
    expect(classifiedSectors('042660', { sector: 'Technology' }).sectors[0].id).toBe('shipbuilding');
    expect(classifiedSectors('012450').sectors.map(item => item.id)).toEqual(['defense', 'aerospace', 'industrials']);
    expect(classifiedSectors('unknown', { sector: 'Healthcare', industry: 'Biotechnology' }).sectors.map(item => item.id)).toEqual(['pharma', 'healthcare']);
    expect(classifiedSectors('unknown', { sector: ' Real Estate ' }).basis).toBe('provider');
    expect(classifiedSectors('unknown', { sector: 'not a sector' })).toEqual({ sectors: [], basis: 'unknown' });
    expect(explorationCompany('unknown')).toBeUndefined();
  });
  it('keeps Bloom Energy in fuel-cell equipment even when provider data is missing or generic', () => {
    expect(classifiedSectors('BE').sectors.map(item => item.id)).toEqual(['fuel-cells', 'industrials']);
    expect(classifiedSectors('BE', { sector: 'Energy' }).sectors[0].id).toBe('fuel-cells');
    expect(stockExploration('BE')[0]).toBe('sector:fuel-cells');
    expect(explorationCompany('BE')?.name).toBe('블룸에너지');
    expect(explorationCompany('BE')?.source.url).toBe('https://www.bloomenergy.com/technology/');
  });
  it.each([
    ['광통신 투자와 코히런트', 'photonics'], ['신약 임상 결과', 'pharma'], ['반도체 소부장 투자', 'equipment'],
    ['방산 국방 예산', 'defense'], ['항공기 우주 위성', 'aerospace'], ['조선 LNG 운반선 수주', 'shipbuilding'],
  ] as const)('connects industry news without defaulting to a semiconductor explanation: %s', (title, sector) => {
    expect(newsExploration(title)[0]).toBe(sectorOverview(sector));
  });
});
