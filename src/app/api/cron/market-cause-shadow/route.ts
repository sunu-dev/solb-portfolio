import {NextResponse} from 'next/server';
import {defineRoute} from '@/lib/apiRoute';
import {runSecShadowPilot} from '@/lib/marketCause/pilot';
export const maxDuration=240;
export const GET=defineRoute({name:'/api/cron/market-cause-shadow',auth:'cron',rateLimit:false,
 handler:async({req})=>{
  const result=await runSecShadowPilot(req.nextUrl.searchParams.get('symbol')??'');
  const failures=['pilot_processing_failed','source_unavailable','analysis_failed','revision_conflict','stale_worker','attempts_exhausted'];
  const unavailable=failures.includes(result.status)||!!(result.collection&&failures.includes(result.collection.status));
  return NextResponse.json(result,{status:result.status==='invalid_symbol'?400:unavailable?503:200,headers:{'Cache-Control':'no-store'}});
 }});
