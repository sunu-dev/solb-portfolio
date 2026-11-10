import { it, expect } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { assistantQuestionPrompt, validAssistantReport } from '@/lib/assistantQuestion';
import { companyAnalysisContext } from '@/lib/companyAnalysisContext';
import { callClaudeAnalysis } from '@/lib/claudeAnalysis';
import { parseAnalysisResponse } from '@/lib/aiAnalysisResponse';
import { cleanAssistantAnswer } from '@/lib/assistantEvidence';
import { estimateAiCostUsd } from '@/lib/aiCostLedger';

// Only synthetic QA questions; never captures real users' conversation history.
it.skipIf(process.env.JOOBI_CONVERSATION_LIVE !== '1')('checks connected beginner explanations and unavailable company facts with Haiku', async () => {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^(ANTHROPIC_API_KEY|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  const business = await companyAnalysisContext('MU');
  const history: { question: string; answer: string }[] = [];
  const results: unknown[] = [];
  const dir = 'artifacts/joobi-conversation-20261105'; mkdirSync(dir, { recursive: true });
  for (const text of ['메모리 반도체는 뭐야?', '더 쉽게 설명해 줘', '예를 들어 설명해 줘', '마이크론은 뭘 파는 회사야?']) {
    const companyQuestion = text.startsWith('마이크론');
    const prompt = assistantQuestionPrompt({ text, symbol: companyQuestion ? 'MU' : undefined, market: 'us', period: '1d', history: companyQuestion ? [] : history.slice(-3), unclearTerms: [] }, companyQuestion ? { business: business?.prompt } : {});
    const response = await callClaudeAnalysis(prompt, true, true, false, true);
    const report = cleanAssistantAnswer(parseAnalysisResponse(response.text, true, response.finishReason, undefined, true));
    const valid = validAssistantReport(report, undefined, true);
    results.push({ question: text, report, valid, model: response.model, latencyMs: response.latencyMs, usage: response.usage, estimatedUsd: estimateAiCostUsd(response.model, response.usage) });
    writeFileSync(`${dir}/live-conversation.json`, JSON.stringify({ kind: 'synthetic provider QA, not authenticated browser/API endpoint or user data', companyContext: business?.prompt, results }, null, 2));
    expect(valid).toBe(true);
    history.push({ question: text, answer: [report.currentStatus, ...(report.keyAdvice as string[]), (report.conclusion as { desc: string }).desc].join('\n').slice(0,1800) });
  }
}, 180_000);
