import { conceptUrl, type SecConcept } from './sec';

/** No arbitrary URLs, redirects, cookies, authentication or model-selected hosts. */
export async function fetchSecJson(request: {cik:string;concept?:SecConcept}, userAgent:string, transport:typeof fetch=fetch):Promise<unknown> {
  if(!/^\d{10}$/.test(request.cik)||userAgent.length>200||/[\r\n]/.test(userAgent)
    ||!/^Joobi\/\S+ .+@[^\s@]+\.[^\s@]+$/.test(userAgent)) throw new Error('sec_identity_configuration_required');
  const url=request.concept ? conceptUrl(request.cik,request.concept) : `https://data.sec.gov/submissions/CIK${request.cik}.json`;
  const response=await transport(url,{redirect:'error',cache:'no-store',headers:{'User-Agent':userAgent,Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!response.ok||response.redirected||response.url && response.url!==url) throw new Error(`sec_source_status_${response.status}`);
  if(!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new Error('sec_content_type');
  const max=8*1024*1024; const advertised=response.headers.get('content-length');
  if(advertised&&(!/^\d+$/.test(advertised)||Number(advertised)>max)) {await response.body?.cancel();throw new Error('sec_response_limit');}
  if(!response.body)throw new Error('sec_empty_body');
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try {for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
    if(size>max)throw new Error('sec_response_limit');chunks.push(part.value);}}
  finally {await reader.cancel();reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
