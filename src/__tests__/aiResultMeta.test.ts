import { describe, expect, it } from 'vitest';
import { attachAiResultMeta, createAiResultMeta } from '@/lib/aiResultMeta';

describe('AI result metadata', () => {
  it('keeps actual supplied source references instead of claiming absent news and quote providers', () => {
    const sources = [{ name: '회사 사업 설명', provider: '공식 제품 소개', retrievedAt: '2026-11-03', url: 'https://secern.ai/' }];
    const meta = createAiResultMeta('ai-analysis', { symbol: '340810.KQ', sourceDetails: sources });
    expect(meta.sourceDetails).toEqual(sources); expect(meta.dataSources).toEqual(['회사 사업 설명(공식 제품 소개)']);
    expect(JSON.stringify(meta)).not.toContain('Google News'); expect(JSON.stringify(meta)).not.toContain('Finnhub');
  });
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
