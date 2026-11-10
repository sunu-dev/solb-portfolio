import { expect, it, vi } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolveAssistantSubject } from '@/lib/assistantSubject';
import { collectAssistantEvidence } from '@/lib/assistantEvidenceSource';
import { collectAssistantArticles } from '@/lib/assistantArticleSources';
import { companyAnalysisContext } from '@/lib/companyAnalysisContext';
import { assistantQuestionPrompt, validAssistantReport, type AssistantQuestion } from '@/lib/assistantQuestion';
import { callClaudeAnalysis } from '@/lib/claudeAnalysis';
import { parseAnalysisResponse } from '@/lib/aiAnalysisResponse';
import { cleanAssistantAnswer } from '@/lib/assistantEvidence';
import { governAiAnalysisReport } from '@/lib/aiAnalysisGuard';
import { estimateAiCostUsd, type AiCostEntry } from '@/lib/aiCostLedger';
const costs = vi.hoisted(() => [] as AiCostEntry[]);
vi.mock('@/lib/aiCostLedger', async original => ({ ...await original<typeof import('@/lib/aiCostLedger')>(), recordAiCost: async (entry: AiCostEntry) => { costs.push(entry); } }));

it.skipIf(process.env.JOOBI_LATENCY_LIVE !== '1')('measures public-question stages, identity and the real Haiku answer without using account quota', async () => {
 for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const match = line.match(/^(ANTHROPIC_API_KEY|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
 }
 const dir = 'artifacts/joobi-chat-quality-20261105'; mkdirSync(dir, { recursive: true });
 const results: unknown[] = [];
 let previous = '';
 const question: AssistantQuestion = { text: '마이크론은 왜이렇게 떨어지는거야?', unclearTerms: [], market: 'kr', period: '1d', history: [] };
 for (const mode of ['baseline-general', 'resolved-cold', 'resolved-followup'] as const) {
  if (process.env.JOOBI_LATENCY_RESOLVED_ONLY === '1' && mode === 'baseline-general') continue;
  const stages: Record<string, number> = {};
  const measure = async <T>(name: string, fn: () => Promise<T>) => { const t = performance.now(); try { return await fn(); } finally { stages[name] = Math.round(performance.now() - t); } };
  const start = performance.now(), costStart = costs.length;
  const q = mode === 'baseline-general' ? question : await measure('identity', async () => resolveAssistantSubject(mode === 'resolved-followup' ? { ...question, text: '그게 이 회사가 파는 제품이랑 어떻게 연결돼?', history: [{ question: question.text, answer: previous }] } : question).question);
  const symbol = q.symbol ?? (q.market === 'us' ? '^GSPC' : '^KS11');
  const business = q.symbol ? await measure('business', () => companyAnalysisContext(q.symbol!)) : undefined;
  const packet = await measure('marketEvidence', () => collectAssistantEvidence(symbol, '1d'));
  const articles = await measure('articleResearch', () => collectAssistantArticles(packet));
  const evidence = { ...packet, evidence: [...packet.evidence, ...articles] };
  expect(articles.length, 'Match the route: no news-cause answer without article bodies').toBeGreaterThan(0);
  const prompt = assistantQuestionPrompt(q, { business: business?.prompt, evidence });
  const answer = await measure('answer', () => callClaudeAnalysis(prompt, true, true, false, true));
  const report = cleanAssistantAnswer(parseAnalysisResponse(answer.text, true, answer.finishReason, undefined, true), evidence);
  const valid = validAssistantReport(report, evidence, true);
  previous = String(report.currentStatus);
  results.push({ mode, resolvedSymbol: symbol, stagesMs: stages, totalMs: Math.round(performance.now() - start), price: packet.price, comparisons: packet.comparisons,
    articleCount: articles.length, sources: articles.map(({ text, ...meta }) => ({ ...meta, passageChars: text.length })), gaps: packet.gaps,
    report, valid, blocked: governAiAnalysisReport(report).blockedCount, usage: answer.usage, model: answer.model, estimatedAnswerUsd: estimateAiCostUsd(answer.model, answer.usage),
    retrievalCosts: costs.slice(costStart).map(entry => ({ ...entry, estimatedUsd: estimateAiCostUsd(entry.model, entry) })), promptBytes: Buffer.byteLength(prompt) });
  writeFileSync(`${dir}/latency-live.json`, JSON.stringify({ checkedAt: new Date().toISOString(), note: 'Local pipeline using production-equivalent functions. Excludes authentication/quota/ledger writes, network to Joobi and browser rendering. Public fixed questions only. N=1 each; not production percentiles.', results }, null, 2));
  expect(valid).toBe(true);
 }
}, 240_000);
