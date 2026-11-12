import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { assistantQuestionPrompt, assistantReportIssue, assistantContextIssue, assistantNeedsMarketEvidence, assistantNeedsArticles, assistantStatusQuestion, assistantAsksForCause, assistantUnsourcedCauseIssue, assistantReasoningEffort, assistantGenerationModel, GENERAL_SUBJECT, type AssistantQuestion, type AssistantTurn } from '@/lib/assistantQuestion';
import { assistantRepairPrompt } from '@/lib/assistantRepair';
import { resolveAssistantSubject } from '@/lib/assistantSubject';
import { assistantConversationIntent } from '@/lib/assistantIntent';
import { collectAssistantEvidence } from '@/lib/assistantEvidenceSource';
import { collectAssistantArticles } from '@/lib/assistantArticleSources';
import { companyAnalysisContext } from '@/lib/companyAnalysisContext';
import { callClaudeAnalysis } from '@/lib/claudeAnalysis';
import { parseAnalysisResponse } from '@/lib/aiAnalysisResponse';
import { cleanAssistantAnswer, assistantFollowUps, type AssistantEvidencePacket } from '@/lib/assistantEvidence';
import { governAiAnalysisReport } from '@/lib/aiAnalysisGuard';
import { isFundAnalysis } from '@/lib/fundQuestionContext';

// 합성 질문으로 여러 차례 대화를 실제 모델에 보내 답을 읽어보는 검수 도구. 인증·횟수 기록 없이 서버 경로의 조립 순서를 따른다.
// 실행: JOOBI_REVIEW_LIVE=1 JOOBI_REVIEW_SCENARIOS=<시나리오 json> JOOBI_REVIEW_OUT=<결과 json> npx vitest run 이 파일. 실제 AI 비용이 든다.
// 시나리오 형식: [{ name, symbol?, market: 'kr'|'us', turns: string[], noArticles?: boolean }]. 실제 사용자 대화는 넣지 않는다.
// noArticles: true 는 기사 수집을 건너뛰어 '기사 없이 답하는' 경로(가격 비교 + 이유 미확인)를 읽어보기 위한 것이다.
// 서버 경로의 재작성(repair)·기사 캐시·이용 횟수는 재현하지 않으므로 브라우저 검수를 대신하지 않는다.
it.skipIf(process.env.JOOBI_REVIEW_LIVE !== '1')('synthetic beginner conversations', async () => {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  const scenarios: { name: string; symbol?: string; market: 'kr' | 'us'; turns: string[]; noArticles?: boolean }[] = JSON.parse(readFileSync(process.env.JOOBI_REVIEW_SCENARIOS!, 'utf8'));
  const out: unknown[] = [];
  for (const scenario of scenarios) {
    const history: AssistantTurn[] = [];
    for (const text of scenario.turns) {
      const started = Date.now();
      const record: Record<string, unknown> = { scenario: scenario.name, question: text };
      try {
        const base: AssistantQuestion = { text, symbol: scenario.symbol, unclearTerms: [], period: '1d', market: scenario.market, history: history.slice(-3) };
        const resolved = resolveAssistantSubject(base);
        if (resolved.candidates.length > 1) { record.outcome = 'ambiguous'; record.candidates = resolved.candidates; out.push(record); continue; }
        const q = resolved.question;
        const symbol = q.symbol ?? GENERAL_SUBJECT;
        const isFund = symbol !== GENERAL_SUBJECT && isFundAnalysis(symbol, '');
        record.route = { symbol, market: q.market, period: q.period, intent: assistantConversationIntent(q), needsEvidence: assistantNeedsMarketEvidence(q), needsArticles: assistantNeedsArticles(q), status: assistantStatusQuestion(q), effort: assistantReasoningEffort(q), model: assistantGenerationModel(q) };
        const business = symbol === GENERAL_SUBJECT || isFund ? null : await companyAnalysisContext(symbol);
        let evidence: AssistantEvidencePacket | undefined;
        if (assistantNeedsMarketEvidence(q)) {
          const collected = await collectAssistantEvidence(q.symbol ?? (q.market === 'us' ? '^GSPC' : '^KS11'), q.period ?? '1d', isFund, q.sessionReference, q.industryFocus);
          evidence = { ...collected, evidence: [...collected.evidence] };
          if (!scenario.noArticles && (assistantNeedsArticles(q) || assistantStatusQuestion(q))) evidence.evidence.push(...await collectAssistantArticles(evidence, () => {}, false, () => {}));
        }
        const sourcesMs = Date.now() - started;
        // Same rule as the route: a question that needs reporting but found none is answered from the confirmed prices only.
        const explainsMove = assistantConversationIntent(q) === 'explain';
        const withoutReporting = Boolean(evidence && assistantNeedsArticles(q) && !evidence.evidence.some(e => e.kind === 'article' || e.kind === 'publication'));
        if (withoutReporting && evidence) {
          if (explainsMove && !evidence.price) { Object.assign(record, { outcome: 'articles_unavailable_503', sourcesMs }); out.push(record); writeFileSync(process.env.JOOBI_REVIEW_OUT!, JSON.stringify(out, null, 2)); continue; }
          evidence.evidence = evidence.evidence.filter(e => e.kind !== 'headline');
          evidence.gaps = [...evidence.gaps.filter(gap => !/뉴스|기사|소식/.test(gap)), '이 움직임을 설명하는 기사 본문이나 발표 자료를 가져오지 못했어요. 그래서 이유는 확인하지 못했고, 가격 비교까지만 답했어요.'];
        }
        // Same scope as the route: every explanation written without reporting is checked; only a direct why-question must also say the reason is unconfirmed.
        const unsourcedCauseIssue = (candidate: Record<string, unknown>) => withoutReporting && explainsMove ? assistantUnsourcedCauseIssue(candidate, { asksWhy: assistantAsksForCause(q) }) : undefined;
        if (!evidence && business?.sources.length) evidence = { version: 1, symbol, period: q.period ?? '1d', checkedAt: new Date().toISOString(), comparisons: [], evidence: [], gaps: [] } as AssistantEvidencePacket;
        const reference = business?.sources.find(source => /^https:\/\//.test(source.url));
        if (evidence && reference && business?.prompt) evidence.evidence.push({ id: 'R1', kind: 'reference', scope: 'company', title: `${symbol} 회사 사업`, text: business.prompt.slice(0, 5000), url: reference.url, publisher: reference.label, publishedAt: reference.reviewedAt || '', checkedAt: reference.reviewedAt || '' } as AssistantEvidencePacket['evidence'][number]);
        const prompt = assistantQuestionPrompt(q, { business: business?.prompt, evidence, withoutReporting });
        let response = await callClaudeAnalysis(prompt, true, true, false, true, assistantReasoningEffort(q), assistantGenerationModel(q));
        let report = cleanAssistantAnswer(parseAnalysisResponse(response.text, true, response.finishReason, undefined, true), evidence);
        const firstIssue = assistantContextIssue(report, q) ?? unsourcedCauseIssue(report);
        if (firstIssue) {
          // One bounded rewrite, as on the server.
          record.rewrittenFor = firstIssue; record.firstAttempt = report.currentStatus;
          response = await callClaudeAnalysis(assistantRepairPrompt(prompt, firstIssue), true, true, false, true, 'medium', assistantGenerationModel(q));
          report = cleanAssistantAnswer(parseAnalysisResponse(response.text, true, response.finishReason, undefined, true), evidence);
        }
        const unsourced = unsourcedCauseIssue(report);
        const issue = assistantReportIssue(report, evidence, true);
        report.followUps = assistantFollowUps(report.followUps as string[]);
        const guard = governAiAnalysisReport(report, { educationalQuestion: true });
        Object.assign(record, { outcome: issue || guard.blockedCount || assistantContextIssue(report, q) || unsourced ? 'rejected' : 'ok', issue, blocked: guard.blockedFields, contextIssue: assistantContextIssue(report, q) ?? unsourced, withoutReporting,
          sourcesMs, generationMs: response.latencyMs, totalMs: Date.now() - started, usage: response.usage, evidenceKinds: evidence?.evidence.map(e => `${e.id}:${e.kind}`),
          currentStatus: report.currentStatus, keyAdvice: report.keyAdvice, insights: report.assistantInsights, conclusion: report.conclusion, followUps: report.followUps });
        history.push({ question: text, symbol, market: q.market, period: q.period, sessionReference: q.sessionReference, industryFocus: q.industryFocus,
          answer: [report.currentStatus, ...(report.keyAdvice as string[]), ...((report.assistantInsights as { text: string }[] | undefined) ?? []).map(i => i.text), (report.conclusion as { desc: string }).desc].join('\n').slice(0, 1800) });
      } catch (error) { record.outcome = 'error'; record.error = error instanceof Error ? error.message : String(error); record.totalMs = Date.now() - started; }
      out.push(record);
      writeFileSync(process.env.JOOBI_REVIEW_OUT!, JSON.stringify(out, null, 2));
    }
  }
}, 900_000);
