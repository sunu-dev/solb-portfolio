// Read-only public research. Does not touch the runtime catalogue or production.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const out = process.argv[2];
if (!out) throw new Error('Usage: node scripts/collect-etf-evidence.mjs <evidence-directory> <screener-json>');
await mkdir(out, { recursive: true });
const seed = `SPY VOO IVV QQQ QQQM VTI ITOT SCHB SPYM SCHX DIA IWM VT ACWI RSP VUG SCHG IWF IWD VTV IVE IVW VO SCHD VYM VIG DGRO HDV SPYD SDY DGRW JEPI JEPQ QYLD XYLD DIVO SOXX SMH VGT XLK XLF XLE XLV XLI XLY XLP XLU XLB XLRE XLC IYR ARKK ARKW BOTZ ROBO CIBR HACK TAN ICLN EWY EEM VWO EFA VEA EWJ FXI KWEB TLT IEF SHY SGOV BIL GOVT AGG BND LQD HYG TIP VCIT GLD IAU SLV USO UNG IBIT FBTC BITO TQQQ SQQQ SOXL SOXS UPRO SPXU QLD QID TNA TZA TMF TMV KORU`.split(' ');
if(new Set(seed).size !== 100) throw new Error('Expected 100 editorial starting points');
const screenerPath=process.argv[3];
if(!screenerPath) throw new Error('Provide the saved public screener JSON as the third argument');
const raw = JSON.parse(await readFile(screenerPath, 'utf8')).data;
const rows = raw.rows.map(row => Object.fromEntries(raw.columns.map((key, i) => [key, row[i]])));
const bySymbol = new Map(rows.map(row => [row.s, row]));
const selected = [...seed];
for (const row of [...rows].sort((a,b) => b.aum-a.aum)) {
  if (!selected.includes(row.s)) selected.push(row.s);
  if (selected.length === 300) break;
}
const decode = value => value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const records=[]; const failures=[];
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
  while(cursor < selected.length) {
    const symbol=selected[cursor++], url=`https://stockanalysis.com/etf/${symbol.toLowerCase()}/`;
    try {
      let text;
      try { text=await readFile(`${out}/${symbol}.html`,'utf8'); }
      catch { const r=await fetch(url,{signal:AbortSignal.timeout(30000)}); if(!r.ok) throw Error(`HTTP ${r.status}`); text=await r.text(); await writeFile(`${out}/${symbol}.html`,text); }
      const section=text.slice(text.indexOf(`About ${symbol}`));
      const description=section.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1];
      const issuerUrl=section.match(/href="([^"]+)"[^>]*title="Official ETF Website"/)?.[1];
      if(!description || !issuerUrl) throw Error('Missing description or issuer link');
      records.push({symbol, ...bySymbol.get(symbol), url, issuerUrl:decode(issuerUrl), description:decode(description), checkedAt:new Date().toISOString()});
    } catch(error) { failures.push({symbol,error:String(error)}); }
  }
}));
const result={selection:'100 editorial starting points, then largest assets in the public screener until 300; not a popularity ranking',capturedAt:new Date().toISOString(),records:records.sort((a,b)=>selected.indexOf(a.symbol)-selected.indexOf(b.symbol)),failures};
await writeFile(`${out}/evidence.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({selected:selected.length,received:records.length,failures}));
if(failures.length) process.exitCode=1;
