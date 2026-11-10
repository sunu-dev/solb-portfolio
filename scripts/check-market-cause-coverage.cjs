/** Read-only SEC coverage of the eight public market-watch companies, not customer holdings. */
const fs=require('node:fs'),path=require('node:path');
const {load}=require('./check-market-cause-sec.cjs');
const root=path.resolve(__dirname,'..');
const {fetchSecJson}=load(path.join(root,'src/lib/marketCause/sources/secTransport.ts'));
const {parseSecFilings,extractSecConcept}=load(path.join(root,'src/lib/marketCause/sources/sec.ts'));
const targets=[['INTC','0000050863'],['NVDA','0001045810'],['AMD','0000002488'],['AMZN','0001018724'],['GOOGL','0001652044'],['MSFT','0000789019'],['META','0001326801'],['AAPL','0000320193']];
const delay=()=>new Promise(r=>setTimeout(r,1100));
(async()=>{
 const userAgent=process.env.SEC_USER_AGENT;if(!userAgent)throw new Error('SEC_USER_AGENT required');
 const results=[];
 for(const [symbol,cik] of targets){
  const result={symbol,cik,identity:false,concepts:[],error:null};
  try{
   await delay();const metadata=await fetchSecJson({cik},userAgent);
   if(!Array.isArray(metadata.tickers)||!metadata.tickers.includes(symbol))throw new Error('symbol_identity_mismatch');
   const filings=parseSecFilings(metadata,cik);result.identity=true;
   for(const concept of ['RevenueFromContractWithCustomerExcludingAssessedTax','NetCashProvidedByUsedInOperatingActivities']) {
    try {await delay();const body=await fetchSecJson({cik,concept},userAgent);const fetched=new Date().toISOString();
     const recent=filings.filter(f=>Date.parse(f.acceptedAt)<=Date.parse(fetched)&&Date.parse(fetched)-Date.parse(f.acceptedAt)<7*86400000);
     const parsed=extractSecConcept({body,cik,concept,filings:recent,firstSeenAt:fetched,retrievedAt:fetched});
     result.concepts.push({concept,status:'retrieved',recentFactCount:parsed.facts.length,recentFilingCount:recent.length});
    }catch(e){result.concepts.push({concept,status:'unavailable',reason:e.message});}
   }
  }catch(e){result.error=e.message;}
  results.push(result);console.log(symbol,result.identity?'identity verified':'identity unavailable');
 }
 const out=path.join(root,'artifacts/market-cause-automation-20261031');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'sec-coverage.json'),JSON.stringify({checkedAt:new Date().toISOString(),productionChanged:false,results,
  note:'A supported concept or verified company identity is not an automated explanation. Zero recent facts may mean no filing in the last seven days.'},null,2));
 console.log('Public SEC coverage capture finished');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
