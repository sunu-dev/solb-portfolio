import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
vi.mock('@/hooks/useDiscoveryHistory',()=>({useDiscoveryHistory:()=>({ready:true,history:{stocks:{}}})}));
vi.mock('@/hooks/useNow',()=>({useNow:()=>Date.parse('2026-11-01T07:00:00Z')}));
vi.mock('@/lib/usageTelemetry',()=>({usageEvent:vi.fn()}));
import StockReturnBrief from '@/components/analysis/StockReturnBrief';
import preview from '@/data/stock-context-preview.json';
import { isStockContextPacket } from '@/lib/stockContextPacket';

const packet=preview.packets[0];
if(!isStockContextPacket(packet))throw Error('invalid_fixture');
const article={title:'Allarity Therapeutics, Tumim Stone Capital과 600만 달러 주식 매입 계약 종료',pubDate:'2026-10-30T20:17:00Z',source:'뉴스',link:'https://example.com/article',description:''};
const render=(overrides:Partial<Parameters<typeof StockReturnBrief>[0]>={})=>renderToStaticMarkup(createElement(StockReturnBrief,{
  owner:'guest',symbol:'ALLR',items:[article],newsStatus:'ok',price:0,currency:'USD',onLearn:()=>{},contextPacket:packet,...overrides,
}));
describe('event explanation stays within its evidence scope',()=>{
  beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-01T07:00:00Z'));});
  afterEach(()=>vi.useRealTimers());
  it('shows three source-backed answers with the candidate label and no generic substitute',()=>{
    const html=render();
    expect(html).toContain('검토 중인 설명 · 운영 미공개');
    expect((html.match(/data-context-question=/g)||[]).length).toBe(3);
    expect(html).toContain('www.sec.gov/Archives/edgar/data/1860657/');
    expect(html).not.toContain('data-news-background');
    expect(html).not.toContain('납품 시기·취소 조건');
  });
  it('does not mix candidate events into another ticker or unavailable news',()=>{
    for(const overrides of [{symbol:'NFLX'},{newsStatus:'loading' as const},{newsStatus:'error' as const},{items:[]}])
      expect(render(overrides)).not.toContain('data-stock-context=');
  });
  it('does not fill unrelated or absent news with a generic earnings checklist',()=>{
    for(const overrides of [{contextPacket:undefined},{contextPacket:undefined,items:[]},{contextPacket:undefined,newsStatus:'error' as const}])
      expect(render(overrides)).not.toContain('다음에 확인할 것');
  });
  it('offers the same generic concept once while retaining every news article',()=>{
    const items=[{...article,title:'회사 소식 A',link:'https://example.com/a'},{...article,title:'회사 소식 B',link:'https://example.com/b'},{...article,title:'분기 배당 발표',link:'https://example.com/c'}];
    const html=render({contextPacket:undefined,items});
    expect((html.match(/data-news-background/g)||[]).length).toBe(2);
    for(const item of items)expect(html).toContain(item.link);
  });
  it('keeps a relevant supply-contract learning link for other actual sales headlines',()=>{
    const html=render({contextPacket:undefined,items:[{...article,title:'제조사 신규 반도체 공급 계약 체결'}]});
    expect(html).toContain('data-news-background');
    expect(html).toContain('관련 개념');
    expect(html).toContain('납품 시기·취소 조건');
  });
});
