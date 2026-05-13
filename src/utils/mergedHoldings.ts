/**
 * Phase M-1.2 — 다중 broker 분산 보유 종목 통합 selector.
 *
 * docs/BROKER_MERGE_FEATURE.md 합의 (옵션 A):
 * - StockItem raw row 그대로 보존 (마이그레이션 0)
 * - selector가 같은 symbol을 grouping → 가중평균 평단가·환율
 * - lots 필드로 broker별 원본 lot 보존 (편집·세금 시뮬 위해)
 *
 * 사용:
 *   const merged = mergeHoldings(stocks.investing);
 *   const hasMulti = merged.some(h => h.hasMultipleBrokers);
 */

import type { StockItem, Broker } from '@/config/constants';

export interface MergedHolding {
  symbol: string;
  /** 합산 보유 수량 */
  totalShares: number;
  /** USD/KRW 종목별 가중평균 평단가 — Σ(avgCost × shares) / Σshares */
  mergedAvgCost: number;
  /** 환율 가중평균 (USD 종목만 의미 있음) — Σ(rate × avgCost × shares) / Σ(avgCost × shares) */
  mergedPurchaseRate?: number;
  /** 합산 목표 수익률 (가중평균) — 미설정 row 제외 */
  mergedTargetReturn: number;
  /** broker별 원본 lot — 편집·세금 시뮬·매도 순서 결정에 사용 */
  lots: StockItem[];
  /** 등록된 broker 목록 (중복 제거) */
  brokers: Broker[];
  /** 자동 추론 — 2개 이상 broker에 분산 보유? */
  hasMultipleBrokers: boolean;
  /** 미지정 broker 포함 여부 (사용자 입력 안 한 lot) */
  hasUnspecifiedBroker: boolean;
}

/**
 * 같은 symbol을 가진 StockItem들을 통합. broker별 lot은 보존.
 *
 * 가중평균 평단가 계산은 통화 무관 (USD/KRW 종목별 다른 인스턴스로 분리되어 들어옴).
 * 환율은 USD 종목의 purchaseRate가 있을 때만 가중평균 산출.
 */
export function mergeHoldings(stocks: StockItem[]): MergedHolding[] {
  const groups = new Map<string, StockItem[]>();

  for (const s of stocks) {
    const key = s.symbol.toUpperCase();
    const arr = groups.get(key) || [];
    arr.push(s);
    groups.set(key, arr);
  }

  const result: MergedHolding[] = [];

  for (const [symbol, lots] of groups.entries()) {
    const totalShares = lots.reduce((sum, l) => sum + (l.shares || 0), 0);
    const weightedAvgSum = lots.reduce((sum, l) => sum + (l.avgCost || 0) * (l.shares || 0), 0);
    const mergedAvgCost = totalShares > 0 ? weightedAvgSum / totalShares : 0;

    // 환율 가중평균 — purchaseRate가 있는 lot만, avgCost × shares 가중
    const ratedLots = lots.filter(l => l.purchaseRate && l.purchaseRate > 0);
    let mergedPurchaseRate: number | undefined;
    if (ratedLots.length > 0) {
      const rateNum = ratedLots.reduce(
        (sum, l) => sum + (l.purchaseRate || 0) * (l.avgCost || 0) * (l.shares || 0),
        0,
      );
      const rateDen = ratedLots.reduce(
        (sum, l) => sum + (l.avgCost || 0) * (l.shares || 0),
        0,
      );
      mergedPurchaseRate = rateDen > 0 ? rateNum / rateDen : undefined;
    }

    // 목표 수익률 — 설정된 lot만 가중평균
    const targetLots = lots.filter(l => l.targetReturn && l.targetReturn > 0);
    let mergedTargetReturn = 0;
    if (targetLots.length > 0) {
      const tNum = targetLots.reduce((sum, l) => sum + (l.targetReturn || 0) * (l.shares || 0), 0);
      const tDen = targetLots.reduce((sum, l) => sum + (l.shares || 0), 0);
      mergedTargetReturn = tDen > 0 ? tNum / tDen : 0;
    }

    const brokers = Array.from(
      new Set(lots.map(l => l.broker).filter((b): b is Broker => !!b)),
    );
    const hasUnspecifiedBroker = lots.some(l => !l.broker);

    result.push({
      symbol,
      totalShares,
      mergedAvgCost,
      mergedPurchaseRate,
      mergedTargetReturn,
      lots,
      brokers,
      hasMultipleBrokers: brokers.length + (hasUnspecifiedBroker ? 1 : 0) >= 2,
      hasUnspecifiedBroker,
    });
  }

  return result;
}

/**
 * 사용자 패턴 자동 추론 — 같은 종목 분산 보유가 1개라도 있으면 통합 뷰 디폴트.
 * 그 외엔 broker별 분리 디폴트 (페르소나 B 처럼 증권사별 다른 종목 패턴).
 */
export function inferDefaultViewMode(stocks: StockItem[]): 'merged' | 'separated' {
  const merged = mergeHoldings(stocks);
  return merged.some(h => h.hasMultipleBrokers) ? 'merged' : 'separated';
}
