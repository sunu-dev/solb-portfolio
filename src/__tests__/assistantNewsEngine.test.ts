import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AssistantEvidence, AssistantEvidencePacket } from '@/lib/assistantEvidence';
import { assessAssistantNews, newsAnswerIssue, newsAssessmentPrompt, uniqueNews } from '@/lib/assistantNewsAssessment';
import { assistantQuestionPrompt } from '@/lib/assistantQuestion';
const m = vi.hoisted(() => ({ request: vi.fn(), cost: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class {
  static APIError = class extends Error {};
  messages = { stream: (request: unknown) => {
    const result = Promise.resolve(m.request(request));
    return { abort() {}, finalMessage: () => result, async *[Symbol.asyncIterator]() {
      for (const content_block of (await result).content) yield { type: 'content_block_start', content_block };
    } };
  } };
} }));
vi.mock('@/lib/aiCostLedger', () => ({ recordAiCost: m.cost }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }));
const base: AssistantEvidencePacket = { version: 1, symbol: '340810.KQ', period: '1d', checkedAt: '2026-11-17T01:00:00Z', evidence: [], gaps: [], comparisons: [],
  price: { symbol: '340810.KQ', label: '시선AI', day: '2026-11-16', baselineDay: '2026-11-13', at: '2026-11-16T06:30:00Z', price: 3200, changePercent: 26.23, currency: 'KRW' } };
// Synthetic fixtures describe the evidence shape; they are not copies of press articles.
const source = (changes: Partial<AssistantEvidence> = {}): AssistantEvidence => ({ id: 'A1', kind: 'article', scope: 'company', title: '시선AI, 시험 보안 탐지 기술 관련 관심',
  text: '시선AI는 촬영기기 탐지 기술을 개발하고 있다고 설명했다. 시험 보안 수요에 관련된 기술이지만 실제 시험장 계약을 발표한 것은 아니다. 일반 안경과 구분하는 정확도를 높이는 과정이며 도입 결정은 기관의 검증에 달려 있다. '.repeat(3),
  url: 'https://www.newspim.com/news/view/fixture', publisher: '뉴스핌', publishedAt: '2026-11-16', checkedAt: base.checkedAt, ...changes });
const packet = (...sources: AssistantEvidence[]) => ({ ...base, evidence: sources });
const response = (sources: AssistantEvidence[]) => ({ model: 'fixture', usage: { input_tokens: 100, output_tokens: 5 }, content: sources.map(s => ({ type: 'web_fetch_tool_result', content: { type: 'web_fetch_result', url: s.url,
  content: { title: s.title, source: { type: 'text', data: `기사입력 ${s.publishedAt}\n${s.text}` } } } })) });
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubEnv('JOOBI_NEWS_ENGINE', 'adaptive'); vi.stubEnv('ANTHROPIC_API_KEY', 'fixture'); });
afterEach(() => vi.unstubAllEnvs());

it('keeps relevant technology news distinct from a reported price catalyst', () => {
  expect(assessAssistantNews(packet(source()))).toMatchObject({ state: 'relevant_event', sourceIds: ['A1'] });
  expect(newsAssessmentPrompt(packet(source()))).toContain('직접 원인으로 확정하지 못했어요');
});
it('does not let a market wrap satisfy a company question', () => {
  const p = packet(source({ scope: 'market', title: '코스닥 하락', text: '코스닥은 반도체 수요와 정책 우려로 하락했다. '.repeat(10) }));
  expect(assessAssistantNews(p).state).toBe('context_only');
  expect(newsAnswerIssue({ currentStatus: '새 계약이 있는지 확인해 보세요.', keyAdvice: [] }, p)).toBe('unsupported_news_task');
  const prompt = assistantQuestionPrompt({ text: '시선AI는 어제 왜 올랐어?', symbol: base.symbol, unclearTerms: [], period: '1d', market: 'kr' }, { evidence: p });
  expect(prompt).toContain('상태: context_only'); expect(prompt).toContain('keyAdvice와 assistantInsights는 []');
});
it.each(['headline', 'reference', 'price'] as const)('does not promote %s to event evidence', kind => {
  expect(assessAssistantNews(packet(source({ kind }))).state).toBe('unavailable');
});
it.each(['2026-11-12', '2026-11-18', 'not-a-date'])('rejects unusable publication day %s', publishedAt => {
  expect(assessAssistantNews(packet(source({ publishedAt }))).state).toBe('unavailable');
});
it('keeps prior-day events as background for a daily move', () => {
  expect(assessAssistantNews(packet(source({ publishedAt: '2026-11-13' })))).toMatchObject({ state: 'context_only', sourceIds: [], contextIds: ['A1'] });
});
it('does not promote another issuer mentioned in a wrap', () => {
  expect(assessAssistantNews(packet(source({ title: '다른회사, 탐지 기술 출시' }))).state).toBe('context_only');
});
it('requires matching direction and attributes the reported driver', () => {
  const s = source({ title: '시선AI, 보안 수요 기대에 상승' });
  expect(assessAssistantNews(packet(s)).state).toBe('reported_driver');
  expect(assessAssistantNews({ ...packet(s), price: { ...base.price!, changePercent: -5 } }).state).toBe('relevant_event');
  expect(assessAssistantNews(packet({ ...s, timing: 'after-price' })).state).toBe('relevant_event');
});
it('deduplicates syndication and tracking links without dropping different facts', () => {
  const s = source();
  expect(uniqueNews([s, { ...s, url: s.url + '?utm_source=test' }, { ...s, url: 'https://www.mk.co.kr/news/fixture' },
    { ...s, title: '시선AI, 도입 확정 부인', text: '별도 반론과 확인 사실', url: s.url + '2' }])).toHaveLength(2);
});
it('stops after one successful company search and coalesces concurrent requests', async () => {
  m.request.mockResolvedValue(response([source()]));
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  const [a, b] = await Promise.all([collectAssistantArticles(base), collectAssistantArticles(base)]);
  expect(a).toHaveLength(1); expect(b).toEqual(a); expect(m.request).toHaveBeenCalledTimes(1);
  expect(m.request.mock.calls[0][0].tools[0]).toMatchObject({ max_uses: 1 });
  expect(m.request.mock.calls[0][0].tools[1]).toMatchObject({ max_uses: 2 });
});
it('uses the second search for missing company evidence, never a mandatory market wrap', async () => {
  m.request.mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([source()]));
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  expect(await collectAssistantArticles(base)).toHaveLength(1);
  expect(m.request).toHaveBeenCalledTimes(2);
  expect(m.request.mock.calls[1][0].messages[0].content).toContain('recovery search');
});
it('never exceeds two searches even with only irrelevant articles', async () => {
  m.request.mockResolvedValue(response([source({ title: '코스닥 시장 정책', scope: 'market', text: '코스닥 시장은 정책과 투자 수요 변화에 따라 움직였다. '.repeat(8) })]));
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  expect(await collectAssistantArticles(base)).toHaveLength(0); expect(m.request).toHaveBeenCalledTimes(2);
});
it('records rejection reasons without logging question text', async () => {
  const { fetchedArticleEvidence } = await import('@/lib/assistantArticleSources');
  const reasons: string[] = [];
  const blocks = response([source({ url: 'https://newspim.com.evil.test/fixture' }), source({ publishedAt: '2026-11-01' })]).content;
  fetchedArticleEvidence(blocks as Parameters<typeof fetchedArticleEvidence>[0], base, Date.now(), r => reasons.push(r));
  expect(reasons).toEqual(['domain_excluded', 'date_rejected']);
});

it('retains company identity during a price outage', () => {
  expect(assessAssistantNews({ ...packet(source()), price: undefined, subjectName: '시선AI', session: { reference: 'previous', throughDay: '2026-11-16', description: '직전 거래일' } }).state).toBe('relevant_event');
});
it('uses the underlying company for leveraged funds', () => {
  const s = source({ title: 'Micron memory demand and production', text: 'Micron reported changes in memory demand and production. Actual orders and revenue remain uncertain. '.repeat(3) });
  expect(assessAssistantNews({ ...packet(s), symbol: 'MUU', comparisons: [{ ...base.price!, symbol: 'MU', label: 'Micron' }] }).state).toBe('relevant_event');
});
it('handles multi-day events without requiring publication on the last day', () => {
  expect(assessAssistantNews({ ...packet(source({ publishedAt: '2026-11-13' })), period: '5d' }).state).toBe('relevant_event');
});
it('treats a market article as primary only for a market question', () => {
  const p = packet(source({ scope: 'market', title: '코스닥 정책 영향', text: '국내 코스닥 시장에 정책과 금리 변화가 영향을 줄 수 있다는 보도이며 실제 주문 감소가 확인된 것은 아니다. '.repeat(3) }));
  expect(assessAssistantNews({ ...p, symbol: '^KQ11' }).state).toBe('relevant_event');
});
it('does not add news restrictions to a definition question', () => {
  expect(assistantQuestionPrompt({ text: 'ETF가 뭐야?', unclearTerms: [] }, { evidence: packet() })).not.toContain('[질문별 근거 계약 v1]');
});
it('preserves a nearby caveat while extracting an event', async () => {
  const { articlePassages } = await import('@/lib/assistantArticleSources');
  const caveat = '실제 계약 체결 여부는 아직 확인되지 않았으며 시험장 도입도 각 기관의 검증 절차를 거쳐야 한다.';
  expect(articlePassages('시선AI는 시험 보안을 위한 촬영기기 탐지 기능을 개발하고 정확도 개선을 추진한다고 설명했다.\n' + caveat, '보안 기술')).toContain(caveat);
});
it('keeps retries within the shared wall-clock budget', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-17T01:00:00Z'));
  m.request.mockImplementation(async () => { vi.setSystemTime(new Date('2026-11-17T01:00:28Z')); return response([]); });
  try {
    const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
    expect(await collectAssistantArticles(base)).toEqual([]);
    expect(m.request).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});
it('does not cache failed searches as complete coverage for five minutes', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-17T01:00:01Z'));
  m.request.mockResolvedValue(response([]));
  try {
    const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
    await collectAssistantArticles(base);
    vi.setSystemTime(new Date('2026-11-17T01:00:30Z')); await collectAssistantArticles(base);
    expect(m.request).toHaveBeenCalledTimes(2);
    vi.setSystemTime(new Date('2026-11-17T01:01:02Z')); await collectAssistantArticles(base);
    expect(m.request).toHaveBeenCalledTimes(4);
  } finally { vi.useRealTimers(); }
});
it('does not treat a denied headline as a confirmed reported driver', () => {
  expect(assessAssistantNews(packet(source({ title: '시선AI, 계약 기대에 상승 보도 부인' }))).state).toBe('relevant_event');
});
it('retains a precise Korean after-close publication time', async () => {
  const { fetchedArticleEvidence } = await import('@/lib/assistantArticleSources');
  const blocks = response([source()]).content;
  blocks[0].content.content.source.data = '기사입력 2026년11월16일 17:02\n' + source().text;
  expect(fetchedArticleEvidence(blocks as Parameters<typeof fetchedArticleEvidence>[0], base)[0].timing).toBe('after-price');
});
