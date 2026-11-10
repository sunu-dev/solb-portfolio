import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { requireServiceClient } from '@/lib/supabaseServer';
import { BRIEF_TARGETS, publicDailyBrief } from '@/lib/stockDailyBrief';
export const GET=defineRoute({name:'/api/stock-daily-brief',auth:'public',handler:async({req})=>{
 const symbol=req.nextUrl.searchParams.get('symbol')?.toUpperCase();
 if(!symbol||symbol.length>20) return NextResponse.json({error:'invalid_symbol'},{status:400});
 if(!BRIEF_TARGETS.some(t=>t[0]===symbol)) return NextResponse.json({status:'unsupported',brief:null});
 const {data,error}=await requireServiceClient().from('stock_daily_briefs').select('payload').eq('symbol',symbol).maybeSingle();
 if(error) return NextResponse.json({error:'브리핑을 불러오지 못했어요.'},{status:503,headers:{'Cache-Control':'no-store'}});
 return NextResponse.json({status:data?'ok':'pending',brief:data?.payload ? publicDailyBrief(data.payload) : null},{headers:{'Cache-Control':data?'public, s-maxage=60, stale-while-revalidate=120':'no-store'}});
}});
