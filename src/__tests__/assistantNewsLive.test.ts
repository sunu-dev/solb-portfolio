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
  const result = await callClaudeAnalysis(assistantQuestionPrompt(question, { evidence: packet }), true, true, false, true, 'medium', 'claude-sonnet-5-5');
  const { parseAnalysisResponse } = await import('@/lib/aiAnalysisResponse');
  const report = parseAnalysisResponse(result.text, true, result.finishReason, undefined, true);
  console.info('[live-answer]', JSON.stringify({ report, usage: result.usage, latencyMs: result.latencyMs }));
  expect(assistantReportIssue(report, packet, true)).toBeUndefined();
  expect(assistantContextIssue(report, question)).toBeUndefined();
  expect(newsAnswerIssue(report, packet)).toBeUndefined();
}, 85_000);


it.skipIf(process.env.JOOBI_REPLAY_NEWS !== '1')('replays the captured real response through the production normalizer without API calls', async () => {
  const { readFileSync } = await import('node:fs');
  const lines = readFileSync('/private/tmp/joobi-provider-live-2.log', 'utf8').split('\n');
  const answer = JSON.parse(lines.find(l => l.startsWith('[live-answer] '))!.slice('[live-answer] '.length));
  const captured = JSON.parse(lines.find(l => l.startsWith('[live-evidence] '))!.slice('[live-evidence] '.length));
  const { parseAnalysisResponse } = await import('@/lib/aiAnalysisResponse');
  const { assistantReportIssue, assistantContextIssue } = await import('@/lib/assistantQuestion');
  const { estimateAiCostUsd } = await import('@/lib/aiCostLedger');
  const report = parseAnalysisResponse(JSON.stringify(answer.report), true, 'STOP', undefined, true);
  // Metadata-only replay validates schema/IDs; it does not recreate or invent article bodies.
  const evidence: AssistantEvidencePacket = {version:1,symbol:'340810.KQ',period:'1d',checkedAt:'2026-11-17',comparisons:[],gaps:[],evidence:captured.sources.map((s: {url:string;title:string;date:string},i:number)=>({id:`A${i+1}`,kind:'article',scope:'company',text:'',url:s.url,title:s.title,publisher:'뉴스핌',publishedAt:s.date,checkedAt:'2026-11-17'}))};
  expect(assistantReportIssue(report,evidence,true)).toBeUndefined();
  expect(assistantContextIssue(report,{text:'시선AI는 어제 왜 그렇게 오른거야?',symbol:'340810.KQ',unclearTerms:[],market:'kr',period:'1d'})).toBeUndefined();
  console.info('[replay-cost-usd]',estimateAiCostUsd('claude-haiku-5-5',{inputTokens:43877,outputTokens:675,webSearchRequests:1})+estimateAiCostUsd('claude-sonnet-5-5',answer.usage));
});
