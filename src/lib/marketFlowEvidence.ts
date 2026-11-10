import type { MarketFlowEvidence } from './marketFlowEngine';

/** Dated, source-checked editorial evidence. Never reused for another session.
 * Automated price observations do not manufacture causal explanations.
 * availableAfter is a conservative post-session availability gate, not a
 * claimed publisher timestamp. These checked explanations are not intraday signals.
 */
export const VERIFIED_MARKET_FLOW_EVIDENCE: MarketFlowEvidence[] = [
  {
    id: '2026-10-30-ai-spending', market: 'us', sessionDate: '2026-10-30', scope: 'market',
    availableAfter: '2026-10-31T00:00:00Z', symbols: ['AMZN', 'GOOGL', 'GOOG'],
    title: 'AI 투자 비용과 현금 부담이 함께 부각됐어요',
    fact: '아마존은 최근 12개월의 잉여현금흐름이 약 424억 달러 순유출이라고 발표했어요. 회사는 설비투자 증가가 주로 AI 투자와 관련돼 있다고 설명했어요.',
    interpretation: '매출이 늘어도 설비에 쓰는 돈이 더 빠르게 늘면 당장 남는 현금은 줄 수 있어요. Reuters는 대형 기술기업의 AI 지출에 대한 우려를 이날 하락의 배경으로 보도했어요. 모든 종목의 하락 원인이 같다는 뜻은 아니에요.',
    next: '다음 실적에서 클라우드 매출 증가가 설비투자와 현금 유출을 얼마나 따라잡는지 확인해요.',
    sources: [
      { role: 'company', label: '아마존 2026년 3분기 실적 발표', url: 'https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx' },
      { role: 'reporting', label: 'Reuters · 10월 30일 미국 증시 마감', url: 'https://www.aol.co.uk/articles/nasdaq-futures-tumble-amazon-intel-084615000.html' },
    ],
  },
  {
    id: '2026-10-30-intel-outlook', market: 'us', sessionDate: '2026-10-30', scope: 'company',
    availableAfter: '2026-10-31T00:00:00Z', symbols: ['INTC'], title: '인텔은 지난 실적보다 다음 분기 전망을 봐야 해요',
    fact: '인텔은 3분기 매출이 전년보다 21% 늘었다고 발표했지만, 4분기 매출 전망은 150억~160억 달러, 조정 주당순이익 전망은 0.25달러로 제시했어요.',
    interpretation: '이번에 벌어들인 돈과 앞으로 벌 것으로 기대하는 돈은 달라요. 회사가 밝힌 PC 업계 부담과 공급 제약을 시장 전체의 AI 투자 비용 문제와 나눠서 확인해야 해요.',
    next: 'PC 수요와 서버용 CPU 공급이 다음 분기 매출·이익 전망을 바꾸는지 확인해요.',
    sources: [{ role: 'company', label: '인텔 2026년 3분기 실적·4분기 전망', url: 'https://www.intc.com/news-events/press-releases/detail/1786/intel-reports-third-quarter-2026-financial-results' }],
  },
];
