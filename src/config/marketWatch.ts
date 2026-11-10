import type { SectorId } from '@/lib/sectorExploration';

export interface WatchTarget {
  symbol: string; label: string; market: 'kr' | 'us' | 'global';
  kind: 'index' | 'sector' | 'company' | 'fx' | 'commodity' | 'yield';
  sectors: SectorId[]; threshold: number; meaning: string; path: string[]; watch: string;
}
const sector = (symbol: string, label: string, id: SectorId): WatchTarget => ({
  symbol, label, sectors: [id], market: 'us', kind: 'sector', threshold: 2,
  meaning: '미국의 해당 업종 주식을 묶은 상장지수펀드(ETF)의 가격 변화예요. 여러 회사를 한 번에 관찰하는 참고 자료예요.',
  path: ['업종을 묶은 ETF 가격 변화', '편입 기업별 움직임 비교', '실적·주문·비용에 관한 새 자료 확인'],
  watch: '같은 업종의 기업도 사업과 매출 지역이 달라요. 한국 업종이나 모든 관련 기업의 수익률로 해석하지 마세요.',
});

/** Explicit observation universe. Sector proxies are US ETFs, never claimed as worldwide industry indices. */
export const WATCH_TARGETS: WatchTarget[] = [
  ...[
    ['^KS11', '코스피', 'kr'], ['^KQ11', '코스닥', 'kr'],
    ['^GSPC', 'S&P 500', 'us'], ['^IXIC', '나스닥 종합', 'us'],
  ].map(([symbol, label, market]) => ({
    symbol, label, market: market as 'kr' | 'us', kind: 'index' as const, sectors: [], threshold: 1.5,
    meaning: '주가지수는 여러 기업의 주가를 묶어 시장의 흐름을 보여주는 숫자예요. 기업별 비중이 달라 일부 대형주가 지수를 크게 움직일 수도 있어요.',
    path: ['여러 기업의 주가 변화', '주가지수에 반영', '업종·개별 기업의 차이 확인'],
    watch: '지수의 움직임과 내 종목의 움직임을 나눠 보세요. 지수 하락률만으로 거래 중단 발동 여부를 판단하지 않아요.',
  })),
  sector('XLK', '미국 정보기술', 'technology'),
  sector('XLC', '미국 통신·미디어', 'communication'),
  sector('XLY', '미국 경기소비재', 'consumer-discretionary'),
  sector('XLP', '미국 필수소비재', 'consumer-staples'),
  sector('XLE', '미국 에너지', 'energy'),
  sector('XLF', '미국 금융', 'financials'),
  sector('XLV', '미국 헬스케어', 'healthcare'),
  sector('XLI', '미국 산업재', 'industrials'),
  sector('XLB', '미국 소재', 'materials'),
  sector('XLRE', '미국 부동산', 'real-estate'),
  sector('XLU', '미국 유틸리티', 'utilities'),
  sector('SOXX', '미국 반도체', 'semiconductors'),
  ...[
    ['INTC', '인텔', 'semiconductors'], ['NVDA', '엔비디아', 'semiconductors'],
    ['AMD', 'AMD', 'semiconductors'], ['AMZN', '아마존', 'consumer-discretionary'],
    ['GOOGL', '알파벳', 'communication'], ['MSFT', '마이크로소프트', 'technology'],
    ['META', '메타', 'communication'], ['AAPL', '애플', 'technology'],
  ].map(([symbol, label, id]): WatchTarget => ({ symbol, label, market: 'us', kind: 'company',
    sectors: [id as SectorId], threshold: 5,
    meaning: '공개적으로 관찰하는 주요 기업의 주가 변화예요. 특정 사용자의 보유 종목을 수집한 목록은 아니에요.',
    path: ['같은 거래일의 지수·업종과 비교', '회사 실적과 다음 분기 전망 확인', '시장 공통 요인과 회사별 요인 구분'],
    watch: '지난 분기 실적과 앞으로의 전망을 구분하고, 정규장과 시간외 등락률을 섞지 마세요.' })),
  { symbol: 'KRW=X', label: '원·달러 환율', market: 'global', kind: 'fx', sectors: [], threshold: 1,
    meaning: '1달러를 사는 데 필요한 원화예요. 이 숫자가 오르면 같은 달러를 사는 데 더 많은 원화가 필요해요.',
    path: ['원·달러 환율 변화', '달러 매출·수입 비용·환산 가치 변화', '기업의 환헤지와 실제 결제 통화 확인'],
    watch: '수출 기업도 달러로 원재료를 사거나 환율 변동에 대비한 계약을 맺을 수 있어요. 환율 상승을 일괄 수혜로 보지 마세요.' },
  { symbol: 'CL=F', label: 'WTI 원유 선물', market: 'global', kind: 'commodity', sectors: ['energy', 'industrials'], threshold: 3,
    meaning: '미국산 원유를 미래에 거래하는 계약의 가격이에요. 원유 현물이나 국내 주유소 가격과 같지는 않아요.',
    path: ['원유 선물 가격 변화', '연료·운송·석유화학 원가 변화 가능성', '판매 가격 전가와 원유 생산 기업의 매출 확인'],
    watch: '공급 차질인지 수요 변화인지에 따라 의미가 달라요. 선물의 계약 교체도 가격 비교에 영향을 줄 수 있어요.' },
  { symbol: 'GC=F', label: '금 선물', market: 'global', kind: 'commodity', sectors: [], threshold: 2,
    meaning: '금을 미래에 거래하는 계약의 가격이에요. 금 현물이나 국내 금 상품의 수익률과는 차이가 있어요.',
    path: ['금 선물 가격 변화', '달러·금리·자금 흐름 함께 확인', '금 관련 상품의 환율·비용 확인'],
    watch: '금이 올랐다는 사실만으로 시장의 불안이 원인이라고 단정할 수 없어요.' },
  { symbol: '^TNX', label: '미국 10년 국채금리', market: 'global', kind: 'yield', sectors: ['real-estate', 'technology', 'financials'], threshold: 0.1,
    meaning: '미국 정부에 10년 동안 돈을 빌려줄 때 시장이 요구하는 금리예요. 기업의 자금 조달과 주식 가치 평가의 참고 기준이 돼요.',
    path: ['장기 국채금리 변화', '기업의 자금 조달·주식 가치 평가 기준 변화', '차입 구조와 이익 전망 확인'],
    watch: '금리 수준의 변화는 %포인트로 비교해요. 금리 상승이 성장 기대 때문인지 물가 부담 때문인지도 구분해야 해요.' },
];

export const KRX_RSS_URL = 'https://kind.krx.co.kr/disclosure/rsstodaydistribute.do?method=searchRssTodayDistribute&mktTpCd=0&currentPageSize=3000';
export const CIRCUIT_RULE_URL = 'https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=3&cciNo=1&cnpClsNo=1&csmSeq=1701';
