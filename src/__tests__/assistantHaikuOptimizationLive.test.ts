import { expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { cleanAssistantAnswer } from '@/lib/assistantEvidence';
import { collectAssistantArticles } from '@/lib/assistantArticleSources';
import { collectAssistantEvidence } from '@/lib/assistantEvidenceSource';
import { assistantQuestionPrompt, validAssistantReport } from '@/lib/assistantQuestion';
import { companyAnalysisContext } from '@/lib/companyAnalysisContext';
import { fundAnalysisContext } from '@/lib/fundQuestionContext';
import { callClaudeAnalysis } from '@/lib/claudeAnalysis';
import { parseAnalysisResponse } from '@/lib/aiAnalysisResponse';
import { governAiAnalysisReport } from '@/lib/aiAnalysisGuard';
import { estimateAiCostUsd, type AiCostEntry } from '@/lib/aiCostLedger';
const recorded = vi.hoisted(() => [] as AiCostEntry[]);
vi.mock('@/lib/aiCostLedger', async original => ({ ...await original<typeof import('@/lib/aiCostLedger')>(), recordAiCost: async (entry: AiCostEntry) => { recorded.push(entry); } }));
it.skipIf(process.env.JOOBI_HAIKU_OPTIMIZATION_LIVE !== '1')('retrieves real articles and answers the user with Haiku only', async () => {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^(ANTHROPIC_API_KEY|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  const dir = 'artifacts/assistant-evidence-20261104'; mkdirSync(dir, { recursive: true });
  const packet = await collectAssistantEvidence('^KS11', '1d');
  const started = Date.now();
  const articles = await collectAssistantArticles(packet);
  const evidence = { ...packet, evidence: [...packet.evidence, ...articles] };
  const retrievalMs = Date.now() - started;
  writeFileSync(`${dir}/haiku-retrieval-status.json`, JSON.stringify({ retrievalMs, articleCount: articles.length, costs: recorded }, null, 2));
  expect(articles.length).toBeGreaterThan(0);
  const calls = recorded.length;
  expect(await collectAssistantArticles(packet)).toEqual(articles);
  expect(recorded).toHaveLength(calls);
  const results: unknown[] = [];
  let history: { question: string; answer: string }[] = [];
  for (const text of ['오늘 왜이렇게 장이 떨어지넌거야?', '그게 왜 반도체 회사가 벌 돈에 영향을 줘요?']) {
    const prompt = assistantQuestionPrompt({ text, unclearTerms: [], market: 'kr', period: '1d', history }, { evidence });
    const answer = await callClaudeAnalysis(prompt, true, true, false, true);
    const report = cleanAssistantAnswer(parseAnalysisResponse(answer.text, true, answer.finishReason, undefined, true), evidence);
    const valid = validAssistantReport(report, evidence, true);
    results.push({ question: text, report, valid, blocked: governAiAnalysisReport(report).blockedCount, latencyMs: answer.latencyMs, usage: answer.usage, estimatedUsd: estimateAiCostUsd(answer.model, answer.usage), promptBytes: Buffer.byteLength(prompt) });
    // Save source metadata, never redistribute article bodies.
    writeFileSync(`${dir}/haiku-optimized-live.json`, JSON.stringify({ retrievalMs, price: packet.price, sourceIds: evidence.evidence.map(e => e.id), sources: articles.map(({ text: body, ...metadata }) => ({ ...metadata, passageChars: body.length })),
      retrievalCosts: recorded.map(entry => ({ ...entry, estimatedUsd: estimateAiCostUsd(entry.model, entry) })), results }, null, 2));
    expect(valid).toBe(true);
    history = [{ question: text, answer: String(report.currentStatus) }];
  }
  expect(articles.length).toBeGreaterThan(0);
  expect(recorded.every(entry => entry.model.includes('haiku'))).toBe(true);
}, 180_000);

it.skipIf(process.env.JOOBI_HAIKU_SUITE_LIVE !== '1')('reviews stock news, a company product, a leveraged fund example and a beginner definition', async () => {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^(ANTHROPIC_API_KEY|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  const results: unknown[] = [];
  for (const [symbol, text] of [
    ['MU', '마이크론 최근 주가가 움직인 이유가 뭐예요?'],
    ['340810.KQ', 'SEEU ON은 어디에 쓰고 누가 돈을 내나요?'],
    ['SOXL', '만약 반도체 지수가 10% 떨어졌다가 다음 날 10% 오르면 SOXL도 원래 금액으로 돌아오나요?'],
    ['', 'ETF는 주식과 뭐가 달라요?'],
  ]) {
    if (process.env.JOOBI_HAIKU_SUITE_SYMBOLS && !process.env.JOOBI_HAIKU_SUITE_SYMBOLS.split(',').includes(symbol || 'GENERAL')) continue;
    const packet = symbol === 'MU' ? await collectAssistantEvidence(symbol, '1d') : undefined;
    const articles = packet ? await collectAssistantArticles(packet) : [];
    const evidence = packet ? { ...packet, evidence: [...packet.evidence, ...articles] } : undefined;
    const business = symbol && symbol !== 'SOXL' ? await companyAnalysisContext(symbol) : undefined;
    const prompt = assistantQuestionPrompt({ symbol: symbol || undefined, text, unclearTerms: [], period: '1d' }, { evidence, business: business?.prompt, product: symbol === 'SOXL' ? fundAnalysisContext(symbol) : undefined });
    const answer = await callClaudeAnalysis(prompt, true, true, false, true);
    const report = cleanAssistantAnswer(parseAnalysisResponse(answer.text, true, answer.finishReason, undefined, true), evidence);
    const valid = validAssistantReport(report, evidence, true), blocked = governAiAnalysisReport(report).blockedCount;
    results.push({ symbol, question: text, report, valid, blocked, sourceCount: articles.length, sources: articles.map(({ text: body, ...metadata }) => ({ ...metadata, passageChars: body.length })),
      latencyMs: answer.latencyMs, usage: answer.usage, estimatedUsd: estimateAiCostUsd(answer.model, answer.usage), promptBytes: Buffer.byteLength(prompt) });
    writeFileSync(`artifacts/assistant-evidence-20261104/${process.env.JOOBI_HAIKU_SUITE_SYMBOLS ? 'haiku-concepts-review' : 'haiku-optimized-suite'}.json`, JSON.stringify({ results, retrievalCosts: recorded.map(entry => ({ ...entry, estimatedUsd: estimateAiCostUsd(entry.model, entry) })) }, null, 2));
    expect(valid).toBe(true); expect(blocked).toBe(0);
    if (packet) expect(articles.length).toBeGreaterThan(0);
  }
}, 240_000);
