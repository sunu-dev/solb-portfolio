/**
 * 종목별 변동성 베이스라인 + z-score 계산.
 *
 * 핵심 철학:
 * "절대값 임계값(±3%)" → "본인 베이스라인 대비 N σ"로 적응형
 * - 안정 종목(KO σ≈1%)에서 1% 변동 = 1σ 신호 (기존엔 무시됨)
 * - 변동 종목(TSLA σ≈4%)에서 3% 변동 = 0.75σ 노이즈 (기존엔 알림 발생)
 *
 * z-score 해석:
 * - |z| < 1: 평소 범위 (노이즈)
 * - |z| ≥ 1: 약한 신호 (주의)
 * - |z| ≥ 2: 중간 신호 (이상치 95%)
 * - |z| ≥ 3: 강한 신호 (극단치)
 */

import type { CandleRaw } from '@/config/constants';

export interface VolBaseline {
  /** 일일 수익률 평균 (%) */
  avgReturn: number;
  /** 일일 수익률 표준편차 (%) */
  stdReturn: number;
  /** 표본 크기 (관측된 일수) */
  count: number;
  /** 신뢰할 수 있는 베이스라인 여부 (count ≥ 20) */
  isReliable: boolean;
}

/**
 * 캔들에서 일일 수익률 시리즈 추출.
 * returns[i] = (close[i] - close[i-1]) / close[i-1] × 100
 */
function dailyReturns(candles: CandleRaw | undefined, lookback = 30): number[] {
  if (!candles?.c?.length || candles.c.length < 2) return [];
  // 마지막 lookback+1개만 사용 (lookback일치 수익률 = lookback+1개 가격 필요)
  const closes = candles.c.slice(-lookback - 1);
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      out.push(((closes[i] - closes[i - 1]) / closes[i - 1]) * 100);
    }
  }
  return out;
}

/**
 * 30일 일일 수익률 베이스라인 계산.
 * 표본 < 5개면 unreliable, < 20개도 unreliable로 표시.
 */
export function computeVolBaseline(candles: CandleRaw | undefined, lookback = 30): VolBaseline {
  const returns = dailyReturns(candles, lookback);
  if (returns.length < 5) {
    return { avgReturn: 0, stdReturn: 0, count: returns.length, isReliable: false };
  }
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);
  return {
    avgReturn: mean,
    stdReturn: std,
    count: returns.length,
    isReliable: returns.length >= 20,
  };
}

/**
 * 오늘의 일일 수익률 z-score.
 * unreliable baseline이거나 std=0이면 null 반환.
 */
export function computeZScore(todayReturn: number, baseline: VolBaseline): number | null {
  if (!baseline.isReliable || baseline.stdReturn <= 0) return null;
  return (todayReturn - baseline.avgReturn) / baseline.stdReturn;
}

/**
 * 적응형 "큰 움직임" 임계값 (% 단위).
 * 종목 변동성에 따라 자동 조정. 베이스라인 부족 시 기본값 fallback.
 *
 * @param sigmaMultiplier 신호로 간주할 σ 배수 (기본 2 = 95% 이상치)
 * @param fallback 베이스라인 부족 시 사용할 절대 임계값 (%)
 */
export function adaptiveDailyMoveThreshold(
  baseline: VolBaseline,
  sigmaMultiplier = 2,
  fallback = 3,
): number {
  if (!baseline.isReliable) return fallback;
  // 최소 1% (극단적 저변동주에서 0.1% 변동에 알림 가는 것 방지)
  return Math.max(1, baseline.stdReturn * sigmaMultiplier);
}

/**
 * z-score 등급 라벨 (사용자 노출용)
 */
export function zScoreGrade(z: number): 'noise' | 'mild' | 'notable' | 'extreme' {
  const abs = Math.abs(z);
  if (abs < 1) return 'noise';
  if (abs < 2) return 'mild';
  if (abs < 3) return 'notable';
  return 'extreme';
}
