import {it,expect,vi} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {collectAssistantEvidence} from '@/lib/assistantEvidenceSource';
import {collectAssistantArticles} from '@/lib/assistantArticleSources';
vi.mock('@/lib/aiCostLedger',()=>({recordAiCost:async()=>{}}));
it.skipIf(process.env.JOOBI_SOURCE_DIAGNOSTIC!=='1')('retrieves relevant public article bodies',async()=>{
 for(const line of readFileSync('.env.local','utf8').split('\n')){const m=line.match(/^(ANTHROPIC_API_KEY|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'');}
 const packet=await collectAssistantEvidence(process.env.JOOBI_SOURCE_SYMBOL || 'MU','1d');
 const articles=await collectAssistantArticles(packet);
 if(process.env.JOOBI_SOURCE_OUT)writeFileSync(process.env.JOOBI_SOURCE_OUT,JSON.stringify(articles,null,2));
 expect(articles.length).toBeGreaterThan(0);
},90000);
