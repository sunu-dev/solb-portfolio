import { expect, it } from 'vitest';
import { loadEnvConfig } from '@next/env';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { collectAssistantEvidence } from '@/lib/assistantEvidenceSource';
import { assistantQuestionPrompt, validAssistantReport, type AssistantQuestion } from '@/lib/assistantQuestion';
import { formatCompanyAnalysisContext } from '@/lib/companyAnalysisContext';
import { callClaudeAnalysis } from '@/lib/claudeAnalysis';
import { parseAnalysisResponse } from '@/lib/aiAnalysisResponse';
import { governAiAnalysisReport } from '@/lib/aiAnalysisGuard';
import { estimateAiCostUsd } from '@/lib/aiCostLedger';
import { fundAnalysisContext } from '@/lib/fundQuestionContext';

it.skipIf(process.env.JOOBI_ASSISTANT_LIVE !== '1')('reviews real public evidence and Haiku answers without personal data or account quota', async () => {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^(ANTHROPIC_API_KEY|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  expect(!!process.env.ANTHROPIC_API_KEY).toBe(true);
  const directory = 'artifacts/assistant-evidence-20261104'; mkdirSync(directory, { recursive: true });
  const results: unknown[] = [];
  let prior: { question: string; answer: string }[] = [];
  for (const [symbol, text, fund] of [
    ['MU', '왜 이렇게 떨어졌어요?', false],
    ['MU', '그럼 이 회사만의 문제인지 어떻게 구분해요?', false],
    ['340810.KQ', '시선AI도 시장이랑 같이 떨어졌나요?', false],
    ['^KS11', '오늘 엄청 떨어졌다가 올랐는데 이유가 뭐예요?', false],
    ['SOXL', '반도체가 다시 오르면 제 돈도 원래대로 돌아오나요?', true],
  ] as const) {
    if (process.env.JOOBI_ASSISTANT_LIVE_SYMBOLS && !process.env.JOOBI_ASSISTANT_LIVE_SYMBOLS.split(',').includes(symbol)) continue;
    const evidence = await collectAssistantEvidence(symbol, '1d', fund);
    let business: string | undefined;
    if (!fund) {
      try {
        const response = await fetch(`https://joobi.kr/api/company-profile?symbol=${encodeURIComponent(symbol)}`, { signal: AbortSignal.timeout(15000) });
        const profile = await response.json();
        if (profile.data?.business) business = formatCompanyAnalysisContext(symbol, profile.data.business);
      } catch { /* The report must expose missing business context. */ }
    }
    const question: AssistantQuestion = { text, symbol, unclearTerms: [], period: '1d', history: symbol === 'MU' ? prior : [] };
    const generated = await callClaudeAnalysis(assistantQuestionPrompt(question, { evidence, business, product: fund ? fundAnalysisContext(symbol) : undefined }), true, true, false, true);
    writeFileSync(`${directory}/last-provider-response.json`, JSON.stringify({ symbol, question: text, evidence, raw: generated.text, usage: generated.usage, estimatedUsd: estimateAiCostUsd(generated.model, generated.usage) }, null, 2));
    const report = parseAnalysisResponse(generated.text, true, generated.finishReason, undefined, true);
    const valid = validAssistantReport(report, evidence, true), governed = governAiAnalysisReport(report);
    results.push({ symbol, question: text, evidence, report, valid, blocked: governed.blockedCount, latencyMs: generated.latencyMs, usage: generated.usage, estimatedUsd: estimateAiCostUsd(generated.model, generated.usage) });
    writeFileSync(`${directory}/live-results.json`, JSON.stringify(results, null, 2));
    expect(valid).toBe(true); expect(governed.blockedCount).toBe(0);
    if (symbol === 'MU') prior = [{ question: text, answer: [report.currentStatus, ...(report.keyAdvice as string[]), ...(report.assistantInsights as { text: string }[]).map(i => i.text)].join('\n').slice(0, 1800) }];
  }
}, 240_000);
