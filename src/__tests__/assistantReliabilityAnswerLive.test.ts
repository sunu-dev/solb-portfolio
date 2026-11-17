/** Explicitly approved generation only; reuses captured public evidence, one call, no DB/account API. */
import {it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import type {AssistantEvidencePacket} from '@/lib/assistantEvidence';
import type {AssistantQuestion} from '@/lib/assistantQuestion';
it.skipIf(process.env.JOOBI_LIVE_RELIABILITY_ANSWER!=='1')('answers the actual two-date question from retrieved company evidence',async()=>{
 process.loadEnvFile('.env.local');
 const {q:capturedQuestion,packet}=JSON.parse(readFileSync('/private/tmp/joobi-reliability-replay.json','utf8')) as {q:AssistantQuestion;packet:AssistantEvidencePacket};
 const {resolveAssistantSubject}=await import('@/lib/assistantSubject');
 const q=process.env.JOOBI_LIVE_QUESTION ? resolveAssistantSubject({...capturedQuestion,text:process.env.JOOBI_LIVE_QUESTION}).question : capturedQuestion;
 const {assistantQuestionPrompt,assistantReportIssue,assistantContextIssue}=await import('@/lib/assistantQuestion');
 const {newsAnswerIssue}=await import('@/lib/assistantNewsAssessment');
 const {companyAnalysisContext}=await import('@/lib/companyAnalysisContext');
 const business=await companyAnalysisContext(packet.symbol);
 const {callClaudeAnalysis}=await import('@/lib/claudeAnalysis');
 const {parseAnalysisResponse}=await import('@/lib/aiAnalysisResponse');
 const result=await callClaudeAnalysis(assistantQuestionPrompt(q,{evidence:packet,business:business.prompt}),true,true,false,true,'medium','claude-sonnet-5-5').catch(error=>{ const cause=error.cause as {status?:number;error?:unknown}|undefined;writeFileSync('/private/tmp/joobi-reliability-generation-error.json',JSON.stringify({message:error.message,status:cause?.status,error:cause?.error}));throw error;});
 const report=parseAnalysisResponse(result.text,true,result.finishReason,undefined,true);
 writeFileSync(`/private/tmp/joobi-reliability-answer${process.env.JOOBI_LIVE_CASE || ''}.json`,JSON.stringify({report,usage:result.usage,latencyMs:result.latencyMs}));
 expect(assistantReportIssue(report,packet,true)).toBeUndefined();
 expect(assistantContextIssue(report,q)).toBeUndefined();
 expect(newsAnswerIssue(report,packet)).toBeUndefined();
 expect(report.currentStatus).toMatch(/탐지|보안|AI\s*안경|부정행위/);
 expect(report.currentStatus).toMatch(/오늘|17일/);
 expect(report.currentStatus).not.toMatch(/오늘.{0,20}(?:가격|하락).{0,10}확인하지 못/);
},55_000);
