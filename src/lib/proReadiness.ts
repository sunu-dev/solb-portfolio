import { PRO_PLAN, PRO_TOOL_FEATURES, SHARED_INVESTMENT_ACCESS } from '@/config/proPlan';
import { TIER_LIMITS } from '@/lib/userTier';

export interface ProReadinessItem {
  id: string;
  label: string;
  ready: boolean;
  requiredForSales: boolean;
  detail: string;
}

export interface ProReadiness {
  planId: string;
  salesRequested: boolean;
  readyForSales: boolean;
  aiAccessEqual: boolean;
  items: ProReadinessItem[];
  sharedInvestmentAccess: readonly string[];
}

function enabled(value: string | undefined): boolean {
  return value === 'true';
}

export function buildProReadiness(env: Record<string, string | undefined>): ProReadiness {
  const aiAccessEqual = JSON.stringify(TIER_LIMITS.free) === JSON.stringify(TIER_LIMITS.pro);
  const salesRequested = enabled(env.PRO_TOOLS_SALES_ENABLED);
  const items: ProReadinessItem[] = [
    {
      id: 'product_boundary',
      label: '도구형 상품 경계',
      ready: PRO_TOOL_FEATURES.length > 0 && aiAccessEqual,
      requiredForSales: true,
      detail: 'PRO 혜택은 기록 관리 도구로만 구성하고 투자 관련 AI 접근은 전 등급 동일하게 유지해요.',
    },
    {
      id: 'database_schema',
      label: '구독 스키마 적용',
      ready: enabled(env.PRO_TOOLS_SCHEMA_READY),
      requiredForSales: true,
      detail: '운영 DB 마이그레이션 적용과 RLS 확인이 필요해요.',
    },
    {
      id: 'legal_interpretation',
      label: '유료 구조 공식 확인',
      ready: enabled(env.PRO_TOOLS_LEGAL_APPROVED),
      requiredForSales: true,
      detail: '도구 구독료가 투자조언 대가가 아니라는 법령해석 또는 전문가 확인이 필요해요.',
    },
    {
      id: 'terms_privacy_refund',
      label: '약관·개인정보·환불 정책',
      ready: enabled(env.PRO_TOOLS_POLICIES_READY),
      requiredForSales: true,
      detail: '자동결제, 해지, 환불, 보관기간, 국외이전 문구를 실제 흐름과 맞춰야 해요.',
    },
    {
      id: 'billing_webhook',
      label: '결제 웹훅·중복 방지',
      ready: enabled(env.PRO_TOOLS_BILLING_READY),
      requiredForSales: true,
      detail: '서명 검증, 이벤트 멱등성, 만료·환불·연체 처리를 검증해야 해요.',
    },
    {
      id: 'business_compliance',
      label: '사업자·통신판매·세금 준비',
      ready: enabled(env.PRO_TOOLS_BUSINESS_READY),
      requiredForSales: true,
      detail: '사업자등록, 통신판매업, 결제대행 계약, 현금영수증·부가세 처리를 확인해야 해요.',
    },
    {
      id: 'manual_grants',
      label: '수동 PRO 권한 점검',
      ready: enabled(env.PRO_TOOLS_MANUAL_GRANTS_AUDITED),
      requiredForSales: true,
      detail: '기존 수동 PRO 계정의 사유와 만료일을 확인해 무기한 권한을 정리해야 해요.',
    },
    {
      id: 'restore_drill',
      label: '백업·복구 훈련',
      ready: enabled(env.PRO_TOOLS_RESTORE_DRILL_READY),
      requiredForSales: true,
      detail: '구독·포트폴리오 복구 절차를 스테이징에서 실제로 실행해봐야 해요.',
    },
    {
      id: 'metrics_kill_switch',
      label: '매출 지표·판매 중단 장치',
      ready: enabled(env.PRO_TOOLS_METRICS_READY),
      requiredForSales: true,
      detail: '결제 성공률, 환불, 해지, 권한 오류를 관측하고 신규 판매를 즉시 끌 수 있어야 해요.',
    },
    {
      id: 'support_operations',
      label: '고객지원·장애 대응',
      ready: enabled(env.PRO_TOOLS_SUPPORT_READY),
      requiredForSales: true,
      detail: '결제 문의, 데이터 복구, 장애 공지 담당과 응답 기준이 필요해요.',
    },
  ];

  const readyForSales = salesRequested
    && items.filter((item) => item.requiredForSales).every((item) => item.ready);

  return {
    planId: PRO_PLAN.id,
    salesRequested,
    readyForSales,
    aiAccessEqual,
    items,
    sharedInvestmentAccess: SHARED_INVESTMENT_ACCESS,
  };
}
