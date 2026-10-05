import { describe, expect, it } from 'vitest';
import { buildAnalysisLoadingFacts } from '@/utils/analysisLoadingFacts';

describe('buildAnalysisLoadingFacts', () => {
  it('formats only the submitted price, volume ratio and company figure', () => {
    expect(buildAnalysisLoadingFacts({ currency: 'USD', price: 205.25, volRatio: 1.8, per: 26.4, eps: 7.8 })).toEqual([
      { id: 'price', label: '가격', value: '$205.25' },
      { id: 'volume', label: '거래량', value: '평소의 1.8배' },
      { id: 'earnings', label: '기업 지표', value: 'PER 26.4배' },
    ]);
  });

  it('formats Korean stock amounts in their submitted currency', () => {
    const facts = buildAnalysisLoadingFacts({ currency: 'KRW', price: 75300, eps: 1200 });
    expect(facts[0].value).toBe('₩75,300');
    expect(facts[2].value).toBe('주당이익 ₩1,200');
  });

  it('keeps missing values null instead of inventing zero or average volume', () => {
    expect(buildAnalysisLoadingFacts({ currency: 'USD' }).map(fact => fact.value)).toEqual([null, null, null]);
  });

  it.each([0, -1, NaN, Infinity, -Infinity])('rejects invalid price and volume ratio %s', value => {
    const facts = buildAnalysisLoadingFacts({ currency: 'USD', price: value, volRatio: value });
    expect(facts[0].value).toBeNull();
    expect(facts[1].value).toBeNull();
  });

  it('does not round a small positive volume ratio or PER to zero', () => {
    const facts = buildAnalysisLoadingFacts({ currency: 'USD', volRatio: 0.01, per: 0.04 });
    expect(facts[1].value).toBe('평소의 0.1배 미만');
    expect(facts[2].value).toBe('PER 0.1배 미만');
  });

  it('retains the exact 0.1 boundary as a positive ratio', () => {
    expect(buildAnalysisLoadingFacts({ currency: 'USD', volRatio: 0.1 })[1].value).toBe('평소의 0.1배');
  });

  it.each([0, -1, NaN, Infinity])('uses an actual EPS when PER is invalid: %s', per => {
    expect(buildAnalysisLoadingFacts({ currency: 'USD', per, eps: -1 })[2].value).toBe('주당이익 -$1.00');
  });

  it('preserves reported zero and negative EPS rather than treating them as absent', () => {
    expect(buildAnalysisLoadingFacts({ currency: 'USD', eps: 0 })[2].value).toBe('주당이익 $0.00');
    expect(buildAnalysisLoadingFacts({ currency: 'KRW', eps: -125 })[2].value).toBe('주당이익 -₩125');
  });

  it.each([0, -1])('prefers reported EPS %s over a contradictory positive PER', eps => {
    expect(buildAnalysisLoadingFacts({ currency: 'USD', eps, per: 26.4 })[2].value)
      .toBe(eps === 0 ? '주당이익 $0.00' : '주당이익 -$1.00');
  });

  it.each([NaN, Infinity, -Infinity])('does not format invalid EPS %s as a real zero', eps => {
    expect(buildAnalysisLoadingFacts({ currency: 'USD', eps })[2].value).toBeNull();
  });

  it('does not coerce malformed runtime values to numbers', () => {
    const malformed = { currency: 'USD', price: '100', volRatio: null, per: null, eps: null };
    const facts = buildAnalysisLoadingFacts(malformed as unknown as Parameters<typeof buildAnalysisLoadingFacts>[0]);
    expect(facts.map(fact => fact.value)).toEqual([null, null, null]);
  });
});
