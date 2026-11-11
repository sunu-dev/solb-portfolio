import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AssistantEvidencePacket } from '@/lib/assistantEvidence';

const m = vi.hoisted(() => ({ create: vi.fn(), record: vi.fn() }));
// The collector streams each call. The fixture replays a finished response as stream events.
const replay = (result: Promise<{ content: unknown[] }>) => ({ abort() {}, finalMessage: () => result,
  async *[Symbol.asyncIterator]() { for (const [index, content_block] of (await result).content.entries()) yield { type: 'content_block_start', index, content_block }; } });
vi.mock('@anthropic-ai/sdk', () => ({ default: class {
  static APIError = class extends Error {};
  messages = { stream: (request: unknown) => replay(Promise.resolve(m.create(request))) };
} }));
vi.mock('@/lib/aiCostLedger', () => ({ recordAiCost: m.record }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }));

const packet: AssistantEvidencePacket = { version: 1, symbol: 'MU', period: '1d', checkedAt: '2026-11-06T23:00:00Z', comparisons: [], evidence: [], gaps: [],
  price: { symbol: 'MU', label: '마이크론', day: '2026-11-06', baselineDay: '2026-11-05', at: '2026-11-06T21:00:00Z', price: 100, changePercent: 2, currency: 'USD' } };
const response = (scope: 'market' | 'company') => ({ model: 'claude-haiku-5-5', usage: { input_tokens: 100, output_tokens: 10 }, content: [{ type: 'web_fetch_tool_result',
  content: { type: 'web_fetch_result', url: `https://finance.yahoo.com/news/${scope}`, content: { title: scope === 'market' ? 'US stocks rebound after policy worries' : 'Micron memory demand',
    source: { type: 'text', data: 'Published 2026-11-06\n' + (scope === 'market'
      ? 'US stocks rebounded after investors considered new policy concerns. Reports describe uncertainty about future chip demand, not confirmed cancellations.\n'
      : 'Micron shares moved after investors considered memory demand. Future orders remain uncertain and the report does not confirm an earnings change.\n').repeat(3) } } } }] });

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubEnv('ANTHROPIC_API_KEY', 'fixture-not-a-key'); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

it('starts independent research together, keeps both scopes and shares an in-flight public request', async () => {
  const finish: Array<(response: unknown) => void> = [];
  m.create.mockImplementation(() => new Promise(resolve => finish.push(resolve)));
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  const first = collectAssistantArticles(packet);
  const concurrent = collectAssistantArticles(packet);
  await vi.waitFor(() => expect(m.create).toHaveBeenCalledTimes(2));
  expect(m.create.mock.calls.map(([request]) => request.tools.find((tool: {name: string}) => tool.name === 'web_fetch').max_uses)).toEqual([2, 1]);
  finish[1](response('company')); finish[0](response('market'));
  expect((await first).map(article => article.scope)).toEqual(['market', 'company']);
  expect(await concurrent).toEqual(await first);
  expect(m.record).toHaveBeenCalledTimes(2);
  expect(m.create).toHaveBeenCalledTimes(2);
});

it('retains a usable article when the other source fails, without adding an unbounded retry', async () => {
  m.create.mockRejectedValueOnce(new Error('provider unavailable')).mockResolvedValueOnce(response('company'));
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  expect(await collectAssistantArticles(packet)).toMatchObject([{ scope: 'company' }]);
  expect(m.create).toHaveBeenCalledTimes(2);
  expect(m.record).toHaveBeenCalledTimes(1);
});

it('searches the verified direction and does not reuse opposite-direction coverage within the same cache bucket', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-07T06:30:05Z'));
  m.create.mockResolvedValue(response('market'));
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  await collectAssistantArticles(packet);
  expect(m.create.mock.calls[0][0].messages[0].content).toContain('"priceDirection":"up"');
  const changed = { ...packet, price: { ...packet.price!, changePercent: -1 } };
  await collectAssistantArticles(changed);
  expect(m.create).toHaveBeenCalledTimes(4);
  expect(m.create.mock.calls[2][0].messages[0].content).toContain('"priceDirection":"down"');
  await collectAssistantArticles({ ...changed, price: { ...changed.price, changePercent: -2, at: '2026-11-06T21:00:30Z' } });
  expect(m.create).toHaveBeenCalledTimes(4);
});

it('rechecks missing market coverage after a minute instead of freezing a company-only answer for five minutes', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-07T06:30:05Z'));
  m.create.mockRejectedValueOnce(new Error('provider unavailable')).mockResolvedValueOnce(response('company'));
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  expect(await collectAssistantArticles(packet)).toMatchObject([{ scope: 'company' }]);
  vi.setSystemTime(new Date('2026-11-07T06:30:35Z'));
  await collectAssistantArticles(packet);
  expect(m.create).toHaveBeenCalledTimes(2);
  m.create.mockResolvedValueOnce(response('market')).mockResolvedValueOnce(response('company'));
  vi.setSystemTime(new Date('2026-11-07T06:31:06Z'));
  expect((await collectAssistantArticles(packet)).map(a => a.scope)).toEqual(['market', 'company']);
  expect(m.create).toHaveBeenCalledTimes(4);
});

it('does not search again when a market report already covers the requested semiconductor sector', async () => {
  const result = response('market');
  result.content[0].content.content.title = 'US stocks rebound after chip stocks fell on policy worries';
  m.create.mockResolvedValue(result);
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  const supplement = vi.fn();
  const articles = await collectAssistantArticles({ ...packet, symbol: '^GSPC', industryFocus: ['semiconductors'] }, supplement);
  expect(articles).toHaveLength(1);
  expect(articles[0].scope).toBe('market');
  expect(m.create).toHaveBeenCalledTimes(1);
  expect(m.record).toHaveBeenCalledTimes(1);
  expect(supplement).not.toHaveBeenCalled();
});

it('reuses same-window public articles when quote timestamps and headline order refresh', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-07T06:30:05Z'));
  m.create.mockResolvedValueOnce(response('market')).mockResolvedValueOnce(response('company'));
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  const first = await collectAssistantArticles(packet);
  const refreshed = { ...packet, checkedAt: '2026-11-07T06:30:35Z', price: { ...packet.price!, at: '2026-11-06T21:15:00Z' },
    evidence: [{ id: 'N9', kind: 'headline' as const, scope: 'company' as const, title: 'Micron memory demand update', text: '', url: 'https://finance.yahoo.com/news/refreshed', publisher: 'Yahoo', publishedAt: '2026-11-06', checkedAt: '2026-11-07T06:30:35Z' }] };
  expect(await collectAssistantArticles(refreshed)).toEqual(first);
  expect(m.create).toHaveBeenCalledTimes(2);
  expect(m.record).toHaveBeenCalledTimes(2);
});

it('does not share articles across a trading window, sector, subject or freshness boundary', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-07T06:30:05Z'));
  m.create.mockResolvedValue(response('market'));
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  await collectAssistantArticles(packet);
  for (const changed of [{ ...packet, symbol: 'NVDA' }, { ...packet, industryFocus: ['semiconductors' as const] },
    { ...packet, price: { ...packet.price!, baselineDay: '2026-11-04' } }]) await collectAssistantArticles(changed);
  expect(m.create).toHaveBeenCalledTimes(8);
  vi.setSystemTime(new Date('2026-11-07T06:35:00Z'));
  await collectAssistantArticles(packet);
  expect(m.create).toHaveBeenCalledTimes(10);
});
