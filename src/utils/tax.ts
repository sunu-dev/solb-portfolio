// ==========================================
// TAX — 세무 데이터 타입 + v1 합산기 + 원화 환산 게이트(v2)
// ==========================================
//
// SSOT: docs/TAX_PIVOT_MVP_SPEC.md · 세율·규칙 상수는 @/config/taxRates.
//
// ⚠️ v1 합산기(computeTaxEstimate): 증권사가 제공한 '실현손익(KRW)'을 **합산**해 예상 양도세를
//    추정한다. 우리는 세액을 '재계산'하지 않는다 — 환율·lot·환차는 증권사가 이미 반영했고, 우리는
//    verified 공제·세율만 적용한다(세무사 감수 불요 경로). 결과는 '추정치'(신고 근거 아님).
// ⚠️ v2 자체계산(toKrwAtSettle 등): raw 거래내역에서 직접 산출 — 세무사 감수+E&O 게이트. 미구현.

import { ANNUAL_BASIC_DEDUCTION_KRW, OVERSEAS_CAPITAL_GAINS_TAX_RATE } from '@/config/taxRates';

// ─── v1 합산기 ────────────────────────────────────────────────────────────────
/** 증권사별 올해 실현손익 1줄 (증권사 '양도소득세 계산내역' 제공값, 이미 KRW 환산) */
export interface TaxBrokerEntry {
  id: string;
  broker: string;      // @/config/constants Broker
  gainKrw: number;     // 실현손익 (KRW, 음수=손실 가능)
}

/** v1 합산기 추정 결과 (전부 '추정치' — 신고 근거 아님) */
export interface TaxEstimate {
  totalGainKrw: number;       // 합산 실현손익
  deductionUsed: number;      // 사용한 기본공제 (0~250만)
  deductionRemaining: number; // 잔여 기본공제 (0~250만)
  taxableBaseKrw: number;     // 과세표준 = max(0, 합산 − 250만)
  estimatedTaxKrw: number;    // 추정 양도세 = 과세표준 × 22% (반올림)
}

/**
 * v1 합산기 — 증권사 제공 실현손익(KRW)을 합산해 예상 양도세를 추정한다.
 *
 * 계산은 단순 산수만: 합산 → 250만 기본공제(국내외 합산 1회) → 22% 단일세율.
 * 환율·lot 취득가·환차손익은 **계산하지 않는다**(증권사가 이미 반영, needs-confirm 회피).
 * 손실 이월 없음(taxRates.LOSS_CARRYFORWARD_ALLOWED=false), 같은 과세연도 합산만.
 * 순수 함수 — tax.test.ts로 검증. 결과는 화면에서 항상 '(추정)'으로 노출.
 */
export function computeTaxEstimate(entries: TaxBrokerEntry[]): TaxEstimate {
  const totalGainKrw = entries.reduce((sum, e) => {
    const g = Number(e.gainKrw);
    return sum + (Number.isFinite(g) ? g : 0); // NaN/Infinity 가드
  }, 0);
  const deductionUsed = Math.max(0, Math.min(ANNUAL_BASIC_DEDUCTION_KRW, totalGainKrw));
  const deductionRemaining = ANNUAL_BASIC_DEDUCTION_KRW - deductionUsed;
  const taxableBaseKrw = Math.max(0, totalGainKrw - ANNUAL_BASIC_DEDUCTION_KRW);
  const estimatedTaxKrw = Math.round(taxableBaseKrw * OVERSEAS_CAPITAL_GAINS_TAX_RATE);
  return { totalGainKrw, deductionUsed, deductionRemaining, taxableBaseKrw, estimatedTaxKrw };
}

// ─── v2 자체계산 골격 (세무사 감수 게이트 — 미배선) ───────────────────────────────

/** 거래 시장 (transactions.market) */
export type TaxMarket = 'US' | 'KR' | 'JP' | 'HK' | 'other';

/** 개별 매매 lot — transactions 테이블 1:1 (양도세 SSOT) */
export interface TaxTransaction {
  id: string;
  userId: string;
  symbol: string;
  market: TaxMarket;
  broker?: string;
  type: 'buy' | 'sell';
  tradeDate: string;        // 체결일 (ISO date)
  settleDate?: string;      // 결제일(T+2) — 환율 기준일. ⚠️ needs-confirm
  shares: number;
  priceLocal: number;
  currency: string;         // 'USD' | 'KRW' ...
  feeLocal: number;
  fxRate?: number;          // 결제일 매매기준율 (KRW per 1 통화)
  source: 'csv' | 'ocr' | 'manual' | 'broker_statement';
  createdAt: string;
}

/** 일자별 공식 매매기준율 — fx_rates 테이블 1:1 */
export interface FxRate {
  date: string;             // ISO date
  base: string;             // 'USD'
  quote: string;            // 'KRW'
  rate: number;             // KRW per 1 base
  source: string;
}

/** 원화 환산 결과 — 환율 없으면 krw=null (틀린 숫자 대신 '계산 불가'를 강제) */
export type KrwConversion =
  | { krw: number; rate: FxRate }
  | { krw: null; reason: 'krw-already' | 'no-rate' };

/**
 * 세무용 원화 환산 단일 게이트.
 *
 * 양도세 코어의 **모든** 외화→원화 환산은 이 함수만 통과한다.
 * ⚠️ 실시간 spot rate·1400 fallback은 세무 환산에 **절대 금지** — 부정확하면 세액이 틀려
 *    가산세로 직결된다(약관규제법 §7로 면책도 무력). 반드시 결제일 기준 공식 매매기준율(fx_rates)만.
 * 환율이 없으면 숫자를 지어내지 않고 krw=null을 반환해 화면이 '계산 불가/세무사 확인 필요'로
 * 분기하게 한다.
 *
 * @param amountForeign 외화 금액 (priceLocal × shares 등)
 * @param currency      통화 ('KRW'이면 환산 없이 그대로)
 * @param settleDate    결제일(ISO) — 환산 기준일
 * @param resolveRate   fx_rates 조회 어댑터. 결제일에 데이터 없으면 직전 영업일 carry-forward한
 *                      FxRate를, 그래도 없으면 null을 반환하도록 구현(Phase 2: Supabase fx_rates).
 */
export function toKrwAtSettle(
  amountForeign: number,
  currency: string,
  settleDate: string,
  resolveRate: (settleDate: string) => FxRate | null,
): KrwConversion {
  if (currency === 'KRW') return { krw: null, reason: 'krw-already' };
  const rate = resolveRate(settleDate);
  if (!rate || !(rate.rate > 0)) return { krw: null, reason: 'no-rate' };
  return { krw: amountForeign * rate.rate, rate };
}
