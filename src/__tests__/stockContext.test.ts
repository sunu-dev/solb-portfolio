import { createHash } from 'node:crypto';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { contractContext } from '@/lib/contractContext';
import { discoveryTags } from '@/config/stockQuestions';
import { isStockContextPacket, matchesStockContext } from '@/lib/stockContextPacket';
import preview from '@/data/stock-context-preview.json';
import { GET } from '@/app/api/stock-context/route';

afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
describe('contract headlines are not interchangeable',()=>{
  it('does not classify a quarterly dividend or schedule as earnings without earnings evidence',()=>{
    expect(discoveryTags('다음 분기 배당 지급 일정')).toEqual(['dividends']);
    expect(discoveryTags('다음 분기 주주총회 개최')).not.toContain('earnings');
    expect(discoveryTags('분기 영업이익 발표')).toContain('earnings');
  });
  it.each([
    'Allarity Therapeutics, Tumim Stone Capital과 600만 달러 주식 매입 계약 종료',
    'Acme terminates stock purchase agreement with Investor',
    '신규 주식 인수 계약 체결', '대출 계약 체결', '임대차 계약 연장', '계약 관련 안내',
    '납품 계약 해지', '신규 공급 계약 협상', '회사가 공급 계약 체결을 추진',
  ])('does not recommend backlog for %s',title=>expect(discoveryTags(title)).not.toContain('backlog'));
  it.each(['회사가 신규 수주 계약을 발표했다','반도체 공급 계약 체결','Acme enters supply agreement','수주 잔고 증가'])('preserves sales concepts for %s',title=>expect(discoveryTags(title)).toContain('backlog'));
  it('does not let another article suppress a genuine sales article',()=>{
    const titles=['주식 매입 계약 종료','고객과 반도체 공급 계약 체결'];
    expect([...new Set(titles.flatMap(discoveryTags))]).toContain('backlog');
    expect(contractContext(titles[0]).kind).toBe('securities');
  });
});

describe('evidence-bound preview bridge',()=>{
  const now=Date.parse('2026-11-01T07:00:00Z');
  const packet=preview.packets[0];
  const item={description:'',title:'Allarity Therapeutics, Tumim Stone Capital과 600만 달러 주식 매입 계약 종료',pubDate:'2026-10-30T20:17:00Z',source:'뉴스',link:'https://example.com/article'};
  it('accepts the compiled projection and requires symbol, article event, and freshness',()=>{
    expect(isStockContextPacket(packet)).toBe(true);
    if(!isStockContextPacket(packet))throw Error('invalid_fixture');
    expect(matchesStockContext(packet,'ALLR',item,now)).toBe(true);
    expect(matchesStockContext(packet,'NFLX',item,now)).toBe(false);
    expect(matchesStockContext(packet,'ALLR',{...item,title:'Tumim과 공급 계약 체결'},now)).toBe(false);
    expect(matchesStockContext(packet,'ALLR',{...item,pubDate:'2026-01-28'},now)).toBe(false);
    expect(matchesStockContext(packet,'ALLR',item,now+8*86400000)).toBe(false);
    const {version,...body}=packet;
    expect(createHash('sha256').update(JSON.stringify(body)).digest('hex')).toBe(version);
  });
  it('rejects foreign issuer URLs and unsupported public status',()=>{
    expect(isStockContextPacket({...packet,issuerId:'1'})).toBe(false);
    expect(isStockContextPacket({...packet,status:'published'})).toBe(false);
  });
  it('never serves candidates in production even with the preview switch',async()=>{
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('JOOBI_CONTEXT_PREVIEW','true');
    expect(await GET(new NextRequest('http://localhost/api/stock-context?symbol=ALLR')).json()).toEqual({status:'none',packets:[]});
  });
  it('serves only dev previews and hides expired, changed and other-symbol packets',async()=>{
    vi.stubEnv('NODE_ENV','development');vi.stubEnv('JOOBI_CONTEXT_PREVIEW','true');vi.useFakeTimers();vi.setSystemTime(now);
    const read=async(symbol='ALLR')=>GET(new NextRequest(`http://localhost/api/stock-context?symbol=${symbol}`)).json();
    expect((await read()).packets).toHaveLength(1);expect((await read('NFLX')).packets).toHaveLength(0);
    const title=packet.title;try{packet.title='tampered';expect((await read()).packets).toHaveLength(0);}finally{packet.title=title;}
    vi.setSystemTime(now+8*86400000);expect((await read()).packets).toHaveLength(0);
    expect(GET(new NextRequest('http://localhost/api/stock-context?symbol=%3Cbad%3E')).status).toBe(400);
  });
});
