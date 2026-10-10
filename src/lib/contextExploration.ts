import { MARKET_GUIDES, type MarketGuideId } from '@/config/marketGuides';
import { getCompanyEvidence } from '@/lib/guideCompanyEvidence';
import { getStockIdentityKey } from '@/utils/stockCurrency';
import type { EconomicKind } from '@/lib/economicEvents';
import { INDUSTRY_SECTORS, SECTORS, classifiedSectors, sectorById, sectorCompany, sectorOverview, type SectorId, type SectorProfile, type SectorTopicId } from '@/lib/sectorExploration';

export type ExplorationId = MarketGuideId | 'ai' | 'semiconductors' | 'leaders' | 'compare' | 'hbm' | 'memory-cycle' | 'gpu' | SectorTopicId;
export interface ExplorationTopic {
  id: ExplorationId; title: string; summary: string;
  steps: { title: string; body: string }[];
  watch: string; condition: string;
  related: ExplorationId[]; companies: string[];
  sources: { label: string; url: string }[];
}
const connections: Record<MarketGuideId, ExplorationId[]> = {
  rates: ['inflation', 'currency', 'ai'], inflation: ['rates', 'earnings', 'currency'],
  currency: ['earnings', 'rates', 'compare'], earnings: ['compare', 'leaders', 'ai'],
};
const micronSource = { label: '마이크론 · HBM4와 데이터센터 메모리 사업 (2026.3)', url: 'https://investors.micron.com/news/press-release/2026/Micron-in-High-Volume-Production-of-HBM4-Designed-for-NVIDIA-Vera-Rubin-PCIe-Gen6-SSD-and-SOCAMM2-03-16-2026/default.aspx' };
const hynixSource = { label: 'SK하이닉스 · 2026년 2분기 사업·HBM 설명 (2026.7.29)', url: 'https://news.skhynix.com/en/q2-2026-business-results/' };
const companySymbols = ['MU', 'NVDA', '005930.KS', 'MSFT', 'AAPL', 'TSLA'];
export function explorationCompany(symbol: string) {
  const reviewed = sectorCompany(symbol);
  if (reviewed) return reviewed;
  const identity = getStockIdentityKey(symbol);
  if (identity === 'KR:000660') return { name: 'SK하이닉스', business: 'HBM과 서버용 DRAM, 데이터를 저장하는 NAND 메모리를 공급해요. 2026년 2분기 발표에서 HBM4 출하와 AI 서버용 메모리 사업을 설명했어요.', source: hynixSource };
  if (identity === 'MU') return { name: '마이크론', business: '정보를 빠르게 주고받는 HBM과 데이터를 저장하는 메모리를 공급해요. AI 서버용 메모리를 이해할 때 함께 살펴볼 회사예요.', source: micronSource };
  return getCompanyEvidence(symbol);
}
/** Editorial business map, not a live market-cap or market-share ranking. */
export const SEMICONDUCTOR_COMPANIES = [
  { symbol: 'NVDA', role: 'AI 연산', detail: 'GPU로 계산을 맡는 회사', related: ['gpu', 'hbm', 'ai'] as ExplorationId[] },
  { symbol: '000660.KS', role: 'HBM · 메모리', detail: 'AI 서버용 메모리를 공급하는 회사', related: ['hbm', 'memory-cycle', 'compare'] as ExplorationId[] },
  { symbol: '005930.KS', role: '메모리 · 기기', detail: '반도체와 스마트폰을 함께 만드는 회사', related: ['memory-cycle', 'hbm', 'compare'] as ExplorationId[] },
  { symbol: 'MU', role: 'HBM · 메모리', detail: '미국의 메모리 반도체 회사', related: ['hbm', 'memory-cycle', 'compare'] as ExplorationId[] },
];
export function explorationRole(symbol: string) {
  return sectorCompany(symbol) ?? SEMICONDUCTOR_COMPANIES.find(item => getStockIdentityKey(item.symbol) === getStockIdentityKey(symbol));
}
export function companyExploration(symbol: string): ExplorationId[] {
  return SEMICONDUCTOR_COMPANIES.find(item => getStockIdentityKey(item.symbol) === getStockIdentityKey(symbol))?.related ?? stockExploration(symbol);
}
export function sectorQuestions(id: SectorId): ExplorationId[] {
  return id === 'semiconductors' ? ['leaders', 'hbm', 'memory-cycle'] : [sectorOverview(id), `sector:${id}:driver`, `sector:${id}:check`];
}
export function sectorForTopic(id: ExplorationId) {
  if (['semiconductors', 'hbm', 'gpu', 'memory-cycle'].includes(id)) return sectorById('semiconductors');
  if (id.startsWith('sector:')) return SECTORS.find(item => item.id === id.split(':')[1]);
  return undefined;
}
const businessSources = ['NVDA', '005930.KS', 'MSFT'].map(symbol => explorationCompany(symbol)!.source);
export const EXPLORATION_TOPICS: ExplorationTopic[] = [
  ...MARKET_GUIDES.map(guide => ({ id: guide.id, title: guide.title, summary: guide.summary,
    steps: guide.steps, watch: guide.watchPoints[0], condition: guide.condition,
    related: connections[guide.id], companies: companySymbols.filter(symbol => !!getCompanyEvidence(symbol)?.paths[guide.id]), sources: guide.sources })),
  { id: 'ai', title: 'AI 회사의 매출이 왜 반도체까지 영향을 줄까요?',
    summary: 'AI 서비스가 돈을 얼마나 버는지는 앞으로 서버에 얼마나 투자할 수 있을지와 연결돼요.',
    steps: [
      { title: '먼저 숫자의 뜻을 맞춰봐요', body: '한 달 매출을 12배 한 연간 환산 매출과 실제 1년간 번 매출은 달라요. 숫자가 다르게 보이면 기간과 계산법부터 확인해요.' },
      { title: '돈을 벌어야 투자를 이어갈 수 있어요', body: '투자자는 AI 서비스의 매출과 비용을 보고 데이터센터 투자를 감당할 수 있을지 생각해요. 자금 조달과 전력 확보도 영향을 줘요.' },
      { title: '서버에는 연산 장치와 메모리가 함께 필요해요', body: 'GPU는 많은 계산을 처리하는 칩이고, HBM은 그 옆에서 데이터를 빠르게 공급하는 메모리예요. 서버 투자 계획이 바뀌면 두 제품의 수요 전망도 다시 살펴보게 돼요.' },
    ], watch: '고객사의 실제 투자 계획과 공급사의 주문·매출 설명이 함께 바뀌었는지 확인해요.',
    condition: '매출에 관한 소문만으로 반도체 주문 감소가 확정되지는 않아요. 이 설명은 일반적인 연결 경로이며 오늘 주가 변동의 원인을 확인한 것은 아니에요.',
    related: ['semiconductors', 'earnings', 'rates'], companies: ['MSFT', 'NVDA', 'MU'], sources: [micronSource, ...businessSources] },
  { id: 'semiconductors', title: '같은 반도체 회사인데 무엇이 다를까요?',
    summary: '반도체는 큰 업종 이름이에요. 계산하는 칩, 정보를 담는 메모리처럼 하는 일을 나누면 비교가 쉬워져요.',
    steps: [
      { title: '계산을 맡는 제품', body: '엔비디아는 AI 데이터센터용 연산 제품을 공급해요. 고객이 서버를 지을 돈과 전력·공간을 확보했는지도 수요를 이해하는 단서예요.' },
      { title: '데이터를 주고받고 저장하는 제품', body: '마이크론과 삼성전자는 메모리 사업을 해요. HBM 같은 제품의 수요뿐 아니라 다른 메모리의 가격과 판매 구성도 봐야 해요.' },
      { title: '회사 전체와 사업 한 부분을 나눠요', body: '삼성전자는 스마트폰·가전도 판매해요. 메모리 업황이 같아도 회사 전체 실적은 다르게 움직일 수 있어요.' },
    ], watch: '같은 기간의 메모리 수요·가격 설명과 데이터센터 매출을 나눠 살펴봐요.',
    condition: '아래 기업은 확인한 사업 역할을 보여주는 예시예요. 업종 전체 목록이나 투자 순위가 아니에요.',
    related: ['hbm', 'gpu', 'memory-cycle', 'leaders', 'compare'], companies: ['NVDA', '000660.KS', '005930.KS', 'MU'], sources: [micronSource, hynixSource, ...businessSources.slice(0, 2)] },
  { id: 'leaders', title: '대장주는 어떤 기준으로 판단하나요?',
    summary: '대장주는 공식 순위가 아니에요. 회사 크기·제품 점유율·주가 흐름 중 어떤 기준인지 먼저 정하고, 그 산업에서 회사가 맡는 역할을 살펴봐요.',
    steps: [
      { title: '회사 크기를 비교한다면', body: '시가총액은 주가에 주식 수를 곱한 회사의 시장 가치예요. 같은 시점·통화로 비교해야 해요. 여기서는 최신 전체 업종 순위를 확인하지 않아 1위를 지정하지 않아요.' },
      { title: '사업 경쟁력을 비교한다면', body: '서로 다른 제품의 점유율을 그대로 비교할 수는 없어요. 제품 범위·조사 기간·지역이 같은 자료로 비교해야 해요.' },
      { title: '먼저 역할이 분명한 기업부터 살펴봐요', body: '주비의 대표 기업은 공식 자료에서 제품과 고객을 확인한 기업이에요. 사업을 이해하는 출발점이며, 최신 시가총액이나 수익률의 1위라는 뜻은 아니에요.' },
    ], watch: '어떤 제품에서 강한지, 그 사업이 회사 매출에서 얼마나 중요한지 함께 확인해요.',
    condition: '회사가 크거나 점유율이 높아도 앞으로의 수익률을 보장하지 않아요.',
    related: ['compare', 'earnings', 'rates'], companies: [], sources: MARKET_GUIDES.find(guide => guide.id === 'earnings')!.sources },
  { id: 'hbm', title: 'HBM이 뭐길래 이 회사들을 함께 볼까요?',
    summary: 'HBM은 AI 계산에 필요한 데이터를 빠르게 공급하는 메모리예요. 여러 메모리 칩을 쌓아 GPU 가까이에 배치해요.',
    steps: [
      { title: 'GPU가 계산해도 데이터가 늦으면 기다려야 해요', body: '이해를 돕는 예시로, 요리사가 GPU라면 HBM은 재료를 빠르게 건네는 보조 작업대예요. 계산 능력과 데이터 공급 속도를 함께 갖춰야 해요.' },
      { title: '연산 회사와 메모리 회사가 연결돼요', body: '엔비디아의 AI 시스템을 이해할 때 HBM을 공급하는 SK하이닉스·마이크론과 메모리 사업을 하는 삼성전자도 함께 살펴보는 이유예요.' },
      { title: '만드는 것과 매출로 이어지는 것은 달라요', body: '제품 개발 뒤에는 고객의 요구를 충족하는지 확인하고, 양산과 출하로 이어져야 해요. 회사마다 제품 세대와 진행 단계가 다를 수 있어요.' },
    ], watch: '고객 평가, 양산·출하 단계, HBM 판매가 회사 이익에 기여하는지 확인해요.',
    condition: 'HBM 수요가 늘어도 모든 회사가 같은 주문을 받는 것은 아니에요. 아래 기업 목록은 공급 점유율 순위가 아니에요.',
    related: ['gpu', 'memory-cycle', 'ai', 'leaders'], companies: ['000660.KS', 'MU', '005930.KS'], sources: [hynixSource, micronSource, businessSources[1]] },
  { id: 'gpu', title: '엔비디아와 메모리 회사는 경쟁 상대인가요?',
    summary: 'AI 서버에서 GPU와 메모리는 서로 다른 일을 해요. 서로 필요한 제품을 공급하면서도 회사별 경쟁은 각자의 제품 시장에서 봐야 해요.',
    steps: [
      { title: 'GPU는 많은 계산을 처리해요', body: '엔비디아의 데이터센터 제품은 AI 계산을 맡아요. 제품뿐 아니라 시스템과 소프트웨어도 함께 살펴봐야 해요.' },
      { title: '메모리는 계산에 쓸 데이터를 공급해요', body: 'SK하이닉스·마이크론·삼성전자의 메모리 사업은 계산하는 칩과 역할이 달라요. 같은 서버 투자와 연결돼도 제품 가격과 경쟁 구도는 다를 수 있어요.' },
      { title: '같은 뉴스라도 실적에 닿는 경로가 달라요', body: 'AI 서버 투자 계획이 발표되면 연산 제품의 주문과 메모리의 수요·가격을 각각 확인해요. 공급 계약과 실제 출하 시점도 봐야 해요.' },
    ], watch: '엔비디아의 데이터센터 매출과 메모리 회사의 제품별 수요 설명을 함께 봐요.',
    condition: '사업 관계를 설명하는 것이며 특정 회사 간 현재 계약 규모를 확인한 자료는 아니에요.',
    related: ['hbm', 'ai', 'compare'], companies: ['NVDA', '000660.KS', 'MU'], sources: [businessSources[0], hynixSource, micronSource] },
  { id: 'memory-cycle', title: '메모리 가격이 오르면 회사 이익도 늘까요?',
    summary: '메모리는 수요와 공급에 따라 가격이 바뀌어요. 가격이 올라도 얼마나 팔았는지, 어떤 제품을 팔았는지, 비용은 얼마인지 함께 봐야 해요.',
    steps: [
      { title: '공급보다 수요가 많아지면', body: '서버·스마트폰 등에 필요한 메모리가 부족하면 가격을 올릴 여지가 생겨요. 반대로 생산이 늘고 수요가 줄면 가격 부담이 생길 수 있어요.' },
      { title: 'HBM과 일반 메모리를 나눠봐요', body: 'AI 서버용 고성능 메모리와 다른 제품의 흐름이 같지는 않아요. HBM 뉴스 하나로 모든 메모리 가격을 설명하지 않아요.' },
      { title: '가격에서 이익까지 한 번 더 확인해요', body: '판매 가격과 수량이 매출을 만들고, 여기서 생산 비용 등을 빼면 이익이 남아요. 공장 투자와 제품 구성도 결과를 바꿀 수 있어요.' },
    ], watch: '다음 실적에서 판매 가격·출하량·제품 구성과 이익률 설명을 이어서 확인해요.',
    condition: '현재 가격 상승·하락을 알리는 내용이 아니라 메모리 업황을 읽는 방법이에요.',
    related: ['hbm', 'earnings', 'compare'], companies: ['MU', '000660.KS', '005930.KS'], sources: [hynixSource, businessSources[1], micronSource] },
  { id: 'compare', title: '관련 회사들은 어떤 기준으로 비교할까요?',
    summary: '이름이 같은 업종에 있어도 고객과 제품, 비용이 다르면 실적도 달라져요.',
    steps: [
      { title: '누구에게 무엇을 파는지', body: '개인 소비자와 기업 고객은 구매 이유가 달라요. 회사가 밝힌 사업별 매출을 먼저 나누어 봐요.' },
      { title: '매출 증가가 이익으로 이어지는지', body: '많이 팔아도 생산·인건비가 더 늘면 이익이 줄 수 있어요. 매출과 영업이익을 같은 기간으로 비교해요.' },
      { title: '다음 발표에서 무엇을 확인할지', body: '회사가 전망을 바꾼 이유를 읽고 다음 분기의 수요·가격·비용 설명과 이어서 봐요. 이미 알려진 기대가 주가에 반영됐을 수도 있어요.' },
    ], watch: '같은 회계 기간의 매출 성장, 이익률, 회사 전망을 나란히 봐요.',
    condition: '회계 기준과 사업 구성이 다르면 숫자만으로 우열을 정하기 어려워요.',
    related: ['earnings', 'semiconductors', 'currency', ...INDUSTRY_SECTORS.map(sector => sectorOverview(sector.id))], companies: [], sources: MARKET_GUIDES.find(guide => guide.id === 'earnings')!.sources },
  ...INDUSTRY_SECTORS.flatMap((sector): ExplorationTopic[] => {
    const sources = sector.companies.map(symbol => explorationCompany(symbol)!.source);
    const anchor = explorationCompany(sector.anchor)!;
    const overview = sectorOverview(sector.id);
    const driver: ExplorationId = `sector:${sector.id}:driver`;
    const check: ExplorationId = `sector:${sector.id}:check`;
    const condition = '산업을 이해하기 위한 일반적인 연결 설명이에요. 실제 영향은 계약·제품·시점에 따라 달라지며, 오늘 주가 변동의 원인을 확인한 내용은 아니에요.';
    return [
      { id: overview, title: `${sector.name}에서 어떤 기업을 먼저 볼까요?`,
        summary: `${anchor.name}부터 살펴보세요. ${sector.intro}`,
        steps: sector.companies.map(symbol => { const company = explorationCompany(symbol)!; return { title: company.name, body: company.business }; }),
        watch: sector.watch, condition: '공식 사업 자료에서 제품과 역할을 확인해 선정했어요. 최신 시가총액·점유율 순위나 투자 추천이 아니에요.',
        related: [driver, check, 'leaders'], companies: sector.companies, sources },
      { id: driver, title: sector.driver, summary: sector.intro, steps: sector.steps, watch: sector.watch, condition,
        related: [check, ...sector.connections.map(sectorOverview), 'earnings'], companies: sector.companies, sources },
      { id: check, title: sector.check, summary: sector.checks[0].body, steps: sector.checks, watch: sector.watch, condition,
        related: [driver, 'compare', ...sector.connections.map(sectorOverview)], companies: sector.companies, sources },
    ];
  }),
];
export const explorationTopic = (id: ExplorationId) => EXPLORATION_TOPICS.find(topic => topic.id === id)!;
export function stockExploration(symbol: string, profile?: SectorProfile): ExplorationId[] {
  const identity = getStockIdentityKey(symbol);
  if (['MU', 'NVDA', 'KR:005930', 'KR:000660'].includes(identity)) return ['semiconductors', 'ai', 'leaders'];
  const industry = classifiedSectors(symbol, profile).sectors[0];
  if (industry) return sectorQuestions(industry.id);
  return ['earnings', 'compare', 'currency'];
}
export function eventExploration(kind: EconomicKind): ExplorationId[] {
  if (kind === 'cpi' || kind === 'pce') return ['inflation', 'rates'];
  if (kind === 'fomc' || kind === 'bok' || kind === 'jobs') return ['rates', 'currency'];
  return kind === 'earnings' ? ['earnings', 'compare'] : [];
}
/** Headline matching selects background reading, never an article summary or causal conclusion. */
export function newsExploration(title: string): ExplorationId[] {
  const topics: ExplorationId[] = [];
  const matches: [RegExp, SectorId][] = [
    [/광소재|광통신|코히런트|루멘텀|\b(?:photonics|coherent|lumentum)\b/i, 'photonics'],
    [/소부장|노광|반도체 장비|\bASML\b/i, 'equipment'],
    [/신약|임상|의약|바이오|제약|\b(?:pharma|biotech)\b/i, 'pharma'],
    [/방산|국방|방위|\b(?:defense|defence)\b/i, 'defense'],
    [/항공기|우주|위성|보잉|\b(?:aerospace|boeing|satellite)\b/i, 'aerospace'],
    [/조선|선박|운반선|군함|\bshipbuilding\b/i, 'shipbuilding'],
    [/배터리|이차전지|2차전지|\bbatter(?:y|ies)\b/i, 'batteries'],
    [/자동차|완성차|\bautomotive\b/i, 'automotive'],
    [/전력망|발전소|전력 수요|\butilities\b/i, 'utilities'],
    [/원유|유가|천연가스|\bcrude oil\b/i, 'energy'],
    [/은행|결제망|\bbanking\b/i, 'financials'],
    [/리츠|임대료|\bREITs?\b/i, 'real-estate'],
  ];
  for (const [pattern, sector] of matches) if (pattern.test(title)) topics.push(sectorOverview(sector));
  if (/반도체|메모리|마이크론|엔비디아|\b(?:semiconductor|micron|nvidia|HBM|GPU)\b/i.test(title)) topics.push('semiconductors');
  if (/인공지능|오픈\s?AI|데이터센터|\b(?:AI|OpenAI)\b/i.test(title)) topics.push('ai');
  if (/물가|인플레이션|\b(?:CPI|PCE|inflation)\b/i.test(title)) topics.push('inflation');
  if (/금리|연준|\b(?:FOMC|Fed)\b/i.test(title)) topics.push('rates');
  if (/환율|달러|\b(?:currency|dollar)\b/i.test(title)) topics.push('currency');
  if (/실적|매출|영업이익|\b(?:earnings|revenue)\b/i.test(title)) topics.push('earnings');
  return topics.slice(0, 3);
}
