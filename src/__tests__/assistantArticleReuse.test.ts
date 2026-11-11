import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ create: vi.fn(), cost: vi.fn().mockResolvedValue(undefined) }));
const replay = (result: Promise<{ content: unknown[] }>) => ({ abort() {}, finalMessage: () => result,
  async *[Symbol.asyncIterator]() { for (const [index, content_block] of (await result).content.entries()) yield { type: 'content_block_start', index, content_block }; } });
vi.mock('@anthropic-ai/sdk', () => ({ default: class {
  static APIError = class extends Error {};
  messages = { stream: (request: unknown) => replay(Promise.resolve(state.create(request))) };
} }));
vi.mock('@/lib/aiCostLedger', () => ({ recordAiCost: state.cost }));
import { collectAssistantArticles } from '@/lib/assistantArticleSources';
import type { AssistantEvidencePacket } from '@/lib/assistantEvidence';
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

it('reuses fetched company articles across a verified fund and its underlying without another search or duplicate cost', async () => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'unit-test-only');
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T00:00:00Z'));
  state.create.mockResolvedValue({ model: 'claude-haiku-5-5', usage: { input_tokens: 100, output_tokens: 5 }, content: [
    { type: 'web_fetch_tool_result', content: { type: 'web_fetch_result', url: 'https://finance.yahoo.com/news/micron-reuse-test',
      content: { title: 'Micron shares and memory demand', source: { type: 'text', data: 'Published 2026-11-05\n' + 'Micron shares fell as policy concerns weighed on semiconductor demand. The report describes investor expectations and does not confirm any decline in customer orders.\n'.repeat(3) } } } },
  ] });
  const packet = (symbol: string): AssistantEvidencePacket => ({ version: 1, symbol, period: '1d', checkedAt: new Date().toISOString(), comparisons: [], evidence: [], gaps: [],
    price: { symbol, label: symbol, day: '2026-11-05', baselineDay: '2026-11-04', at: '2026-11-05T21:00:00Z', price: 100, changePercent: -3, currency: 'USD' } });
  const fundPacket = packet('MUU');
  fundPacket.comparisons = [packet('MU').price!];
  const first = await collectAssistantArticles(fundPacket);
  const callsAfterFirst = state.create.mock.calls.length, costsAfterFirst = state.cost.mock.calls.length;
  const second = await collectAssistantArticles(packet('MU'));
  expect(first).toHaveLength(1);
  expect(first[0].scope).toBe('company');
  expect(second).toEqual(first);
  expect(state.create).toHaveBeenCalledTimes(callsAfterFirst);
  expect(state.cost).toHaveBeenCalledTimes(costsAfterFirst);
});
