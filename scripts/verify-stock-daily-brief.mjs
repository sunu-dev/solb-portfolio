const base=process.argv[2]||'http://localhost:3039';
if(!['http://localhost:3039','https://joobi.kr'].includes(base))throw new Error('unexpected verification target');
if(process.argv.includes('--collect')) {
 const r=await fetch(`${base}/api/cron/stock-daily-brief`,{headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`}});
 console.log('collector',r.status,await r.text());
}
for(const symbol of ['MU','MSFT','005930.KS']) {
 const r=await fetch(`${base}/api/stock-daily-brief?symbol=${symbol}`);const b=await r.json();
 console.log(JSON.stringify({symbol,status:r.status,state:b.status,day:b.brief?.quote.day,change:b.brief?.quote.change,background:b.brief?.background,watch:b.brief?.watch,sources:b.brief?.sources.map(s=>s.title),warnings:b.brief?.warnings}));
}
