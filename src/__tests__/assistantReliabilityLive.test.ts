/** Explicit opt-in only. Public request, no account/quota/database mutations. */
import { it, expect, vi } from 'vitest';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
const state=vi.hoisted(()=>({calls:0}));
vi.mock('next/cache',()=>({unstable_cache:(fn:()=>unknown)=>fn}));
vi.mock('@/lib/marketWatchStore',()=>({readMarketWatch:async()=>({events:[],runs:[]})}));
vi.mock('@/lib/marketCause/companyPublication',()=>({readCompanyExplanations:async()=>({cards:[],warnings:[]})}));
vi.mock('@/lib/marketCause/officialPublication',()=>({readOfficialPolicies:async()=>({cards:[],warnings:[]})}));
vi.mock('@/lib/aiCostLedger',async original=>({...await original<typeof import('@/lib/aiCostLedger')>(),recordAiCost:async(entry:unknown)=>{appendFileSync('/private/tmp/joobi-reliability-costs.jsonl',JSON.stringify(entry)+'\n');}}));
vi.mock('@anthropic-ai/sdk',async original=>{
 const actual=await original<typeof import('@anthropic-ai/sdk')>();
 return {...actual,default:class extends actual.default {
  constructor(...args:ConstructorParameters<typeof actual.default>){super(...args);const stream=this.messages.stream.bind(this.messages);
   this.messages.stream=((...input:Parameters<typeof stream>)=>{if(++state.calls>Math.min(2,Number(process.env.JOOBI_LIVE_SEARCH_LIMIT || '1')))throw new Error('Live diagnostic one-call limit');
    const call=state.calls;writeFileSync('/private/tmp/joobi-reliability-request.json',JSON.stringify(input[0]));
    const result=stream(...input);void result.finalMessage().then(response=>{writeFileSync('/private/tmp/joobi-reliability-response.json',JSON.stringify(response));writeFileSync(`/private/tmp/joobi-reliability-response-${call}.json`,JSON.stringify(response));}).catch(()=>{});return result;
   }) as typeof this.messages.stream;
  }
 }};
});
it.skipIf(process.env.JOOBI_LIVE_RELIABILITY!=='1')('checks the production subject and public evidence path within one provider call',async()=>{
 process.loadEnvFile('.env.local');
 const {resolveAssistantSubject}=await import('@/lib/assistantSubject');
 const {collectAssistantQuestionEvidence}=await import('@/lib/assistantEvidenceSource');
 const {collectAssistantArticles}=await import('@/lib/assistantArticleSources');
 const q=resolveAssistantSubject({text:process.env.JOOBI_LIVE_QUESTION || '어제 시선ai는 왜오른거야?? 오늘은 떨어지네',unclearTerms:[]}).question;
 const packet=await collectAssistantQuestionEvidence(q);
 console.info('[actual-target]',{symbol:packet.symbol,name:packet.subjectName,price:packet.price,headlines:packet.evidence.filter(e=>e.kind==='headline').map(e=>e.title)});
 let writes:Promise<unknown>|undefined;
 const articles=await collectAssistantArticles(packet,undefined,false,work=>{writes=work;});await writes;
 packet.evidence.push(...articles);writeFileSync('/private/tmp/joobi-reliability-packet.json',JSON.stringify({q,packet}));
 console.info('[actual-articles]',articles.map(e=>({title:e.title,url:e.url})));
 expect(articles.length).toBeGreaterThan(0);
 const {assessAssistantNews}=await import('@/lib/assistantNewsAssessment');
 const assessment=assessAssistantNews(packet);expect(assessment.sourceIds.length).toBeGreaterThan(0);
 writeFileSync('/private/tmp/joobi-reliability-replay.json',JSON.stringify({q,packet,assessment}));
},60_000);

it.skipIf(process.env.JOOBI_REPLAY_RELIABILITY!=='1')('replays fetched public articles with real dated quotes without a model call',async()=>{
 const {resolveAssistantSubject}=await import('@/lib/assistantSubject');
 const {collectAssistantQuestionEvidence}=await import('@/lib/assistantEvidenceSource');
 const {fetchedArticleEvidence}=await import('@/lib/assistantArticleSources');
 const {assessAssistantNews}=await import('@/lib/assistantNewsAssessment');
 const q=resolveAssistantSubject({text:process.env.JOOBI_LIVE_QUESTION || '어제 시선ai는 왜오른거야?? 오늘은 떨어지네',unclearTerms:[]}).question;
 const packet=await collectAssistantQuestionEvidence(q);
 const response=JSON.parse(readFileSync('/private/tmp/joobi-reliability-response.json','utf8'));
 packet.evidence.push(...fetchedArticleEvidence(response.content,packet));
 const assessment=assessAssistantNews(packet);
 writeFileSync('/private/tmp/joobi-reliability-replay.json',JSON.stringify({q,packet,assessment}));
 expect(assessment.sourceIds.length).toBeGreaterThan(0);
 expect(packet.latestPrice?.day).toBe('2026-11-17');
 expect(packet.price?.day).toBe('2026-11-16');
 expect(state.calls).toBe(0);
},25_000);
