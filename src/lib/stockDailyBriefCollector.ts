import { requireServiceClient } from './supabaseServer';
import { groundStockBrief } from './stockBriefGrounding';
import { getAiMonthlyBudgetStatus } from './aiBudgetGuard';
import { DAILY_BRIEF_BACKGROUND_ENABLED, BRIEF_TARGETS, BRIEF_BENCHMARKS, marketDay, priceSummary, type BriefQuote, type BriefSource, type DailyBrief } from './stockDailyBrief';
const headers = {'User-Agent':'Mozilla/5.0'};
async function read(url:string) { const r=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(8000)}); if(!r.ok) throw new Error('source_unavailable'); return r; }
export function parseDailyQuote(symbol:string,label:string, data:unknown, now=Date.now()):BriefQuote|null {
 const chart=(data as {chart?:{result?:Array<{meta?:{regularMarketTime?:number};timestamp?:number[];indicators?:{adjclose?:Array<{adjclose?:Array<number|null>}>;quote?:Array<{close?:Array<number|null>}>}} >}})?.chart?.result?.[0];
 const times=chart?.timestamp; const closes=chart?.indicators?.adjclose?.[0]?.adjclose ?? chart?.indicators?.quote?.[0]?.close;
 if(!times||!closes) return null;
 const rows=times.flatMap((t,i)=>typeof closes[i]==='number'&&Number.isFinite(closes[i])&&closes[i]!>0&&t*1000<=now+60000?[{t,c:closes[i]!}]:[]);
 if(rows.length<2) return null;
 const last=rows.at(-1)!; const prev=rows.at(-2)!;
 const at=chart?.meta?.regularMarketTime;
 if(!at||marketDay(at)!==marketDay(last.t)||at*1000>now+60000||now-at*1000>7*86400000) return null;
 const change=(last.c/prev.c-1)*100;
 const historical=rows.slice(1,-1).map((r,i)=>Math.abs((r.c/rows[i].c-1)*100)).slice(-60).sort((a,b)=>a-b);
 return {symbol,label,day:marketDay(last.t),at:new Date(at*1000).toISOString(),change,unusual:historical.length>=40&&Math.abs(change)>historical[Math.floor(historical.length*.95)]};
}
const decode=(s:string)=>s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
export function parseBriefNews(xml:string, day:string, now=Date.now()):BriefSource[] {
 const out:BriefSource[]=[];
 for(const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
 const tag=(name:string)=>decode(match[1].match(new RegExp(String.raw`<${name}[^>]*>([\s\S]*?)<\/${name}>`))?.[1]??'').trim();
 const at=Date.parse(tag('pubDate')); const url=tag('link');
 if(!Number.isFinite(at)||at>now||(marketDay(at/1000)>day||marketDay(at/1000)<new Date(Date.parse(day)-2*86400000).toISOString().slice(0,10))||!/^https:\/\//.test(url)) continue;
 out.push({title:tag('title').slice(0,400),publisher:tag('source').slice(0,100),url,at:new Date(at).toISOString()});
 }
 return [...new Map(out.map(s=>[s.title,s])).values()].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,12);
}
export async function collectDailyBriefs(previous:Map<string,DailyBrief>, now=Date.now()) {
 const quotes=new Map<string,BriefQuote>(); const failed:string[]=[];
 const targets=[...BRIEF_TARGETS.map(([symbol,label])=>[symbol,label]),...Object.entries(BRIEF_BENCHMARKS)];
 // Bounded concurrency; no client request can trigger collection or AI generation.
 for(let i=0;i<targets.length;i+=5) await Promise.all(targets.slice(i,i+5).map(async([symbol,label])=>{
 try {const data=await (await read(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d`)).json(); const q=parseDailyQuote(symbol,label,data,now); if(!q) throw new Error('quote_invalid'); quotes.set(symbol,q);} catch {failed.push(symbol);}
 }));
 const briefs:DailyBrief[]=[]; let generations=0;
 const budget=DAILY_BRIEF_BACKGROUND_ENABLED ? await getAiMonthlyBudgetStatus() : { allowed: false };
 const dailyUsage=DAILY_BRIEF_BACKGROUND_ENABLED ? await requireServiceClient().from('ai_cost_ledger').select('id',{count:'exact',head:true}).eq('feature','stock_daily_brief_grounded').gte('created_at',new Date(now).toISOString().slice(0,10)+'T00:00:00Z') : { error: null, count: 24 };
 const generationLimit=dailyUsage.error?0:Math.min(18,Math.max(0,24-(dailyUsage.count??0)));
 const ordered=[...BRIEF_TARGETS].sort((a,b)=>Date.parse(previous.get(a[0])?.backgroundAttemptAt??'2000-01-01')-Date.parse(previous.get(b[0])?.backgroundAttemptAt??'2000-01-01'));
 for(let i=0;i<ordered.length;i+=3) await Promise.all(ordered.slice(i,i+3).map(async([symbol,label,sector])=>{
 const quote=quotes.get(symbol); if(!quote) return;
 const comparisons=[quotes.get(sector),quotes.get('^GSPC')].filter((q):q is BriefQuote=>!!q&&q.day===quote.day);
 const warnings:string[]=[]; if(comparisons.length<2) warnings.push('같은 거래일의 시장·업종 비교 자료를 일부 확인하지 못했어요.');
 let sources:BriefSource[]=[]; let background:string|null=null; let watch:string|null=null;
 const prior=previous.get(symbol);
 let searchEntry=prior?.quote.day===quote.day?prior.searchEntry:null; let backgroundAttemptAt=prior?.backgroundAttemptAt; let backgroundGeneratedAt=prior?.backgroundGeneratedAt;
 // One successful explanation per market day. Failed generation can retry next run.
 if(DAILY_BRIEF_BACKGROUND_ENABLED&&prior?.quote.day===quote.day&&prior.background&&prior.version===3&&now-Date.parse(prior.backgroundGeneratedAt??prior.backgroundAttemptAt??'2000-01-01')<3*3600000) {sources=prior.sources;background=prior.background;watch=prior.watch;}
 else {
 if(budget.allowed&&generations<generationLimit) {
 generations++;
 try {
 backgroundAttemptAt=new Date(now).toISOString();
 const result=await groundStockBrief(symbol,label,quote.day,BRIEF_BENCHMARKS[sector]);
 if(result) {background=result.background;watch=result.watch;sources=result.sources;searchEntry=result.searchEntry;backgroundGeneratedAt=new Date(now).toISOString();}

 } catch {warnings.push('보도 배경 정리를 완료하지 못해 확인된 수치와 원문을 먼저 보여드려요.');}
 }
 }
 if(DAILY_BRIEF_BACKGROUND_ENABLED&&!background&&prior?.quote.day===quote.day&&prior.version===3&&prior.background) {background=prior.background;watch=prior.watch;sources=prior.sources;searchEntry=prior.searchEntry;backgroundGeneratedAt=prior.backgroundGeneratedAt??prior.backgroundAttemptAt;warnings.push('배경 설명은 마지막으로 확인한 보도를 유지하고 있어요.');}
 briefs.push({version:3,searchEntry,backgroundAttemptAt,backgroundGeneratedAt,symbol,checkedAt:new Date(now).toISOString(),quote,comparisons,summary:priceSummary(quote,comparisons),sources,background,watch,warnings});
 }));
 return {briefs,failed,generations};
}
