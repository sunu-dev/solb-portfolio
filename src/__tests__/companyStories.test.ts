import { describe, expect, it } from 'vitest';
import { COMPANY_STORIES, companyBusinessSummary, companyStory } from '@/lib/companyStories';
import { SECTOR_COMPANY_EVIDENCE } from '@/lib/sectorExploration';

describe('company explanations answer the business question', () => {
  it('provides a sourced business, customer, revenue and follow-up explanation for every detailed story', () => {
    for (const story of Object.values(COMPANY_STORIES)) {
      for (const value of [story.summary, story.example, story.customers, story.revenue, story.watch]) {
        expect(value.length).toBeGreaterThan(30);
        expect(value).not.toMatch(/업종으로 분류한 기업|회사 공시에서 확인해야|준비 중/);
      }
      expect(story.questions.length).toBeGreaterThanOrEqual(3);
      expect(new Set(story.questions.map(q => q.id)).size).toBe(story.questions.length);
      expect(new Set(story.questions.map(q => q.answer)).size).toBe(story.questions.length);
      for (const item of story.sources) {
        expect(new URL(item.url).protocol).toBe('https:');
        expect(item.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
  it('retains reviewed business descriptions across sectors instead of replacing them with source classification', () => {
    for (const company of SECTOR_COMPANY_EVIDENCE) expect(companyBusinessSummary(company.symbol)).toBeTruthy();
    expect(companyBusinessSummary('BE')).toContain('연료전지');
    expect(companyBusinessSummary('COHR')).toContain('광학');
    expect(companyBusinessSummary('005380')).toBe(companyBusinessSummary('005380.KS'));
    expect(companyStory(' pltr ')?.summary).toContain('어떻게 대응');
  });
  it('does not invent a customer or revenue model from a stock code or a product list', () => {
    expect(companyStory('UNKNOWN-FIXTURE')).toBeUndefined();
    expect(companyBusinessSummary('UNKNOWN-FIXTURE')).toBeUndefined();
    expect(companyBusinessSummary('UNKNOWN-FIXTURE', '의약품')).toBe('거래소 자료에 등록된 주요 제품·사업은 의약품예요.');
  });
});
