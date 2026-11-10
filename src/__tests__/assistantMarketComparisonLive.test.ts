import { expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { collectAssistantEvidence } from '@/lib/assistantEvidenceSource';
import { assistantQuestionPrompt, validAssistantReport, parseAssistantQuestion } from '@/lib/assistantQuestion';
import { assistantFollowUps } from '@/lib/assistantEvidence';
import { callClaudeAnalysis } from '@/lib/claudeAnalysis';
import { parseAnalysisResponse } from '@/lib/aiAnalysisResponse';
import { governAiAnalysisReport } from '@/lib/aiAnalysisGuard';
import { estimateAiCostUsd } from '@/lib/aiCostLedger';
it.skipIf(process.env.JOOBI_MARKET_COMPARISON_LIVE !== '1')('sends the user-requested market question through the real engine and Claude', async () => {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^(ANTHROPIC_API_KEY|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  const body = { questionId: 'ask-joobi', questionText: '오늘 왜이렇게 장이 떨어지넌거야?', questionConsent: true, symbol: 'GENERAL', questionMarket: 'kr', questionPeriod: '1d' };
  const question = parseAssistantQuestion(body)!;
  const evidence = await collectAssistantEvidence('^KS11', question.period!, false);
  const result = await callClaudeAnalysis(assistantQuestionPrompt(question, { evidence }), true, true, false, true);
  let report: Record<string, unknown> | undefined;
  try { report = parseAnalysisResponse(result.text, true, result.finishReason, undefined, true); } catch { /* Retain public synthetic test output even on rejection. */ }
  const valid = !!report && validAssistantReport(report, evidence, true);
  const governed = report ? governAiAnalysisReport(report) : undefined;
  if (report && valid) report.followUps = assistantFollowUps(report.followUps as string[]);
  const directory = 'artifacts/assistant-evidence-20261104'; mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/user-market-comparison.json`, JSON.stringify({ askedAt: new Date().toISOString(), body, evidence,
    model: result.model, provider: result.provider, latencyMs: result.latencyMs, usage: result.usage, estimatedUsd: estimateAiCostUsd(result.model, result.usage),
    raw: result.text, report, valid, blocked: governed?.blockedCount, note: 'Real public source collector and configured Claude API. No Codex answer supplied to Claude. No user account/quota writes. The response is a candidate-engine test, not the deployed free-question endpoint.' }, null, 2));
  expect(valid).toBe(true); expect(governed?.blockedCount).toBe(0);
}, 100_000);
