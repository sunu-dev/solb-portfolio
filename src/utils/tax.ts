// ==========================================
// TAX — 세무 데이터 타입 + 원화 환산 단일 게이트 (골격)
// ==========================================
//
// SSOT: docs/TAX_PIVOT_MVP_SPEC.md · 세율·규칙 상수는 @/config/taxRates.
//
// ⚠️ 이 파일은 **데이터 골격 + 환산 게이트**만 담는다. 양도세 '계산'(취득가 산정·세액 산출)은
//    세무사 감수(docs/LEGAL_CONSULTATION_TAX.md A섹션) 후 별도 구현 — 여기서 계산하지 않는다.

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
