import { describe, expect, it } from 'vitest';
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages';
import { companyNewsIdentity, mentionsCompanyInEnglish } from '@/lib/companyNewsIdentity';
import { fetchedArticleEvidence } from '@/lib/assistantArticleSources';
import type { AssistantEvidencePacket } from '@/lib/assistantEvidence';

describe('recognising an English article about the asked company', () => {
  it('accepts the common English name and a ticker that is itself the company name', () => {
    expect(mentionsCompanyInEnglish('AVGO', 'Broadcom shares jump after AI chip forecast')).toBe(true);
    expect(mentionsCompanyInEnglish('AMD', 'AMD Stock Clocks Best Day In 6 Months')).toBe(true);
    expect(mentionsCompanyInEnglish('AMD', 'Advanced  Micro Devices raised its outlook')).toBe(true);
    expect(mentionsCompanyInEnglish('PG', 'Procter & Gamble lifts prices again')).toBe(true);
  });
  it('does not match inside another word, a lowercase ticker, or a common word standing in for a company', () => {
    expect(mentionsCompanyInEnglish('INTC', 'Chip makers face intelligence agency review')).toBe(false);
    expect(mentionsCompanyInEnglish('AMD', 'Lawmakers amd regulators met on Tuesday')).toBe(false);
    expect(mentionsCompanyInEnglish('AMD', 'AMDOCS wins telecom contract')).toBe(false);
    // Block, Snap and Visa are ordinary words: only the corporate form counts.
    expect(mentionsCompanyInEnglish('SQ', 'Lawmakers block the merger')).toBe(false);
    expect(mentionsCompanyInEnglish('SQ', 'Block Inc. reports payment volume')).toBe(true);
    expect(mentionsCompanyInEnglish('V', 'New visa rules for skilled workers')).toBe(false);
    // A company with no entry is never recognised by guesswork.
    expect(mentionsCompanyInEnglish('ON', 'Stocks moved on rate news')).toBe(false);
  });
  it('leaves the search queries and the news matching rule unchanged', () => {
    const identity = companyNewsIdentity('AVGO', '브로드컴');
    expect(identity.queries).toEqual(['브로드컴 주가', '"브로드컴"']);
    expect(identity.matches('Broadcom shares jump after AI chip forecast')).toBe(false);
  });
});

it('keeps a fetched company report whose text names the company only in English', () => {
  const body = 'Published 2026-11-10\n' + 'AMD shares rose after investors weighed stronger data center chip demand against policy concerns. The report says future orders remain uncertain and does not confirm an earnings change.\n'.repeat(3);
  const packet = (symbol: string): AssistantEvidencePacket => ({ version: 1, symbol, period: '1d', checkedAt: '2026-11-10T16:00:00Z', comparisons: [], evidence: [], gaps: [],
    price: { symbol, label: symbol, day: '2026-11-10', baselineDay: '2026-11-09', at: '2026-11-10T15:00:00Z', price: 100, changePercent: 3, currency: 'USD' } });
  const blocks = [{ type: 'web_fetch_tool_result', content: { type: 'web_fetch_result', url: 'https://finance.yahoo.com/markets/stocks/articles/amd-stock-best-day.html',
    content: { title: 'AMD Stock Clocks Best Day In 6 Months', source: { type: 'text', data: body } } } }] as unknown as ContentBlock[];
  expect(fetchedArticleEvidence(blocks, packet('AMD'), Date.parse('2026-11-10T16:00:00Z'))).toMatchObject([{ scope: 'company', publishedAt: '2026-11-10' }]);
  // The same article is not evidence about a different company.
  expect(fetchedArticleEvidence(blocks, packet('INTC'), Date.parse('2026-11-10T16:00:00Z'))).toEqual([]);
});
