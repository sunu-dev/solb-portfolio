import { expect, it, vi } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { collectAssistantEvidence } from '@/lib/assistantEvidenceSource';
import { collectAssistantArticles } from '@/lib/assistantArticleSources';
import { companyAnalysisContext } from '@/lib/companyAnalysisContext';
import { fundAnalysisContext, fundAnalysisSources } from '@/lib/fundQuestionContext';
import { assistantQuestionPrompt, assistantReportIssue } from '@/lib/assistantQuestion';
import { callClaudeAnalysis } from '@/lib/claudeAnalysis';
import { parseAnalysisResponse } from '@/lib/aiAnalysisResponse';
import { cleanAssistantAnswer } from '@/lib/assistantEvidence';
import { governAiAnalysisReport } from '@/lib/aiAnalysisGuard';
vi.mock('@/lib/aiCostLedger', async original => ({ ...await original<typeof import('@/lib/aiCostLedger')>(), recordAiCost: async () => {} }));
it.skipIf(process.env.JOOBI_MUU_LIVE !== '1')('answers the public MUU failure case with underlying-company sources', async () => {
 for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const match = line.match(/^(ANTHROPIC_API_KEY|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
 }
 const started=Date.now(); const packet=await collectAssistantEvidence('MUU','1d',true);
 const articles=await collectAssistantArticles(packet); packet.evidence.push(...articles);
 expect(articles.length, '본문 확보 실패 시 유료 답변 생성을 진행하지 않음').toBeGreaterThan(0);
 const product=fundAnalysisContext('MUU'), ref=fundAnalysisSources('MUU')[0];
 packet.evidence.push({id:'R1',kind:'reference',scope:'company',title:'MUU 상품 구조',text:product,url:ref.url,publisher:ref.provider,publishedAt:ref.retrievedAt,checkedAt:ref.retrievedAt});
 const company=await companyAnalysisContext('MU');
 if(company?.sources[0])packet.evidence.push({id:'R2',kind:'reference',scope:'company',title:'MU 회사 사업',text:company.prompt,url:company.sources[0].url,publisher:company.sources[0].label,publishedAt:company.sources[0].reviewedAt||'',checkedAt:company.sources[0].reviewedAt||''});
 const prompt=assistantQuestionPrompt({symbol:'MUU',text:'왜 이렇게 떨어지는 거야?',market:'us',period:'1d',unclearTerms:[]},{product,evidence:packet});
 const result=await callClaudeAnalysis(prompt,true,true,false,true);
 mkdirSync('artifacts/joobi-chat-followup-20261106',{recursive:true});
 writeFileSync('artifacts/joobi-chat-followup-20261106/muu-public-generation.json',JSON.stringify({finish:result.finishReason,usage:result.usage,text:result.text},null,2));
 const report=cleanAssistantAnswer(parseAnalysisResponse(result.text,true,result.finishReason,undefined,true),packet);
 const issue=assistantReportIssue(report,packet,true), governed=governAiAnalysisReport(report);
 const output={totalMs:Date.now()-started,issue,finish:result.finishReason,usage:result.usage,report,governed,price:packet.price,comparisons:packet.comparisons,sources:packet.evidence.map(source=>({...source,text:source.kind==='article'?'[본문 비공개]':source.text}))};
 mkdirSync('artifacts/joobi-chat-followup-20261106',{recursive:true});
 writeFileSync('artifacts/joobi-chat-followup-20261106/muu-diagnostic.json',JSON.stringify(output,null,2));
 expect(articles.length).toBeGreaterThan(0);expect(issue).toBeUndefined();expect(governed.blockedCount).toBe(0);
},150_000);
