import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AssistantEvidencePacket } from '@/lib/assistantEvidence';

// 수집 호출은 필요한 기사를 받으면 모델의 마무리 글을 기다리지 않고 근거를 돌려준다.
// 요청은 끊지 않고 끝까지 받아, 실제 사용량으로 비용을 한 번 기록한다.
type Step = { event?: unknown; wait?: Promise<void>; fail?: Error };
const m = vi.hoisted(() => ({ scripts: [] as { steps: Step[]; final: unknown }[], record: vi.fn(), requests: [] as unknown[] }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class {
  static APIError = class extends Error {};
  messages = { stream: (request: unknown) => {
    m.requests.push(request);
    const script = m.scripts.shift()!;
    return { abort() {}, finalMessage: async () => script.final,
      async *[Symbol.asyncIterator]() { for (const step of script.steps) { if (step.wait) await step.wait; if (step.fail) throw step.fail; if (step.event) yield step.event; } } };
  } };
} }));
vi.mock('@/lib/aiCostLedger', () => ({ recordAiCost: m.record }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }));

const packet: AssistantEvidencePacket = { version: 1, symbol: 'MU', period: '1d', checkedAt: '2026-11-06T23:00:00Z', comparisons: [], evidence: [], gaps: [],
  price: { symbol: 'MU', label: '마이크론', day: '2026-11-06', baselineDay: '2026-11-05', at: '2026-11-06T21:00:00Z', price: 100, changePercent: 2, currency: 'USD' } };
const fetched = (scope: 'market' | 'company', slug: string = scope) => ({ type: 'web_fetch_tool_result', content: { type: 'web_fetch_result', url: `https://finance.yahoo.com/news/${slug}`,
  content: { title: scope === 'market' ? 'US stocks rebound after policy worries' : 'Micron memory demand', source: { type: 'text', data: 'Published 2026-11-06\n' + (scope === 'market'
    ? 'US stocks rebounded after investors considered new policy concerns. Reports describe uncertainty about future chip demand, not confirmed cancellations.\n'
    : 'Micron shares moved after investors considered memory demand. Future orders remain uncertain and the report does not confirm an earnings change.\n').repeat(3) } } } });
const start = (content_block: unknown) => ({ event: { type: 'content_block_start', index: 0, content_block } });
const text = (value: string) => ({ event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: value } } });
const search = { type: 'web_search_tool_result', content: [] };
const final = (content: unknown[], output_tokens = 900) => ({ model: 'claude-haiku-5-5', stop_reason: 'end_turn', content, usage: { input_tokens: 50_000, output_tokens, server_tool_use: { web_search_requests: 1 } } });
function gate() { let open!: () => void; const wait = new Promise<void>(resolve => { open = resolve; }); return { wait, open }; }
/** Runs the shared (two fetches) and company (one fetch) lanes with the given scripts. */
async function collect(shared: { steps: Step[]; final: unknown }, company: { steps: Step[]; final: unknown }) {
  m.scripts.push(shared, company);
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  let writes!: Promise<unknown>;
  const articles = await collectAssistantArticles(packet, undefined, false, write => { writes = write; });
  return { articles, writes };
}

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); m.scripts.length = 0; m.requests.length = 0; vi.stubEnv('ANTHROPIC_API_KEY', 'fixture-not-a-key'); });
afterEach(() => vi.unstubAllEnvs());

it('returns the articles once the allowed fetches are used, and records real usage when the calls end', async () => {
  const sharedTail = gate(), companyTail = gate();
  const { articles, writes } = await collect(
    { steps: [start(search), start(fetched('market', 'a')), start(fetched('market', 'b')), { wait: sharedTail.wait }, start({ type: 'text', text: '' }), text('done')], final: final([search, fetched('market', 'a'), fetched('market', 'b')], 1500) },
    { steps: [start(search), start(fetched('company')), { wait: companyTail.wait }, start({ type: 'text', text: '' }), text('done')], final: final([search, fetched('company')], 700) });
  // Both calls are still open: the answer does not wait for their closing text.
  expect(articles.map(article => article.scope)).toEqual(['market', 'market', 'company']);
  expect(m.record).not.toHaveBeenCalled();
  sharedTail.open(); companyTail.open();
  await writes;
  expect(m.record).toHaveBeenCalledTimes(2);
  expect(m.record.mock.calls.map(([entry]) => [entry.outputTokens, entry.inputTokens, entry.webSearchRequests, entry.success]).sort()).toEqual([[1500, 50_000, 1, true], [700, 50_000, 1, true]]);
});

it('stops waiting when the model starts a closing summary after its results', async () => {
  const tail = gate();
  const summary = 'The report explains that investors weighed new policy concerns against chip demand, and that several large technology companies moved together during the session, which is why '.repeat(2);
  const { articles, writes } = await collect(
    { steps: [start(search), start(fetched('market')), start({ type: 'text', text: '' }), text(summary), { wait: tail.wait }, text(summary)], final: final([search, fetched('market')]) },
    { steps: [start(search), start({ type: 'text', text: '' }), text('No company report in this window. '), start({ type: 'text', text: '' }), { wait: tail.wait }], final: final([search]) });
  expect(articles.map(article => article.scope)).toEqual(['market']);
  tail.open();
  await writes;
  // A call that found nothing is still recorded, as before, as an unsuccessful lookup.
  expect(m.record.mock.calls.map(([entry]) => entry.success).sort()).toEqual([false, true]);
});

it('keeps waiting through a short note before another fetch', async () => {
  const { articles } = await collect(
    { steps: [start(search), start(fetched('company', 'recap')), start({ type: 'text', text: '' }), text('That was a company recap. Fetching the market report.'), start({ type: 'server_tool_use', name: 'web_fetch' }), start(fetched('market'))], final: final([search, fetched('company', 'recap'), fetched('market')]) },
    { steps: [start(search), start(fetched('company'))], final: final([search, fetched('company')]) });
  expect(articles.map(article => article.scope)).toEqual(['market', 'company']);
});

it('keeps an article that arrived before the connection dropped, and reports a call that failed with nothing', async () => {
  const { articles, writes } = await collect(
    { steps: [start(search), { fail: new Error('connection reset') }], final: undefined },
    { steps: [start(search), start(fetched('company')), { fail: new Error('connection reset') }], final: undefined });
  expect(articles.map(article => article.scope)).toEqual(['company']);
  await writes;
  // No usage is known for a call that never finished, so nothing is invented for the ledger.
  expect(m.record).not.toHaveBeenCalled();
});

it('still waits for the cost records when the caller does not track them', async () => {
  const tail = gate();
  m.scripts.push({ steps: [start(search), start(fetched('market', 'a')), start(fetched('market', 'b')), { wait: tail.wait }], final: final([search, fetched('market', 'a'), fetched('market', 'b')]) },
    { steps: [start(search), start(fetched('company'))], final: final([search, fetched('company')]) });
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  let settled = false;
  const pending = collectAssistantArticles(packet).then(value => { settled = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(settled).toBe(false);
  tail.open();
  expect(await pending).toHaveLength(3);
  expect(m.record).toHaveBeenCalledTimes(2);
});
