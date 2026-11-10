import { benchmarkLesson, FUND_FOUNDATIONS } from './fundLearning';
import { FUND_MECHANISMS, type FundProfile } from './fundExploration';
import { sectorById, type SectorId } from './sectorExploration';

// Editorial background connections, not an inferred or live holdings list.
const INDUSTRY_LINKS: Partial<Record<string, SectorId>> = {
  SOXL:'semiconductors', SOXS:'semiconductors', SOXX:'semiconductors', SMH:'semiconductors',
  XLK:'technology', VGT:'technology', XLC:'communication', XLY:'consumer-discretionary',
  XLP:'consumer-staples', XLE:'energy', AMLP:'energy', XLF:'financials',
  XLV:'healthcare', XLI:'industrials', XLB:'materials', XLU:'utilities',
  XLRE:'real-estate', IYR:'real-estate', VNQ:'real-estate', SCHH:'real-estate',
};

export function fundExplorationEntry(fund: FundProfile) {
  const benchmark = benchmarkLesson(fund);
  const foundation = FUND_FOUNDATIONS[fund.kind];
  const sector = INDUSTRY_LINKS[fund.symbol];
  return {
    label: sector ? sectorById(sector).name : benchmark?.name ?? FUND_MECHANISMS[fund.kind].label,
    description: sector ? '산업과 투자 대상 알아보기' : '투자 대상과 작동 방식 알아보기',
    meaning: benchmark?.meaning ?? foundation.meaning,
    detail: benchmark?.detail ?? foundation.watch,
    sector,
    scope: INDUSTRY_LINKS[fund.symbol]
      ? '아래는 산업 전반의 설명과 기업 예시예요. 이 상품의 현재 구성 종목이나 비중 목록은 아니에요.'
      : '상품의 투자 대상과 구조를 설명해요. 최신 구성·비중·비용은 운용사 자료에서 확인할 수 있어요.',
  };
}
