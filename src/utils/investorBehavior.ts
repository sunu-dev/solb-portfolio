/**
 * 투자자 유형 행동 보정 — 자가진단 vs 실제 포트폴리오 매칭.
 *
 * 핵심 철학: "되고 싶은 당신(declared type)" vs "지금 있는 당신(behavior)" 가시화.
 * 두 유형이 크게 다르면 사용자에게 부드러운 힌트 노출 → 자기 인식 + 행동 보정 유도.
 *
 * 알고리즘:
 * 1. 현재 포트폴리오의 섹터 비중 분포 계산
 * 2. 각 InvestorType의 referenceSectors와 L1 거리 측정 → fit 점수(0~1)
 * 3. 가장 높은 fit이 declared type과 다르면, 차이가 임계 이상일 때 mismatch
 */

import type { StockItem } from '@/config/constants';
import { INVESTOR_TYPES, type InvestorType } from '@/config/investorTypes';
import { getSector } from '@/utils/portfolioHealth';

export interface BehaviorInference {
  /** 행동 기반으로 가장 잘 맞는 유형 */
  bestFit: InvestorType;
  /** best fit 점수 (0~1, 1 = 완벽 일치) */
  bestFitScore: number;
  /** 사용자가 자가진단한 유형 */
  declaredType: InvestorType;
  /** declared type의 fit 점수 */
  declaredFitScore: number;
  /** best와 declared 간 차이 (%p, 0~100) */
  gapPct: number;
  /** 미스매치 — gapPct ≥ 15 AND best ≠ declared */
  isMismatch: boolean;
}

function computeSectorWeights(
  stocks: StockItem[],
  macroData: Record<string, unknown>,
): Record<string, number> {
  let total = 0;
  const acc: Record<string, number> = {};
  for (const s of stocks) {
    if (s.shares <= 0 || s.avgCost <= 0) continue;
    const q = macroData[s.symbol] as { c?: number } | undefined;
    const price = q?.c || 0;
    if (price <= 0) continue;
    const v = price * s.shares;
    total += v;
    const sector = getSector(s.symbol);
    acc[sector] = (acc[sector] || 0) + v;
  }
  if (total === 0) return {};
  const out: Record<string, number> = {};
  for (const k in acc) out[k] = acc[k] / total;
  return out;
}

/** L1 거리 기반 fit. 1 - distance/2, 0~1 (1 = 완벽 일치) */
function fitness(
  user: Record<string, number>,
  ref: Record<string, number>,
): number {
  const allSectors = new Set([...Object.keys(user), ...Object.keys(ref)]);
  let dist = 0;
  for (const s of allSectors) {
    dist += Math.abs((user[s] || 0) - (ref[s] || 0));
  }
  // L1 거리는 0~2 범위 → 1 - dist/2 → 0~1
  return Math.max(0, 1 - dist / 2);
}

/**
 * 자가진단 vs 실제 포트폴리오 비교.
 * 종목 < 3개면 표본 부족으로 null 반환 (의미 있는 비교 어려움).
 */
export function inferInvestorBehavior(
  investingStocks: StockItem[],
  macroData: Record<string, unknown>,
  declaredType: InvestorType,
): BehaviorInference | null {
  // 표본 가드: 3종목 이상에 실제 보유분
  const valid = investingStocks.filter(s => s.shares > 0 && s.avgCost > 0);
  if (valid.length < 3) return null;

  const userWeights = computeSectorWeights(valid, macroData);
  if (Object.keys(userWeights).length < 2) return null;

  const fits = (Object.keys(INVESTOR_TYPES) as InvestorType[])
    .map(type => ({
      type,
      score: fitness(userWeights, INVESTOR_TYPES[type].referenceSectors),
    }))
    .sort((a, b) => b.score - a.score);

  const best = fits[0];
  const declared = fits.find(f => f.type === declaredType);
  if (!declared) return null;

  const gapPct = (best.score - declared.score) * 100;
  // 미스매치 임계: gap 15%p AND best ≠ declared
  const isMismatch = best.type !== declaredType && gapPct >= 15;

  return {
    bestFit: best.type,
    bestFitScore: best.score,
    declaredType,
    declaredFitScore: declared.score,
    gapPct,
    isMismatch,
  };
}
