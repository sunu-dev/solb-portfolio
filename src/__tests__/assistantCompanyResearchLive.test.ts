/** Opt-in only: up to two searches and one generation. Requires a fresh explicit user budget. */
import { it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
it.skipIf(process.env.JOOBI_LIVE_COMPANY_RESEARCH !== '1')('researches and answers the Anthropic IPO question end to end', async () => {
  process.loadEnvFile('.env.local');
  const { resolveAssistantSubject } = await import('@/lib/assistantSubject');
  const { companyResearchPacket } = await import('@/lib/assistantCompanyResearch');
  const { collectAssistantArticles } = await import('@/lib/assistantArticleSources');
  const { assistantQuestionPrompt, assistantReportIssue, assistantContextIssue } = await import('@/lib/assistantQuestion');
  const { callClaudeAnalysis } = await import('@/lib/claudeAnalysis');
  const { parseAnalysisResponse } = await import('@/lib/aiAnalysisResponse');
  const q = resolveAssistantSubject({ text: '앤스로픽이 상장하면 어떨거 같아', unclearTerms: [] }).question;
  const packet = companyResearchPacket(q)!;
  if (process.env.JOOBI_COMPANY_RESEARCH_REPLAY_ONLY === '1') {
    const savedPacket = JSON.parse(readFileSync('/private/tmp/joobi-company-research-evidence.json', 'utf8'));
    const { report } = JSON.parse(readFileSync('/private/tmp/joobi-company-research-answer.json', 'utf8'));
    const { cleanAssistantAnswer } = await import('@/lib/assistantEvidence');
    expect(assistantReportIssue(cleanAssistantAnswer(report, savedPacket), savedPacket, true)).toBeUndefined();
    expect(assistantContextIssue(report, q)).toBeUndefined();
    return;
  }

  if (process.env.JOOBI_COMPANY_RESEARCH_SUPPLEMENT_ONLY === '1') {
    packet.evidence = JSON.parse(readFileSync('/private/tmp/joobi-company-research-evidence.json', 'utf8')).evidence;
    packet.evidence = await collectAssistantArticles(packet, undefined, false, undefined, 1);
    writeFileSync('/private/tmp/joobi-company-research-supplement.json', JSON.stringify(packet));
    const { companyResearchCoverage } = await import('@/lib/assistantCompanyResearch');
    expect(companyResearchCoverage(packet.evidence).business).toBe(true);
    return;
  }
  packet.evidence = await collectAssistantArticles(packet);
  writeFileSync('/private/tmp/joobi-company-research-evidence.json', JSON.stringify(packet));
  expect(packet.evidence.length).toBeGreaterThan(0);
  const result = await callClaudeAnalysis(assistantQuestionPrompt(q, { evidence: packet }), true, true, false, true, 'medium', 'claude-sonnet-5-5');
  const report = parseAnalysisResponse(result.text, true, result.finishReason, undefined, true);
  writeFileSync('/private/tmp/joobi-company-research-answer.json', JSON.stringify({ report, usage: result.usage, latencyMs: result.latencyMs }));
  const { cleanAssistantAnswer } = await import('@/lib/assistantEvidence');
  expect(assistantReportIssue(cleanAssistantAnswer(report, packet), packet, true)).toBeUndefined();
  expect(assistantContextIssue(report, q)).toBeUndefined();
  // These assertions are safeguards, not a substitute for reading sources and the complete answer.
  expect(report.currentStatus).toMatch(/앤스로픽|Anthropic/i);
  expect(report.currentStatus).toMatch(/상장|기업공개|IPO/i);
}, 90_000);
