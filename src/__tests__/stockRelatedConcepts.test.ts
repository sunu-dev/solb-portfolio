import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
vi.mock('@/hooks/useDiscoveryHistory',()=>({useDiscoveryHistory:()=>({ready:true,history:{stocks:{}}})}));
vi.mock('@/hooks/useNow',()=>({useNow:()=>Date.parse('2026-11-01T07:00:00Z')}));
vi.mock('@/lib/usageTelemetry',()=>({usageEvent:vi.fn()}));
import StockReturnBrief from '@/components/analysis/StockReturnBrief';
const article={title:'회사 소식',pubDate:'2026-10-30T20:17:00Z',source:'뉴스',link:'https://example.com/article',description:''};
const render=(overrides:Partial<Parameters<typeof StockReturnBrief>[0]>={})=>renderToStaticMarkup(createElement(StockReturnBrief,{owner:'guest',symbol:'ALLR',items:[article],newsStatus:'ok',price:0,currency:'USD',onLearn:()=>{},...overrides}));
describe('unique related concepts',()=>{
 beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-01T07:00:00Z'));});
 afterEach(()=>vi.useRealTimers());
  it('offers the same generic concept once while retaining every news article',()=>{
    const items=[{...article,title:'회사 소식 A',link:'https://example.com/a'},{...article,title:'회사 소식 B',link:'https://example.com/b'},{...article,title:'분기 배당 발표',link:'https://example.com/c'}];
    const html=render({items});
    expect((html.match(/data-news-background/g)||[]).length).toBe(2);
    for(const item of items)expect(html).toContain(item.link);
  });
});
