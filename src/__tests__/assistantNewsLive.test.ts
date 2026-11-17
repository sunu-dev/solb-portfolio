/** Opt-in, one public regression query; no account API, quota change or database writes. */
import { expect, it, vi } from 'vitest';
import type { AssistantEvidencePacket } from '@/lib/assistantEvidence';
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock('@/lib/aiCostLedger', async original => ({ ...await original<typeof import('@/lib/aiCostLedger')>(), recordAiCost: async (entry: unknown) => { console.info('[live-cost]', entry); } }));
it.skipIf(process.env.JOOBI_LIVE_NEWS !== '1')('retrieves and explains a public company event with the actual provider', async () => {
  process.loadEnvFile('.env.local');
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  const { assessAssistantNews, newsAnswerIssue } = await import('@/lib/assistantNewsAssessment');
  const { assistantQuestionPrompt, assistantReportIssue, assistantContextIssue } = await import('@/lib/assistantQuestion');
  const { callClaudeAnalysis } = await import('@/lib/claudeAnalysis');
  const packet: AssistantEvidencePacket = { version: 1, symbol: '340810.KQ', period: '1d', checkedAt: new Date().toISOString(), evidence: [], gaps: [], comparisons: [],
    price: { symbol: '340810.KQ', label: '시선AI', day: '2026-11-16', baselineDay: '2026-11-13', at: '2026-11-16T06:30:00Z', price: 3200, changePercent: 26.23, currency: 'KRW', sessionState: 'closed' } };
  const started = Date.now();
  let writes: Promise<unknown> | undefined;
  packet.evidence = await collectAssistantArticles(packet, undefined, false, work => { writes = work; });
  console.info('[live-evidence]', JSON.stringify({ elapsedMs: Date.now() - started, assessment: assessAssistantNews(packet), sources: packet.evidence.map(e => ({ title: e.title, url: e.url, scope: e.scope, date: e.publishedAt })) }));
  await writes;
  expect(assessAssistantNews(packet).sourceIds.length).toBeGreaterThan(0);
  const question = { text: '시선AI는 어제 왜 그렇게 오른거야?', symbol: packet.symbol, period: '1d' as const, market: 'kr' as const, unclearTerms: [] };
  const result = await callClaudeAnalysis(assistantQuestionPrompt(question, { evidence: packet }), false, true, false, true, 'medium', 'claude-sonnet-5-5');
  const report = JSON.parse(result.text);
  console.info('[live-answer]', JSON.stringify({ report, usage: result.usage, latencyMs: result.latencyMs }));
  expect(assistantReportIssue(report, packet, true)).toBeUndefined();
  expect(assistantContextIssue(report, question)).toBeUndefined();
  expect(newsAnswerIssue(report, packet)).toBeUndefined();
}, 85_000);
