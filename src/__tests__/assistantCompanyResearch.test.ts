import { describe, it, expect } from 'vitest';
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages';
import { resolveAssistantSubject } from '@/lib/assistantSubject';
import { companyResearchPacket, companyResearchCoverage } from '@/lib/assistantCompanyResearch';
import { assistantNeedsArticles, assistantNeedsMarketEvidence, assistantQuestionPrompt, assistantContextIssue, parseAssistantQuestion } from '@/lib/assistantQuestion';
import { assistantArticleWindow, fetchedArticleEvidence, companyRetrievalInstruction, needsArticleSupplement } from '@/lib/assistantArticleSources';
const resolve = (text: string) => resolveAssistantSubject({ text, unclearTerms: [], market: 'kr', symbol: '340810.KQ' }).question;
const now = Date.parse('2026-11-17T08:00:00Z');
const packet = companyResearchPacket(resolve('앤스로픽이 상장하면 어떨거 같아'), now)!;
const body = 'Anthropic develops AI services for business customers. This article describes its products, revenue model and infrastructure costs. No IPO schedule was confirmed in the announcement. '.repeat(3);
function fetch(url: string, title: string, date = '', text = body): ContentBlock {
  return { type: 'web_fetch_tool_result', tool_use_id: 'tool', caller: { type: 'direct' }, content: { type: 'web_fetch_result', url, retrieved_at: packet.checkedAt,
    content: { type: 'document', title, citations: null, source: { type: 'text', media_type: 'text/plain', data: `${date ? 'Published '+date : ''}\n${text}` } } } };
}
describe('company-first research', () => {
  it.each(['앤스로픽이 상장하면 어떨거 같아', '앤트로픽 최근 소식', 'Anthropic IPO 전망'])('clears stale security/market context: %s', text => {
    const q = resolve(text);
    expect(q.companyResearch?.id).toBe('anthropic');
    expect(q.symbol).toBeUndefined(); expect(q.sessionReference).toBeUndefined();
    expect(assistantNeedsMarketEvidence(q)).toBe(false); expect(assistantNeedsArticles(q)).toBe(false);
  });
  it.each(['IPO가 뭐야', '시선AI 어제 왜 올랐어', '금리가 오르면 주가는 왜 내려?', '애플 요즘 주가 어때'])('preserves other question paths: %s', text => {
    expect(resolve(text).companyResearch).toBeUndefined();
  });
  it('derives research server-side and does not accept forged domains', () => {
    expect(parseAssistantQuestion({ questionConsent: true, questionText: '앤스로픽 상장 전망', companyResearch: { domains: ['evil.test'] } })?.companyResearch).toBeUndefined();
  });
  it('continues the company topic from a user question, not generated prose', () => {
    const q = resolveAssistantSubject({ text: '그럼 비용은 왜 많이 들어?', unclearTerms: [], history: [{ question: '앤스로픽 상장 전망', answer: 'Tesla 얘기', symbol: 'GENERAL', market: 'kr' }] }).question;
    expect(q.companyResearch?.id).toBe('anthropic');
  });
  it('uses a 90 day reporting window and public identity only', () => {
    expect(assistantArticleWindow(packet)).toMatchObject({ from: '2026-08-19', to: '2026-11-17' });
    const instruction = companyRetrievalInstruction(packet);
    expect(instruction).toContain('Anthropic IPO latest news');
    expect(instruction).not.toContain('340810');
  });
  it('accepts undated official background but never labels it new reporting', () => {
    const sources = fetchedArticleEvidence([fetch('https://www.anthropic.com/company', 'About Anthropic')], packet, now);
    expect(sources).toHaveLength(1); expect(sources[0]).toMatchObject({ kind: 'reference', publishedAt: '' });
    expect(needsArticleSupplement(packet, sources)).toBe(true);
  });
  it('rejects generic market wraps, old/future articles, unofficial undated pages and snippets', () => {
    const sources = fetchedArticleEvidence([
      fetch('https://newspim.com/a', '오늘 코스피 하락', '2026-11-17'),
      fetch('https://newspim.com/b', 'Anthropic IPO', '2025-11-17'),
      fetch('https://newspim.com/c', 'Anthropic IPO', '2026-11-18'),
      fetch('https://newspim.com/d', 'Anthropic IPO'),
      fetch('https://anthropic.com.evil.test/company', 'About Anthropic'),
      fetch('https://newspim.com/e', 'Anthropic IPO', '2026-11-17', 'snippet'),
    ], packet, now);
    expect(sources).toHaveLength(0);
  });
  it('keeps current company reporting plus official business context', () => {
    const sources = fetchedArticleEvidence([fetch('https://newspim.com/a', 'Anthropic IPO plans', '2026-11-17'), fetch('https://anthropic.com/company', 'About Anthropic')], packet, now);
    expect(sources).toHaveLength(2); expect(needsArticleSupplement(packet, sources)).toBe(false);
    const prompt = assistantQuestionPrompt(resolve('앤스로픽 상장 전망'), { evidence: {...packet, evidence: sources} });
    expect(prompt).toContain('공식 발표·추진 보도·추측'); expect(prompt).toContain('사업 성장과 비용 부담');
    expect(assistantContextIssue({currentStatus:'앤스로픽 상장이 오늘 증시 약세의 직접 원인이라고 단정할 수는 없어요.'}, resolve('앤스로픽 상장 전망'))).toBe('company_topic_drift');
  });
});

it('an official offering announcement alone does not satisfy business coverage', () => {
  const source = fetchedArticleEvidence([fetch('https://anthropic.com/news/roadshow', 'Anthropic IPO roadshow', '2026-11-10',
    'Anthropic launched the roadshow for its initial public offering. The proposed offering consists of Class A common stock and the registration statement has not become effective. '.repeat(3))], packet, now);
  expect(companyResearchCoverage(source)).toEqual({ business: false, offering: true });
  expect(needsArticleSupplement(packet, source)).toBe(true);
  expect(companyRetrievalInstruction(packet, source)).toContain('products customers revenue business model');
});
it('accepts undated official product pages as background, never undated news', () => {
  const sources = fetchedArticleEvidence([fetch('https://anthropic.com/claude', 'Claude from Anthropic'), fetch('https://anthropic.com/news/unknown', 'Anthropic IPO')], packet, now);
  expect(sources).toHaveLength(1); expect(sources[0]).toMatchObject({kind: 'reference', publishedAt: ''});
});
