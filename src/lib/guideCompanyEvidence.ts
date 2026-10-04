import type { MarketGuideId } from '@/config/marketGuides';
import { getStockIdentityKey } from '@/utils/stockCurrency';

export interface CompanyReadingPath {
  path: string;
  condition: string;
  watch: string;
}
export interface CompanyEvidence {
  name: string;
  business: string;
  source: { label: string; url: string; period: string; reviewedAt: string };
  paths: Partial<Record<MarketGuideId, CompanyReadingPath>>;
}

/**
 * Reviewed business facts, not live financial results. Paths are editorial questions
 * inferred from the cited business disclosure, never a finding that an event caused earnings.
 * Add a company only after checking its primary source; never infer exposure from a ticker.
 */
const COMPANY_EVIDENCE: Record<string, CompanyEvidence> = {
  AAPL: {
    name: '애플',
    business: '아이폰 등 기기와 서비스를 판매하며, 외화로 발생하는 매출·비용과 소비 여건을 사업 위험으로 설명해요.',
    source: { label: '애플 2025 사업보고서 · 사업·위험 요인', url: 'https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm', period: '2025 회계연도', reviewedAt: '2026-10-04' },
    paths: {
      rates: { path: '금리·경기 전망 → 소비자의 구매 여력 → 기기 교체 수요', condition: '신제품 출시와 지역별 수요가 함께 작용해요. 금리 결정만으로 아이폰 판매를 예측할 수는 없어요.', watch: '다음 실적에서 아이폰 매출과 지역별 매출, 회사의 수요 설명을 함께 확인해요.' },
      inflation: { path: '생활비 변화 → 기기를 살 여력 → 아이폰 등 제품 수요', condition: '미국 소비자물가는 애플의 부품 원가 지표가 아니에요. 제품 구성·가격·해외 수요도 함께 봐야 해요.', watch: '다음 실적에서 제품 매출과 매출총이익률, 수요에 관한 회사 설명을 확인해요.' },
      currency: { path: '판매 통화의 환율 변화 → 달러로 바꾼 해외 매출·비용 → 보고된 이익', condition: '가격 조정과 환위험을 줄이는 계약이 영향을 바꿀 수 있어요. 계좌의 원화 환산 효과와는 다른 경로예요.', watch: '다음 실적에서 환율 영향을 뺀 성장 설명과 지역별 매출을 함께 확인해요.' },
      earnings: { path: '아이폰·서비스 매출과 비용 → 매출총이익 → 다음 실적 전망', condition: '전체 매출이 늘어도 제품 구성과 비용 변화에 따라 이익은 다르게 움직일 수 있어요.', watch: '아이폰과 서비스 매출을 나눠 보고, 매출총이익률과 회사의 다음 분기 설명을 확인해요.' },
    },
  },
  TSLA: {
    name: '테슬라',
    business: '전기차와 에너지 제품을 판매하며, 금리가 고객의 자동차 할부·리스 부담에 영향을 준다고 설명해요.',
    source: { label: '테슬라 2025 사업보고서 · 경영진 설명', url: 'https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm', period: '2025 회계연도', reviewedAt: '2026-10-04' },
    paths: {
      rates: { path: '금리 전망 → 자동차 할부·리스 부담 → 구매 수요와 판매 조건', condition: '실제 대출금리와 할인 정책, 신차 경쟁이 함께 작용해요. 금리 인하가 판매 증가를 보장하지는 않아요.', watch: '다음 실적에서 차량 인도량, 판매 가격·할인 설명, 자동차 부문의 이익률을 함께 봐요.' },
      inflation: { path: '생활비·금리 부담 → 자동차 구매 여력 → 판매량과 할인 정책', condition: '소비자물가를 배터리 원가로 읽으면 안 돼요. 판매 가격과 비용이 각각 어떻게 바뀌었는지 확인해야 해요.', watch: '차량 인도량과 자동차 매출, 할인 정책이 이익률에 미친 설명을 확인해요.' },
      earnings: { path: '차량 판매량·가격과 에너지 매출 → 부문별 이익 → 다음 수요 전망', condition: '자동차와 에너지 사업의 흐름이 다를 수 있어요. 판매량만으로 전체 이익을 판단하지 않아요.', watch: '자동차와 에너지 매출·이익률을 나눠 보고 다음 생산·수요 전망을 확인해요.' },
    },
  },
  MSFT: {
    name: '마이크로소프트',
    business: '클라우드 서비스를 판매하고 데이터센터·AI 기반 시설에 투자한다고 설명해요.',
    source: { label: '마이크로소프트 2025 연차보고서 · 사업·설비 투자', url: 'https://www.microsoft.com/investor/reports/ar25/index.html', period: '2025 회계연도', reviewedAt: '2026-10-04' },
    paths: {
      rates: { path: '금리·경기 전망 → 기업 고객의 투자 판단 → 클라우드 수요를 확인할 필요', condition: '금리만으로 클라우드 수요를 정할 수는 없어요. AI 도입과 설비 공급, 기업의 예산도 함께 작용해요.', watch: '다음 실적에서 Azure 성장과 데이터센터 투자, 클라우드 이익률을 함께 확인해요.' },
      earnings: { path: '클라우드 매출과 설비 투자 → 운영 비용·이익 → 투자 회수 속도', condition: '설비 투자 지출과 손익에 반영되는 비용은 시점이 달라요. 매출 성장만으로 투자 성과를 확정하지 않아요.', watch: 'Azure 성장, 클라우드 이익률, 설비 투자와 현금흐름을 나란히 확인해요.' },
    },
  },
  NVDA: {
    name: '엔비디아',
    business: 'AI 데이터센터용 제품을 공급하며, 고객의 자금·전력·부지 확보가 데이터센터 구축에 필요하다고 설명해요.',
    source: { label: '엔비디아 2027 회계연도 2분기 보고서 · 데이터센터 투자 조건', url: 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/nvda-20260726.htm', period: '2026.7.26 마감 분기', reviewedAt: '2026-10-04' },
    paths: {
      rates: { path: '금융 여건 → 고객의 데이터센터 자금 조달 → 설비 구축과 제품 수요', condition: '금리가 내려도 전력·부지·공급 제약으로 구축이 늦어질 수 있어요. 고객별 자금 사정도 달라요.', watch: '다음 실적에서 데이터센터 매출과 고객의 구축 여건, 공급·수요 전망을 확인해요.' },
      earnings: { path: '데이터센터 제품 수요·공급 → 매출과 제품 구성 → 매출총이익', condition: '수요가 있어도 공급, 고객 설비 준비, 수출 규제에 따라 실적 반영 시점이 달라질 수 있어요.', watch: '데이터센터 매출, 매출총이익률, 공급 약정과 다음 분기 전망을 함께 확인해요.' },
    },
  },
  'KR:005930': {
    name: '삼성전자',
    business: '메모리 반도체와 스마트폰·가전 사업을 함께 운영하며, 부문별 수요·가격·제품 구성을 구분해 설명해요.',
    source: { label: '삼성전자 2025년 4분기·연간 실적 발표', url: 'https://news.samsung.com/global/samsung-electronics-announces-fourth-quarter-and-fy-2025-results', period: '2025년 연간 사업 설명', reviewedAt: '2026-10-04' },
    paths: {
      inflation: { path: '소비 여건 → 스마트폰·가전 수요를 점검 → 반도체 부문과 구분해 실적 확인', condition: '미국 소비자물가는 메모리 가격 지표가 아니에요. 이 발표만으로 삼성전자 전체 이익의 방향을 정할 수 없어요.', watch: '다음 회사 발표에서 메모리 수요·가격 설명과 스마트폰·가전 수요를 나눠 확인해요.' },
      earnings: { path: '메모리 가격·판매 구성과 기기 수요 → 부문별 매출·이익 → 전체 실적', condition: '반도체와 스마트폰의 실적 흐름이 다를 수 있어요. 한 부문의 개선을 회사 전체에 그대로 적용하지 않아요.', watch: '반도체와 스마트폰·가전의 매출·이익을 나눠 보고, 회사가 설명하는 수요 조건을 확인해요.' },
    },
  },
};

export function getCompanyEvidence(symbol: string) {
  return COMPANY_EVIDENCE[getStockIdentityKey(symbol)];
}
