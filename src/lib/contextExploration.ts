import { MARKET_GUIDES, type MarketGuideId } from '@/config/marketGuides';
import { getCompanyEvidence } from '@/lib/guideCompanyEvidence';
import { getStockIdentityKey } from '@/utils/stockCurrency';
import type { EconomicKind } from '@/lib/economicEvents';

export type ExplorationId = MarketGuideId | 'ai' | 'semiconductors' | 'leaders' | 'compare';
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
const companySymbols = ['MU', 'NVDA', '005930.KS', 'MSFT', 'AAPL', 'TSLA'];
export function explorationCompany(symbol: string) {
  if (symbol.toUpperCase() === 'MU') return { name: '마이크론', business: '정보를 빠르게 주고받는 HBM과 데이터를 저장하는 메모리를 공급해요. AI 서버용 메모리를 이해할 때 함께 살펴볼 회사예요.', source: micronSource };
  return getCompanyEvidence(symbol);
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
    related: ['leaders', 'compare', 'ai'], companies: ['MU', 'NVDA', '005930.KS'], sources: [micronSource, ...businessSources.slice(0, 2)] },
  { id: 'leaders', title: '대장주는 어떤 기준으로 판단하나요?',
    summary: '대장주는 공식 순위가 아니에요. 회사 크기, 특정 제품의 점유율, 최근 주가 흐름 중 무엇을 보는지에 따라 달라져요.',
    steps: [
      { title: '회사 크기를 비교한다면', body: '시가총액은 주가에 주식 수를 곱한 회사의 시장 가치예요. 같은 시점·통화로 비교해야 해요. 여기서는 최신 전체 업종 순위를 확인하지 않아 1위를 지정하지 않아요.' },
      { title: '사업 경쟁력을 비교한다면', body: 'GPU와 HBM의 점유율은 서로 다른 시장의 숫자예요. 제품 범위와 조사 기간이 같은 자료로 비교해야 해요.' },
      { title: '먼저 역할이 분명한 기업부터 살펴봐요', body: '반도체에서는 엔비디아의 AI 연산 제품, 마이크론의 메모리, 삼성전자의 메모리와 기기 사업을 나눠 볼 수 있어요. 아래 선정 기준은 공식 자료에서 확인한 사업 역할이에요.' },
    ], watch: '어떤 제품에서 강한지, 그 사업이 회사 매출에서 얼마나 중요한지 함께 확인해요.',
    condition: '회사가 크거나 점유율이 높아도 앞으로의 수익률을 보장하지 않아요.',
    related: ['semiconductors', 'compare', 'earnings'], companies: ['NVDA', 'MU', '005930.KS'], sources: [micronSource, ...businessSources.slice(0, 2)] },
  { id: 'compare', title: '관련 회사들은 어떤 기준으로 비교할까요?',
    summary: '이름이 같은 업종에 있어도 고객과 제품, 비용이 다르면 실적도 달라져요.',
    steps: [
      { title: '누구에게 무엇을 파는지', body: '개인 소비자와 기업 고객은 구매 이유가 달라요. 회사가 밝힌 사업별 매출을 먼저 나누어 봐요.' },
      { title: '매출 증가가 이익으로 이어지는지', body: '많이 팔아도 생산·인건비가 더 늘면 이익이 줄 수 있어요. 매출과 영업이익을 같은 기간으로 비교해요.' },
      { title: '다음 발표에서 무엇을 확인할지', body: '회사가 전망을 바꾼 이유를 읽고 다음 분기의 수요·가격·비용 설명과 이어서 봐요. 이미 알려진 기대가 주가에 반영됐을 수도 있어요.' },
    ], watch: '같은 회계 기간의 매출 성장, 이익률, 회사 전망을 나란히 봐요.',
    condition: '회계 기준과 사업 구성이 다르면 숫자만으로 우열을 정하기 어려워요.',
    related: ['earnings', 'semiconductors', 'currency'], companies: [], sources: MARKET_GUIDES.find(guide => guide.id === 'earnings')!.sources },
];
export const explorationTopic = (id: ExplorationId) => EXPLORATION_TOPICS.find(topic => topic.id === id)!;
export function stockExploration(symbol: string): ExplorationId[] {
  const identity = getStockIdentityKey(symbol);
  if (['MU', 'NVDA', 'KR:005930'].includes(identity)) return ['semiconductors', 'ai', 'leaders'];
  if (identity === 'MSFT') return ['ai', 'earnings', 'rates'];
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
  if (/반도체|메모리|마이크론|엔비디아|\b(?:semiconductor|micron|nvidia|HBM|GPU)\b/i.test(title)) topics.push('semiconductors');
  if (/인공지능|오픈\s?AI|데이터센터|\b(?:AI|OpenAI)\b/i.test(title)) topics.push('ai');
  if (/물가|인플레이션|\b(?:CPI|PCE|inflation)\b/i.test(title)) topics.push('inflation');
  if (/금리|연준|\b(?:FOMC|Fed)\b/i.test(title)) topics.push('rates');
  if (/환율|달러|\b(?:currency|dollar)\b/i.test(title)) topics.push('currency');
  if (/실적|매출|영업이익|\b(?:earnings|revenue)\b/i.test(title)) topics.push('earnings');
  return topics.slice(0, 3);
}
