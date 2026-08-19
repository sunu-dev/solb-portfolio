export const PRO_PLAN_ID = 'joobi_tools_pro_v1' as const;

export type ProToolFeatureId =
  | 'advanced_portfolio_export'
  | 'backup_versions'
  | 'extended_history'
  | 'bulk_ocr_import'
  | 'dashboard_presets'
  | 'ad_free';

export type ProFeatureReadiness = 'foundation_ready' | 'planned' | 'waiting_for_ads';

export interface ProToolFeature {
  id: ProToolFeatureId;
  label: string;
  description: string;
  readiness: ProFeatureReadiness;
}

/** 결제 여부와 관계없이 보장하는 기본 관리 기능과 데이터 이동권. */
export const FREE_TOOL_BASELINE = [
  '기본 포트폴리오 관리',
  '기본 다중 증권사 통합',
  '기본 클라우드 동기화',
  '기본 CSV·JSON 수동 내보내기',
] as const;

/**
 * 결제 대가가 될 수 있는 기능은 비투자 관리 도구로만 제한한다.
 * 기존 무료 다중 증권사 통합·기본 동기화는 유료 전환 대상에 넣지 않는다.
 */
export const PRO_TOOL_FEATURES: readonly ProToolFeature[] = [
  {
    id: 'advanced_portfolio_export',
    label: '고급·예약 내보내기',
    description: '기본 수동 내보내기는 무료예요. 기간별 묶음과 변경 이력을 예약해 보관해요.',
    readiness: 'foundation_ready',
  },
  {
    id: 'backup_versions',
    label: '이전 기록 복구',
    description: '실수로 바꾼 기록을 이전 저장 시점으로 되돌릴 수 있어요.',
    readiness: 'planned',
  },
  {
    id: 'extended_history',
    label: '긴 기록 보관',
    description: '기본 보관 기간이 지난 포트폴리오 기록을 계속 보관해요.',
    readiness: 'planned',
  },
  {
    id: 'bulk_ocr_import',
    label: '여러 장 한 번에 가져오기',
    description: '여러 증권앱 화면을 묶어서 가져오고 중복 기록을 확인해요.',
    readiness: 'planned',
  },
  {
    id: 'dashboard_presets',
    label: '화면 구성 저장',
    description: '용도별 화면 구성을 여러 개 저장하고 바꿔 쓸 수 있어요.',
    readiness: 'planned',
  },
  {
    id: 'ad_free',
    label: '광고 없이 사용',
    description: '일반 광고가 도입되는 경우 광고 영역을 표시하지 않아요.',
    readiness: 'waiting_for_ads',
  },
] as const;

/** 어떤 요금제에서도 차등하면 안 되는 투자 관련 접근. */
export const SHARED_INVESTMENT_ACCESS = [
  'ai_analysis_count',
  'ai_analysis_quality',
  'ai_analysis_speed',
  'market_explanation',
  'quote_freshness',
  'investment_alerts',
  'stock_selection',
] as const;

export const PRO_PLAN = {
  id: PRO_PLAN_ID,
  name: '주비 플러스',
  monthlyPriceKrw: 4_900,
  annualPriceKrw: 49_000,
  status: 'internal' as const,
  positioning: '투자 판단이 아닌 기록 관리 편의에만 대가를 받는 도구형 구독',
  features: PRO_TOOL_FEATURES,
};
