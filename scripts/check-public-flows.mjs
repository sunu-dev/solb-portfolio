/** Read-only release smoke check. Never collects briefs or calls an AI/write API. */
const base = new URL(process.argv[2] || 'http://localhost:3041');
if (!['http:', 'https:'].includes(base.protocol)) throw Error('HTTP(S) URL required');
const checks = [];
const add = (name, path, validate, options = {}, statuses = [200]) => checks.push({ name, path, validate, options, statuses });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const candles = value => {
  if (value?.s === 'no_data') return 'unavailable';
  if (value?.s !== 'ok' || !Array.isArray(value.t) || !value.t.length) return false;
  return ['o','h','l','c','v'].every(key => Array.isArray(value[key]) && value[key].length === value.t.length
    && value[key].every(Number.isFinite))
    && value.t.every((t,i) => Number.isFinite(t) && (!i || t > value.t[i-1]));
};
for (const symbol of ['MSFT','MU','TSLL','NVDU','SPY','SOXL','005930.KS','247540.KQ']) {
  for (const range of ['1d','1y']) add(`chart ${symbol} ${range}`,`/api/candle?symbol=${encodeURIComponent(symbol)}&range=${range}`,candles);
}
for (const [q,symbol] of [['마이크로소프트','MSFT'],['TSLL','TSLL'],['삼성전자','005930.KS'],['에코프로비엠','247540.KQ']]) {
  add(`search ${q}`,`/api/search?q=${encodeURIComponent(q)}`,value => Array.isArray(value?.result) && value.result.some(row => row.symbol === symbol));
}
for (const symbol of ['MSFT','TSLL','SPY','005930.KS']) add(`profile ${symbol}`,`/api/company-profile?symbol=${symbol}`,value => object(value?.data) && ['KRW','USD'].includes(value.data.currency) && value.data.classification?.symbol === symbol);
for (const symbol of ['MU','MSFT','TSLL']) add(`daily brief ${symbol}`,`/api/stock-daily-brief?symbol=${symbol}`,value => object(value) && ['ok','pending','unsupported'].includes(value.status));
add('news','/api/news?q=Microsoft&locale=en&maxHours=168',value => Array.isArray(value?.items) || Array.isArray(value?.news));
add('calendar','/api/economic-events',value => Array.isArray(value?.events));
add('market movers','/api/market-movers',value => value?.ok === true && Array.isArray(value.us?.gainers) && Array.isArray(value.kr?.losers));
add('macro','/api/macro-indicators',value => object(value));
add('sentiment','/api/fear-greed',value => object(value) && (value.source === 'unavailable' ? 'unavailable' : Number.isFinite(value.score)));
add('quotes','/api/quotes',value => object(value?.quotes) && ['MSFT','TSLL','005930.KS'].every(s=>Number.isFinite(value.quotes[s]?.c) && value.quotes[s].c > 0),{ method:'POST',body:JSON.stringify({symbols:['MSFT','TSLL','005930.KS']}),headers:{'Content-Type':'application/json'} });
add('admin guest boundary','/api/me/admin',(value,status)=>status===200 && value.isAdmin===false);
for (const path of ['/api/me/entitlements','/api/codes/my-invite']) add(`auth ${path}`,path,(_v,status)=>[401,403].includes(status),{},[401,403]);
for (const path of ['/api/candle','/api/company-profile','/api/news','/api/stock-daily-brief']) add(`validation ${path}`,path,(_v,status)=>status===400,{},[400]);
for (const path of ['/','/about','/help','/landing','/privacy','/terms','/manifest.json']) add(`page ${path}`,path,(_v,status)=>status===200);
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
if (only) { for (let i=checks.length-1;i>=0;i--) if (!checks[i].name.includes(only)) checks.splice(i,1); if (!checks.length) throw Error('No matching checks'); }
let next = 0;
const results = [];
await Promise.all(Array.from({length:3},async()=>{
  while(next < checks.length) {
    const check = checks[next++]; const start=Date.now();
    let result;
    try {
      const response = await fetch(new URL(check.path,base),{...check.options,signal:AbortSignal.timeout(35000)});
      const raw = await response.text(); let value;try{value=JSON.parse(raw);}catch{value=raw;}
      const valid = check.statuses.includes(response.status) && check.validate(value,response.status);
      result = {name:check.name,path:check.path,status:response.status,result:valid===true?'pass':valid==='unavailable'?'unavailable':'fail',ms:Date.now()-start};
      if (!valid) { result.shape=object(value)?Object.keys(value):typeof value; if (check.name === 'quotes') result.missing=['MSFT','TSLL','005930.KS'].filter(s=>!Number.isFinite(value?.quotes?.[s]?.c)||value.quotes[s].c<=0); }
    } catch(error){result={name:check.name,path:check.path,result:'fail',ms:Date.now()-start,error:error.name};}
    results.push(result);console.log(JSON.stringify(result));
  }
}));
const totals = {base:base.origin,checks:results.length,passed:results.filter(r=>r.result==='pass').length,unavailable:results.filter(r=>r.result==='unavailable').length,failed:results.filter(r=>r.result==='fail').length};
console.log(JSON.stringify({summary:totals}));
process.exitCode=totals.failed?1:0;
