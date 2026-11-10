import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { requireServiceClient } from '@/lib/supabaseServer';
import { collectDailyBriefs } from '@/lib/stockDailyBriefCollector';
import type { DailyBrief } from '@/lib/stockDailyBrief';
export const maxDuration=300;
export const GET=defineRoute({name:'/api/cron/stock-daily-brief',auth:'cron',rateLimit:false,handler:async()=>{
 const db=requireServiceClient(); const owner=randomUUID();
 const claim=await db.rpc('claim_stock_daily_brief',{p_owner:owner});
 if(claim.error) throw new Error('brief_lock_unavailable');
 if(!claim.data) return NextResponse.json({skipped:true});
 try {
 const old=await db.from('stock_daily_briefs').select('symbol,payload'); if(old.error) throw new Error('brief_storage_unavailable');
 const result=await collectDailyBriefs(new Map((old.data??[]).map(r=>[r.symbol,r.payload as DailyBrief])));
 if(!result.briefs.length) throw new Error('all_quote_sources_failed');
 const saved=await db.rpc('publish_stock_daily_brief',{p_owner:owner,p_briefs:result.briefs});
 if(saved.error||!saved.data) throw new Error('brief_publish_failed');
 return NextResponse.json({count:result.briefs.length,failed:result.failed,generations:result.generations});
 } catch(error) { await db.rpc('publish_stock_daily_brief',{p_owner:owner,p_briefs:[]}); throw error; }
}});
