import { beforeAll, afterAll } from 'vitest';
beforeAll(() => { process.env.JOOBI_NEWS_ENGINE = 'legacy'; });
afterAll(() => { delete process.env.JOOBI_NEWS_ENGINE; });
import { expect, it } from 'vitest';
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages';
import { articlePassages, fetchedArticleEvidence, assistantArticleSeeds, assistantArticleWindow, needsArticleSupplement } from '@/lib/assistantArticleSources';
import { assistantNeedsArticles } from '@/lib/assistantQuestion';
import { estimateAiCostUsd } from '@/lib/aiCostLedger';
import type { AssistantEvidencePacket } from '@/lib/assistantEvidence';
const packet: AssistantEvidencePacket = { version: 1, symbol: '^KS11', period: '1d', checkedAt: '2026-11-04T08:00:00Z', comparisons: [], evidence: [], gaps: [],
  price: { symbol: '^KS11', label: '코스피', day: '2026-11-04', baselineDay: '2026-11-03', at: '2026-11-04T06:30:00Z', price: 100, changePercent: -2, currency: 'KRW' } };
const article = '정책 발표 이후 투자 일정이 달라질 수 있다는 우려로 증시에서 외국인 매도가 늘어났다고 보도했다. 다만 실제 기업의 매출이나 주문이 줄었는지는 아직 확인되지 않았다.\n'.repeat(3);
it('removes paid trading buttons and link-only promotions without discarding reporting', () => {
  const body = ['# Market news', '[Trade MU on Coinbase](https://example.com/trade) Trading disclosure',
    'Yahoo Finance is not a broker. Coinbase pays us for certain activity through this link.',
    '- [Warning! See stock warning signs](https://example.com/advert)',
    'Micron shares fell amid concerns about the factory schedule. The report does not confirm lower earnings.'].join('\n');
  const result = articlePassages(body, 'Market news');
  expect(result).toContain('Micron shares fell');
  expect(result).not.toMatch(/Coinbase|Trade MU|warning signs/i);
});
it('retains the reported transmission mechanism instead of filling the packet with price paragraphs', () => {
  const prices = Array.from({ length: 15 }, (_, i) => `Company ${i} shares changed by ${i + 1} percent on the stock market.`);
  const mechanism = 'Construction permits for data centers may be delayed by proposed regulations. No orders have been cancelled according to the report.';
  expect(articlePassages([...prices, mechanism].join('\n'), 'Market report')).toContain(mechanism);
});
const fetchBlock = (url: string, date = '2026-11-04', body = article): ContentBlock => ({ type: 'web_fetch_tool_result', tool_use_id: 'tool', caller: { type: 'direct' },
  content: { type: 'web_fetch_result', url, retrieved_at: '2026-11-04T08:00:00Z', content: { type: 'document', title: '코스피 장중 변동 배경', citations: null, source: { type: 'text', media_type: 'text/plain', data: `입력 ${date} 15:45\n${body}` } } } });
it('accepts actual current fetched text but not model prose, stale or future articles, unapproved hosts or snippets', () => {
  const blocks = [fetchBlock('https://www.etoday.co.kr/news/view/1'), fetchBlock('https://www.m-i.kr/news/articleView.html?id=old', '2025-11-04'),
    fetchBlock('https://www.m-i.kr/news/articleView.html?id=next', '2026-11-05'), fetchBlock('https://etoday.co.kr.evil.test/a'), fetchBlock('https://www.m-i.kr/a', '2026-11-04', '짧은 제목만'),
    { type: 'text', text: '기사를 읽었습니다. 출처 https://www.m-i.kr/new' } as ContentBlock];
  const result = fetchedArticleEvidence(blocks, packet, Date.parse('2026-11-04T08:00:00Z'));
  expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ kind: 'article', publishedAt: '2026-11-04', id: 'A1' });
  expect(result[0].text).toContain('실제 기업의 매출이나 주문');
});
it('does not mistake an event date for a publication date or duplicate an article', () => {
  const missing = fetchBlock('https://www.etoday.co.kr/news/view/1');
  const content = missing.type === 'web_fetch_tool_result' && missing.content.type === 'web_fetch_result' ? missing.content.content : null;
  if (content?.source.type === 'text') content.source.data = `2026-11-04 사건을 다룹니다.\n${article}`;
  expect(fetchedArticleEvidence([missing], packet)).toHaveLength(0);
  const block = fetchBlock('https://www.etoday.co.kr/news/view/2');
  expect(fetchedArticleEvidence([block, block], packet)).toHaveLength(1);
  expect(articlePassages('로그인하고 구독 신청을 해주세요. 무단 전재를 금지하며 저작권을 보호합니다.', '제목')).toBe('');
});
it('spends on news questions and related follow-ups, not simple definitions or price comparisons', () => {
  const q = { unclearTerms: [] };
  expect(assistantNeedsArticles({ ...q, text: 'ETF가 뭐예요?' })).toBe(false);
  expect(assistantNeedsArticles({ ...q, text: '만약 주가가 10% 하락하면 왜 손실이 달라지나요?' })).toBe(false);
  expect(assistantNeedsArticles({ ...q, text: '시장 전체도 같이 움직였나요?' })).toBe(false);
  expect(assistantNeedsArticles({ ...q, text: '왜 이렇게 떨어져요?' })).toBe(true);
  expect(assistantNeedsArticles({ ...q, text: '그게 반도체에 무슨 영향이에요?', history: [{ question: '오늘 왜 떨어졌어요?', answer: '이전 답변' }] })).toBe(true);
  expect(estimateAiCostUsd('claude-haiku-5-5', { inputTokens: 5000, outputTokens: 500, webSearchRequests: 1 })).toBeCloseTo(.01075, 8);
});

it('reads English publication datelines and keeps home-market reporting separate from company events', () => {
  const us = { ...packet, symbol: 'MU', price: { ...packet.price!, symbol: 'MU', label: '마이크론', day: '2026-11-03', baselineDay: '2026-11-02', currency: 'USD' } };
  const block = fetchBlock('https://finance.yahoo.com/news/micron-example');
  if (block.type !== 'web_fetch_tool_result' || block.content.type !== 'web_fetch_result' || block.content.content.source.type !== 'text') throw new Error('fixture');
  block.content.content.title = 'Micron shares and memory demand';
  block.content.content.source.data = 'Tue, November 3, 2026 at 1:40 PM UTC\n' + 'Micron shares rose as investors considered memory demand. Actual earnings and future demand remain uncertain, and the report does not confirm new orders.\n'.repeat(3);
  const result = fetchedArticleEvidence([block], us, Date.parse('2026-11-04T08:00:00Z'));
  expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ scope: 'company', publishedAt: '2026-11-03' });
  block.content.content.title = 'Wall Street market wrap';
  block.content.content.source.data = block.content.content.source.data.replaceAll('Micron', 'Wall Street');
  expect(fetchedArticleEvidence([block], us)[0].scope).toBe('market');
});


it('keeps prior-trading-day policy reporting but excludes articles before the price window', () => {
  const result = fetchedArticleEvidence([
    fetchBlock('https://www.etoday.co.kr/news/view/prior', '2026-11-03'),
    fetchBlock('https://www.etoday.co.kr/news/view/too-old', '2026-11-02'),
  ], packet, Date.parse('2026-11-04T08:00:00Z'));
  expect(result.map(source => source.publishedAt)).toEqual(['2026-11-03']);
});

it('includes market reporting even when company headlines fill the first slots', () => {
  const evidence = Array.from({length: 5}, (_, index) => ({ id: `N${index}`, kind: 'headline' as const, scope: 'company' as const,
    title: `company ${index}`, url: `https://finance.yahoo.com/news/company-${index}`, text: '', publisher: 'Yahoo', publishedAt: '2026-11-03', checkedAt: packet.checkedAt }));
  const seeds = assistantArticleSeeds({ ...packet, symbol: 'MU', evidence: [...evidence, { ...evidence[0], id:'M1', scope:'market', title:'market policy', url:'https://finance.yahoo.com/news/market-policy' }] });
  expect(seeds).toHaveLength(3);
  expect(seeds.some(source => source.title === 'market policy')).toBe(true);
  expect(seeds.some(source => source.title === 'company 0')).toBe(true);
});


it('uses Google News headlines as search leads without fetching redirect URLs or accepting lookalike hosts', () => {
  const base = { id:'M1', kind:'headline' as const, scope:'market' as const, title:'시장 정책 보도', text:'', publisher:'보도', publishedAt:'2026-11-03', checkedAt:packet.checkedAt };
  const seeds = assistantArticleSeeds({ ...packet, evidence:[
    { ...base, url:'https://news.google.com/rss/articles/example' },
    { ...base, id:'M2', url:'https://news.google.com.evil.test/article' },
  ] });
  expect(seeds).toEqual([{ title:'시장 정책 보도', date:'2026-11-03' }]);
});
it('requests one supplementary lookup for a company recap without sector/event context',async()=>{
 const {needsArticleSupplement}=await import('@/lib/assistantArticleSources');
 const stock={...packet,symbol:'MU'};
 const recap={id:'A1',kind:'article' as const,scope:'company' as const,title:'Micron',text:'Micron earnings estimates and closing prices.',url:'https://finance.yahoo.com/news/example',publisher:'Yahoo',publishedAt:packet.checkedAt,checkedAt:packet.checkedAt};
 expect(needsArticleSupplement(stock,[recap])).toBe(true);
 expect(needsArticleSupplement(stock,[{...recap,text:'US semiconductor stocks declined amid election policy concerns.'}])).toBe(true);
 expect(needsArticleSupplement(stock,[{...recap,scope:'industry',text:'US semiconductor stocks declined amid election policy concerns.'}])).toBe(true);
 expect(needsArticleSupplement(stock,[])).toBe(true);
});


it('links a verified single-stock fund to its underlying company without accepting unrelated issuers', () => {
 const fund={...packet,symbol:'MUU',price:{...packet.price!,symbol:'MUU',label:'MUU',currency:'USD'}};
 const body='Micron shares declined amid concerns about memory demand. The report does not establish an order cancellation or a change in the fund mandate.\n'.repeat(3);
 const block=fetchBlock('https://finance.yahoo.com/news/micron-report','2026-11-04',body);
 if(block.type!=='web_fetch_tool_result'||block.content.type!=='web_fetch_result')throw Error('fixture');
 block.content.content.title='Micron memory demand';
 expect(fetchedArticleEvidence([block],fund)[0]?.scope).toBe('company');
 expect(fetchedArticleEvidence([block],{...fund,symbol:'TSLL'})).toHaveLength(0);
});

it('fetches recent reporting without quotes, without extending the calendar window or accepting future reporting', () => {
 const noPrice = { ...packet, price: undefined };
 expect(assistantArticleWindow(noPrice)).toEqual({from:'2026-11-01',to:'2026-11-04',basis:'calendar'});
 const blocks = [fetchBlock('https://www.etoday.co.kr/current','2026-11-04'),fetchBlock('https://www.etoday.co.kr/old','2026-10-31'),fetchBlock('https://www.etoday.co.kr/future','2026-11-05')];
 expect(fetchedArticleEvidence(blocks,noPrice,Date.parse(noPrice.checkedAt))).toHaveLength(1);
 expect(fetchedArticleEvidence(blocks,{...noPrice,checkedAt:'invalid'})).toEqual([]);
 expect(assistantArticleWindow({...noPrice,symbol:'MU',checkedAt:'2026-11-06T02:00:00Z'})).toEqual({from:'2026-11-02',to:'2026-11-05',basis:'calendar'});
 expect(assistantArticleWindow(packet)?.basis).toBe('price');
});

it('keeps a market wrap as shared context even when its body names the selected company', () => {
 const us = {...packet,symbol:'MU',price:{...packet.price!,symbol:'MU',label:'마이크론',currency:'USD'}};
 const block=fetchBlock('https://finance.yahoo.com/news/market-wrap');
 if(block.type==='web_fetch_tool_result'&&block.content.type==='web_fetch_result') {
  block.content.content.title='How major US stock indexes fared: Nasdaq falls';
  block.content.content.source={type:'text',media_type:'text/plain',data:'Published 2026-11-04\n'+ 'US stocks and Micron shares fell as election results raised concerns about data center construction restrictions. Investors feared slower orders for semiconductor equipment. '.repeat(3)};
 }
 expect(fetchedArticleEvidence([block],us)).toMatchObject([{scope:'market',publisher:'야후 파이낸스'}]);
});

it('does not promote a Micron story with a Nasdaq mention or listing into market evidence', () => {
 const us={...packet,symbol:'^GSPC',price:{...packet.price!,symbol:'^GSPC',currency:'USD'}};
 const block=fetchBlock('https://finance.yahoo.com/news/micron-only');
 if(block.type!=='web_fetch_tool_result'||block.content.type!=='web_fetch_result') throw Error('fixture');
 block.content.content.title='Micron (NASDAQ: MU) stock declines after factory delay';
 block.content.content.source={type:'text',media_type:'text/plain',data:'Published 2026-11-04\n'+ 'Micron shares fell after a factory delay. Nasdaq was also lower, but this report describes only the company construction plan and its memory capacity. Investors remained uncertain about orders. '.repeat(3)};
 const rejected=fetchedArticleEvidence([block],us);
 expect(rejected).toEqual([]);
 expect(needsArticleSupplement(us,rejected)).toBe(true);
 expect(fetchedArticleEvidence([block],{...us,symbol:'MU',price:{...us.price,symbol:'MU',label:'마이크론'}})).toMatchObject([{scope:'company'}]);
 block.content.content.title='US semiconductor stocks fall on policy concerns';
 expect(fetchedArticleEvidence([block],us)).toMatchObject([{scope:'industry'}]);
});

it('keeps the selected completed-session news window during a price outage', () => {
 const past={...packet,symbol:'MU',price:undefined,checkedAt:'2026-11-06T16:00:00Z',session:{reference:'previous' as const,throughDay:'2026-11-05',description:'최근 마감한 미국 정규장'}};
 expect(assistantArticleWindow(past)).toEqual({from:'2026-11-02',to:'2026-11-05',basis:'calendar'});
 expect(assistantArticleWindow({...past,session:undefined,sessionUnavailable:true})).toBeUndefined();
 const block=fetchBlock('https://finance.yahoo.com/news/future','2026-11-06','US stocks fell after a new policy statement. Investors remained uncertain about company investment and demand. '.repeat(4));
 if(block.type==='web_fetch_tool_result'&&block.content.type==='web_fetch_result')block.content.content.title='US stocks after policy statement';
 expect(fetchedArticleEvidence([block],past)).toEqual([]);
});

it('asks for industry reporting when a sector question has only broad market coverage', () => {
 const us={...packet,symbol:'^GSPC',industryFocus:['semiconductors' as const]};
 const article={id:'A1',kind:'article' as const,scope:'market' as const,title:'US market wrap',text:'US stocks moved after policy news.',url:'https://finance.yahoo.com/news/example',publisher:'Yahoo',publishedAt:packet.checkedAt,checkedAt:packet.checkedAt};
 expect(needsArticleSupplement(us,[article])).toBe(true);
 expect(needsArticleSupplement({...us,industryFocus:[]},[article])).toBe(false);
 expect(needsArticleSupplement(us,[{...article,scope:'industry',text:'US semiconductor stocks fell after a policy change.'}])).toBe(false);
 expect(needsArticleSupplement(us,[{...article,title:'US stocks plunge as chip stocks sink'}])).toBe(false);
 expect(needsArticleSupplement(us,[{...article,text:'The semiconductor sector fell amid a new policy concern.'}])).toBe(false);
 expect(needsArticleSupplement(us,[{...article,scope:'company',title:'Chip stocks sink',text:'Micron shares declined.'}])).toBe(true);
 expect(needsArticleSupplement(us,[{...article,scope:'industry',title:'Technology stocks fall'}])).toBe(true);
 expect(needsArticleSupplement({...us,industryFocus:['semiconductors','technology']},[{...article,title:'Chip stocks sink'}])).toBe(true);
});

it('treats an individual stock column as company coverage despite its market series name', () => {
 const us={...packet,symbol:'^GSPC',price:{...packet.price!,symbol:'^GSPC',currency:'USD'}};
 const block=fetchBlock('https://ca.finance.yahoo.com/news/micron-column');
 if(block.type!=='web_fetch_tool_result'||block.content.type!=='web_fetch_result') throw Error('fixture');
 block.content.content.title="Stock Market Today, Nov. 4: Micron Technology Jumps as Chip Stocks Rebound";
 block.content.content.source={type:'text',media_type:'text/plain',data:'Published 2026-11-04\n'+ 'Micron shares rose after its earnings report. Nasdaq and US chip stocks also climbed as investors considered policy uncertainty and demand. '.repeat(3)};
 expect(fetchedArticleEvidence([block],us)).toEqual([]);
 const stock={...us,symbol:'MU',price:{...us.price,symbol:'MU',label:'마이크론'}};
 const articles=fetchedArticleEvidence([block],stock);
 expect(articles).toMatchObject([{scope:'company',publisher:'야후 파이낸스'}]);
 expect(needsArticleSupplement(stock,articles)).toBe(true);
 block.content.content.title='Stock Market Today, Nov. 4: Nasdaq rebounds as US chip stocks rise';
 expect(fetchedArticleEvidence([block],us)).toMatchObject([{scope:'market'}]);
});

it('preserves leadership events even without price words', () => {
 const event = 'NVIDIA announced that its chief executive resigned effective immediately. The board appointed an interim chief executive while it searches for a permanent successor.';
 expect(articlePassages(event, 'Leadership')).toContain(event);
});

it('accepts issuer reporting and marks market-only stock coverage incomplete', () => {
 const stock={...packet,symbol:'NVDA',price:{...packet.price!,symbol:'NVDA',label:'엔비디아'}};
 const block=fetchBlock('https://investor.nvidia.com/news/leadership','2026-11-04','NVIDIA announced that its chief executive resigned effective immediately. The board appointed an interim chief executive while it searches for a permanent successor.\n'.repeat(3));
 if(block.type!=='web_fetch_tool_result'||block.content.type!=='web_fetch_result')throw Error('fixture');
 block.content.content.title='NVIDIA leadership transition';
 expect(fetchedArticleEvidence([block],stock)).toHaveLength(1);
 expect(needsArticleSupplement(stock,[{id:'A1',kind:'article',scope:'market',title:'US stocks',text:'US stocks declined',url:'https://finance.yahoo.com/news/test',publisher:'Yahoo',publishedAt:packet.checkedAt,checkedAt:packet.checkedAt}])).toBe(true);
});
it('keeps original product and limitation paragraphs while removing generated summaries and related stories',()=>{
 const title='가상기업 시험 보안 기술';
 const text=`# ${title}\n### AI 핵심 요약\n- 자동 요약은 공급을 확정했다고 잘못 주장한다.\n!AI가 자동 생성한 요약으로 정확하지 않을 수 있어요.\n가상기업은 얼굴인식 기반 시험 보안 기술을 개발하고 있다.\n최초 로그인 이후에도 사용자가 바뀌는지 확인하는 기능이 있다.\n다만 실제 시험장 도입은 각 기관의 검증과 계약에 따라 결정된다.\n### [관련기사]\n다른회사는 무조건 공급을 확정했다는 별도 기사다.`;
 const passages=articlePassages(text,title);
 expect(passages).toContain('로그인 이후');expect(passages).toContain('각 기관의 검증');
 expect(passages).not.toContain('자동 요약');expect(passages).not.toContain('다른회사');
});
