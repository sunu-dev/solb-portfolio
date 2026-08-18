import { describe, expect, it } from 'vitest';
import { attachAiResultMeta, createAiResultMeta } from '@/lib/aiResultMeta';

describe('AI result metadata', () => {
  it('records the actual AI provider and model', () => {
    const value = attachAiResultMeta({ report: true }, 'ai-analysis', {
      symbol: 'AAPL',
      aiProvider: 'gemini',
      aiModel: 'gemini-2.5-flash',
    });
    expect(value._meta).toMatchObject({
      aiProvider: 'gemini',
      aiModel: 'gemini-2.5-flash',
    });
  });

  it('distinguishes Korean linked quotes from Finnhub quotes', () => {
    const kr = createAiResultMeta('ai-analysis', { symbol: '005930.KS' });
    const us = createAiResultMeta('ai-analysis', { symbol: 'AAPL' });
    expect(kr.sourceDetails?.[0].provider).toBe('한국거래소 연계 시세');
    expect(us.sourceDetails?.[0].provider).toBe('Finnhub');
  });
});
