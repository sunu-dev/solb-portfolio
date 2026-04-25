/**
 * 시계열 사전 추출 — AI 프롬프트용 narrative snippet 빌더.
 *
 * 핵심 철학: LLM이 raw candle을 보고 패턴을 추론하면 토큰·정확도 모두 손해.
 * 클라이언트에서 명확한 시간적 패턴(N일째, 누적, 거리)을 텍스트로 미리 추출 → 정확도 + 토큰 효율 ↑
 *
 * 예: "RSI 71" → "RSI 71 (과매수 4거래일째)"
 *     "20일선 위" → "20일선 위 12거래일째 (직전 5거래일 누적 +8.2%)"
 *     "52주 고점 근처" → "52주 고점 대비 -3.2% (28일 전 도달)"
 */

import type { CandleRaw } from '@/config/constants';
import { calcSMA, calcRSI } from './technical';

/**
 * 20/60/200일 이동평균선 대비 현재가 위치 + 연속 일수
 */
export function extractMaPosition(candles: CandleRaw | undefined): string | null {
  if (!candles?.c?.length || candles.c.length < 25) return null;
  const closes = candles.c;
  const sma20 = calcSMA(closes, 20);

  // 마지막 N일간 가격이 sma20 위/아래에 있었는지 카운트
  let aboveDays = 0;
  let belowDays = 0;
  for (let i = closes.length - 1; i >= 0; i--) {
    const ma = sma20[i];
    if (!ma) break;
    if (closes[i] > ma) {
      if (belowDays > 0) break;
      aboveDays++;
    } else if (closes[i] < ma) {
      if (aboveDays > 0) break;
      belowDays++;
    } else break;
  }

  if (aboveDays >= 2) return `20일선 위 ${aboveDays}거래일째 (상승 추세 지속)`;
  if (belowDays >= 2) return `20일선 아래 ${belowDays}거래일째 (하락 추세 지속)`;
  return '20일선 부근 (방향 미정)';
}

/**
 * RSI 현재값 + 과매수/과매도 연속 일수
 */
export function extractRsiTrend(candles: CandleRaw | undefined): string | null {
  if (!candles?.c?.length || candles.c.length < 16) return null;
  const closes = candles.c;
  const rsi = calcRSI(closes, 14);
  const lastIdx = rsi.length - 1;
  const current = rsi[lastIdx];
  if (current === null || current === undefined || isNaN(current)) return null;

  // 과매수(70+) 또는 과매도(30-) 연속 일수
  let overboughtDays = 0;
  let oversoldDays = 0;
  for (let i = lastIdx; i >= 0; i--) {
    const v = rsi[i];
    if (v === null || v === undefined || isNaN(v)) break;
    if (v >= 70) {
      if (oversoldDays > 0) break;
      overboughtDays++;
    } else if (v <= 30) {
      if (overboughtDays > 0) break;
      oversoldDays++;
    } else break;
  }

  if (overboughtDays >= 1) return `RSI ${current.toFixed(0)} (과매수 ${overboughtDays}거래일째)`;
  if (oversoldDays >= 1) return `RSI ${current.toFixed(0)} (과매도 ${oversoldDays}거래일째)`;
  return `RSI ${current.toFixed(0)} (적정 구간)`;
}

/**
 * 52주 고/저점 대비 현재 위치 + 그 시점 며칠 전
 */
export function extract52wPosition(candles: CandleRaw | undefined): string | null {
  if (!candles?.c?.length || candles.c.length < 30) return null;
  const closes = candles.c;
  // 마지막 252거래일(약 1년) 또는 가용 데이터
  const window = closes.slice(-252);
  const high = Math.max(...window);
  const low = Math.min(...window);
  const current = closes[closes.length - 1];
  if (current <= 0) return null;

  const offsetFromEnd = (val: number): number =>
    window.length - 1 - window.lastIndexOf(val);
  const daysSinceHigh = offsetFromEnd(high);
  const daysSinceLow = offsetFromEnd(low);

  const highDistPct = ((high - current) / current) * 100;
  const lowDistPct = ((current - low) / current) * 100;

  if (highDistPct < 3) {
    return `52주 고점 근접 (${daysSinceHigh}거래일 전 $${high.toFixed(2)} 도달, 현재 -${highDistPct.toFixed(1)}%)`;
  }
  if (lowDistPct < 3) {
    return `52주 저점 근접 (${daysSinceLow}거래일 전 $${low.toFixed(2)}, 현재 +${lowDistPct.toFixed(1)}%)`;
  }
  return `52주 범위 중간 (고점 -${highDistPct.toFixed(1)}% / 저점 +${lowDistPct.toFixed(1)}%)`;
}

/**
 * 최근 N거래일 누적 수익률
 */
export function extractRecentMomentum(candles: CandleRaw | undefined, days = 5): string | null {
  if (!candles?.c?.length || candles.c.length < days + 1) return null;
  const closes = candles.c;
  const start = closes[closes.length - 1 - days];
  const end = closes[closes.length - 1];
  if (start <= 0) return null;
  const cumPct = ((end - start) / start) * 100;
  if (Math.abs(cumPct) < 1) return null; // 노이즈 수준은 스킵
  return `최근 ${days}거래일 누적 ${cumPct >= 0 ? '+' : ''}${cumPct.toFixed(1)}%`;
}

/**
 * 거래량 스파이크 — 최근 거래량 vs 20일 평균
 */
export function extractVolumeSpike(candles: CandleRaw | undefined): string | null {
  if (!candles?.v?.length || candles.v.length < 21) return null;
  const vols = candles.v;
  const recent = vols[vols.length - 1];
  const avg20 = vols.slice(-21, -1).reduce((s, v) => s + v, 0) / 20;
  if (recent <= 0 || avg20 <= 0) return null;
  const ratio = recent / avg20;
  if (ratio >= 2) return `거래량 평소의 ${ratio.toFixed(1)}배 (강한 관심)`;
  if (ratio >= 1.5) return `거래량 평소의 ${ratio.toFixed(1)}배 (관심 증가)`;
  if (ratio < 0.5) return `거래량 평소의 ${ratio.toFixed(1)}배 (관심 저하)`;
  return null; // 평소 범위는 노이즈
}

/**
 * 종합 — AI 프롬프트에 주입할 시계열 컨텍스트 텍스트 빌드
 * 신호 있는 라인만 모아서 bullet list로 반환.
 */
export function buildTimeSeriesContext(candles: CandleRaw | undefined): string {
  if (!candles) return '';
  const lines: string[] = [];
  const ma = extractMaPosition(candles);
  const rsi = extractRsiTrend(candles);
  const pos52 = extract52wPosition(candles);
  const momentum = extractRecentMomentum(candles, 5);
  const vol = extractVolumeSpike(candles);
  if (ma) lines.push(`- ${ma}`);
  if (rsi) lines.push(`- ${rsi}`);
  if (pos52) lines.push(`- ${pos52}`);
  if (momentum) lines.push(`- ${momentum}`);
  if (vol) lines.push(`- ${vol}`);
  if (lines.length === 0) return '';
  return `## 시계열 사전 분석\n${lines.join('\n')}`;
}
