import type { NewsItem } from '@/config/constants';

export interface StockContextPacket {
  schemaVersion: 1;
  id: string;
  version: string;
  status: 'candidate';
  symbol: string;
  issuerId: string;
  source: { url: string; label: string; documentId: string; contentHash: string; publishedAt: string; checkedAt: string };
  event: { kind: 'equity-financing'; phase: 'terminated'; effectiveDate: string; counterparty: string };
  title: string;
  summary: string;
  questions: { id: string; title: string; answer: string; sourceFacts: string[] }[];
  watch: string;
  validUntil: string;
}

/** Client projection validation: candidates can only be delivered by the dev-only route. */
export function isStockContextPacket(value: unknown): value is StockContextPacket {
  if (!value || typeof value !== 'object') return false;
  const p=value as StockContextPacket;
  const string=(v:unknown,max=1000)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
  if(p.schemaVersion!==1||p.status!=='candidate'||!string(p.id,100)||!string(p.symbol,20)||!string(p.issuerId,10)||!/^\d{1,10}$/.test(p.issuerId)
    ||!p.source||!p.event||p.event.kind!=='equity-financing'||p.event.phase!=='terminated') return false;
  if(!/^[a-f0-9]{64}$/.test(p.version)||!/^[a-f0-9]{64}$/.test(p.source.contentHash))return false;
  try {const u=new URL(p.source.url);if(u.origin!=='https://www.sec.gov'||u.search||u.hash||!u.pathname.startsWith(`/Archives/edgar/data/${Number(p.issuerId)}/`))return false;}catch{return false;}
  if(![p.source.publishedAt,p.source.checkedAt,p.validUntil,p.event.effectiveDate].every(x=>typeof x==='string'&&Number.isFinite(Date.parse(x))))return false;
  if(!string(p.title,180)||!string(p.summary)||!string(p.watch)||!string(p.source.label,120)||!string(p.source.documentId,100)||!string(p.event.counterparty,160))return false;
  return Array.isArray(p.questions)&&p.questions.length>=1&&p.questions.length<=3&&new Set(p.questions.map(q=>q?.id)).size===p.questions.length
    &&p.questions.every(q=>q&&string(q.id,60)&&string(q.title,180)&&string(q.answer)&&Array.isArray(q.sourceFacts)&&q.sourceFacts.length>0&&q.sourceFacts.every(id=>string(id,60)));
}

/** Requires the event's counterpart and stage in a fresh article for this selected symbol. */
export function matchesStockContext(packet: StockContextPacket, symbol: string, item: NewsItem, now=Date.now()): boolean {
  const time=Date.parse(item.pubDate);
  const counterparty=packet.event.counterparty.split(/\s+/)[0];
  return packet.symbol===symbol && Date.parse(packet.validUntil)>now && time<=now+60000 && time>=now-7*86400000
    && time>=Date.parse(packet.event.effectiveDate) && time<=Date.parse(packet.source.publishedAt)+7*86400000
    && item.title.toLocaleLowerCase().includes(counterparty.toLocaleLowerCase())
    && /주식.{0,12}(?:매입|매수)|stock.{0,12}purchase/i.test(item.title)
    && /종료|해지|terminat/i.test(item.title);
}
