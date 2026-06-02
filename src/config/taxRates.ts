// ==========================================
// TAX RATES — 한국 양도소득세 SSOT (verified 사실만)
// ==========================================
//
// 출처: 세무 피봇 설계 워크플로 웹 검증 (2026-06-02). 설계 docs/TAX_PIVOT_MVP_SPEC.md.
// 자문 질문지: docs/LEGAL_CONSULTATION_TAX.md (세무사 A섹션이 아래를 최종 확인).
//
// ⚠️ 원칙 1: **verified(웹 확인) 사실만** 여기 상수로 박는다. needs-confirm(환율 기준일·lot
//    취득가법·환차손익·필요경비)은 세무사 확정 전까지 절대 상수로 단정하지 않는다 → TAX_NEEDS_CONFIRM.
// ⚠️ 원칙 2: 세법은 매년 바뀐다. 이 파일이 단일 진실 원천 — 화면·계산이 숫자를 직접 하드코딩하지 말 것.
//    개정 시 TAX_RULES_VERSION + 시행 기준 갱신.
// ⚠️ 원칙 3: 이 상수들은 '계산·정리 도구'의 입력일 뿐, 세무자문이 아니다(세무사법 §2). 사용자 노출
//    문구는 alertCompliance.gateTaxAdvice / TAX_FORBIDDEN_PHRASES 게이트를 통과해야 한다.

export const TAX_RULES_VERSION = 'v1';
export const TAX_RULES_BASIS = '2025년 귀속 (2026년 5월 신고분) 기준';

// ─── 국외주식 양도소득세 (✅ verified) ────────────────────────────────────────
/** 국외주식 양도차익 세율 = 양도세 20% + 지방소득세 2% = 합계 22% 단일세율 (누진 아님) */
export const OVERSEAS_CAPITAL_GAINS_TAX_RATE = 0.22;
export const OVERSEAS_CAPITAL_GAINS_BASE_RATE = 0.20;
export const LOCAL_INCOME_TAX_RATE = 0.02;

/** 양도소득 기본공제 — 연 250만원. ⚠️ 국내·국외 **합산 후 1회** (그룹별로 따로 빼면 과소납부) */
export const ANNUAL_BASIC_DEDUCTION_KRW = 2_500_000;

/** 손실 이월공제 **불가** — 같은 과세연도 내에서만 통산. 금투세(5년 이월) 2024.12 폐지로 무효.
 *  ⚠️ 코드에 이월(carry-forward) 로직을 넣으면 틀린 계산이 된다. 이월 = 절대 금지. */
export const LOSS_CARRYFORWARD_ALLOWED = false;

/** 국외주식 납세의무 — 양도일까지 계속 5년 이상 국내 거주자만 과세 */
export const RESIDENCY_YEARS_REQUIRED = 5;

// ─── 신고 (✅ verified) ───────────────────────────────────────────────────────
/** 예정신고 없음. 익년 5/1~5/31 확정신고 1회 (2025 귀속 → 2026년 5월) */
export const FILING = {
  hasPreliminaryFiling: false,
  confirmedFilingMonth: 5,
  // ⚠️ needs-confirm: 2025 귀속 기한 5/31이 일요일 → 6/1(월) 연장 여부 세무사 확인
} as const;

/** 가산세 — 무신고 20%(부정 40%), 납부지연 1일 0.022% */
export const PENALTY = {
  noFilingRate: 0.20,
  fraudRate: 0.40,
  latePaymentDailyRate: 0.00022,
} as const;

// ─── 국내주식 (✅ verified) ───────────────────────────────────────────────────
/** 국내 상장주식 소액주주 장내매매 = 양도세 비과세. 과세대상은 대주주/비상장/장외만.
 *  ⚠️ 손익통산 풀에 국내 종목을 넣을 땐 '과세대상' 분류 게이트 필수 (소액주주 장내 제외). */
export const KR_LISTED_SMALL_SHAREHOLDER_EXEMPT = true;

/** 대주주 기준 — 종목당 평가액 50억원 이상 (2025.9.15 확정) 또는 지분율 */
export const LARGE_SHAREHOLDER = {
  marketValueThresholdKrw: 5_000_000_000,
  stakeRatio: { kospi: 0.01, kosdaq: 0.02, konex: 0.04 },
} as const;

/** 증권거래세 2026 (2026.1.1 양도분~) — 코스피 0.05%(+농특세 0.15%=0.20%), 코스닥/K-OTC 0.20% */
export const SECURITIES_TRANSACTION_TAX_2026 = {
  kospi: 0.0005,
  kospiWithRuralTax: 0.0020,
  kosdaq: 0.0020,
  kOtc: 0.0020,
} as const;

// ─── 금투세 (✅ verified: 폐지) ───────────────────────────────────────────────
/** 금융투자소득세 2024.12.10 폐지 확정 — 시행 안 됨. 현행 양도소득세 체계로 설계. */
export const FINANCIAL_INVESTMENT_INCOME_TAX_ABOLISHED = true;

// ─── ⚠️ NEEDS-CONFIRM — 세무사 확정 전까지 상수 단정·계산 사용 금지 ──────────────
// 아래 항목은 계산에 직접 쓰기 전 docs/LEGAL_CONSULTATION_TAX.md A섹션으로 세무사가 확정한다.
// 확정 전에는 화면에 'X — 세무사 확인 필요'로 노출하고 숫자를 단정하지 않는다.
//   - fx-settlement-date          : 환율 환산 기준일 = 체결일 vs 결제일(T+2)  → fx 키를 좌우
//   - lot-acquisition-cost-method : lot 취득가 산정법(이동평균/총평균/FIFO), mergedAvgCost 근사 허용 여부
//   - fx-gain-loss-treatment      : 환차손익이 원화환산 차익에 자동 반영 vs 별도 항목
//   - deductible-expenses         : 필요경비 범위(거래수수료 외 차감 가능 항목)
//   - dividend-separate-taxation  : 배당 분리과세(2026~28 한시) — 시행령 변동 중, MVP 범위 밖
//   - isa-2026-limit              : ISA 2026 한도 — 시행령 변동 중, MVP 범위 밖
export const TAX_NEEDS_CONFIRM = [
  'fx-settlement-date',
  'lot-acquisition-cost-method',
  'fx-gain-loss-treatment',
  'deductible-expenses',
  'dividend-separate-taxation',
  'isa-2026-limit',
] as const;
export type TaxNeedsConfirm = (typeof TAX_NEEDS_CONFIRM)[number];
