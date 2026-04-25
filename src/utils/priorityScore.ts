/**
 * 시그널 우선순위 점수화 — AI 프롬프트에 "사용자가 주목하는 핵심 종목" 컨텍스트 주입.
 *
 * 핵심 철학: 모든 보유 종목을 평면적으로 나열하면 AI 토큰 낭비 + 핵심 묻힘.
 * 다중 신호 가중합으로 상위 N개만 상세, 나머지는 한 줄 요약.
 *
 * 가중치:
 *   priority = 0.35 · |z|              ← 이상치 변동(현재 시장 신호)
 *           + 0.25 · weight            ← 보유 비중(사용자 자산 비중)
 *           + 0.20 · goal_proximity    ← 목표 근접도(수익 실현 임박)
 *           + 0.20 · memo_recency      ← 최근 메모(사용자 관심 표명)
 *
 * 정규화: 모든 인풋을 0~1로 매핑, 합도 0~1 (1이 만점)
 */

import type { CandleRaw, QuoteData, StockItem, StockNote } from '@/config/constants';
import { computeVolBaseline, computeZScore } from './volatility';

export interface HoldingPriority {
  symbol: string;
  weight: number;        // 0~1 비중
  pnlPct: number;        // 누적 수익률 %
  todayDp: number;       // 오늘 변동률 %
  zScore: number | null; // 종목별 z-score
  goalProximity: number; // 0~1 목표 근접도
  memoRecencyDays: number | null; // 최근 메모 며칠 전
  recentMemoText: string | null;  // 최근 메모 텍스트 (첫 30자)
  priority: number;      // 0~1 종합 점수
}

/**
 * 메모 시간 가중치 — 최근일수록 높음, 14일 반감기
 * exp(-days / 14): 0일 1.0, 7일 0.61, 14일 0.37, 30일 0.12
 */
function memoRecencyScore(daysSince: number | null): number {
  if (daysSince === null) return 0;
  return Math.exp(-Math.max(0, daysSince) / 14);
}

/**
 * 목표 근접도 — 현재 수익률이 목표에 얼마나 가까운지 0~1
 * 달성 직전(85~110%)에서 가장 높음, 멀어질수록 0으로
 */
function goalProximityScore(currentPnlPct: number, targetReturn: number | undefined): number {
  if (!targetReturn || targetReturn <= 0) return 0;
  const progress = currentPnlPct / targetReturn; // 1.0 = 정확히 달성
  if (progress < 0) return 0; // 손실 중
  if (progress >= 0.85 && progress <= 1.10) return 1.0; // 임박/막 달성
  if (progress >= 0.7) return 0.7; // 거의 임박
  if (progress >= 0.5) return 0.5; // 절반
  return Math.max(0, progress); // 그 이하는 진척률 그대로
}

/**
 * 보유 종목들의 우선순위 점수 계산. 상위순 정렬해서 반환.
 *
 * @param stocks 투자중 종목 (avgCost > 0, shares > 0)
 * @param macroData 시세 데이터
 * @param rawCandles 캔들 (z-score 계산용)
 * @returns 우선순위 정렬된 HoldingPriority[]
 */
export function computeHoldingPriorities(
  stocks: StockItem[],
  macroData: Record<string, unknown>,
  rawCandles: Record<string, CandleRaw>,
): HoldingPriority[] {
  const valid = stocks.filter(s => s.avgCost > 0 && s.shares > 0);
  if (valid.length === 0) return [];

  // 1. 총 평가금액 (비중 분모)
  let totalValue = 0;
  for (const s of valid) {
    const q = macroData[s.symbol] as QuoteData | undefined;
    if (q?.c) totalValue += q.c * s.shares;
  }
  if (totalValue === 0) return [];

  const now = Date.now();

  // 2. 종목별 시그널 추출
  const items: HoldingPriority[] = valid.map(s => {
    const q = macroData[s.symbol] as QuoteData | undefined;
    const price = q?.c || 0;
    const dp = q?.dp || 0;
    const value = price * s.shares;
    const weight = totalValue > 0 ? value / totalValue : 0;
    const pnlPct = s.avgCost > 0 ? ((price - s.avgCost) / s.avgCost) * 100 : 0;

    const baseline = computeVolBaseline(rawCandles[s.symbol]);
    const z = computeZScore(dp, baseline);

    const goalProx = goalProximityScore(pnlPct, s.targetReturn);

    // 최근 메모 찾기
    let recentDays: number | null = null;
    let recentText: string | null = null;
    const notes: StockNote[] = s.notes || [];
    if (notes.length > 0) {
      const sorted = [...notes].sort((a, b) => {
        const ta = new Date(a.date.split('_')[0]).getTime();
        const tb = new Date(b.date.split('_')[0]).getTime();
        return tb - ta; // 최신순
      });
      const latest = sorted[0];
      const ts = new Date(latest.date.split('_')[0]).getTime();
      if (!isNaN(ts)) {
        recentDays = (now - ts) / (1000 * 86400);
        const userPart = latest.text.replace(/^\[[^\]]+\]\s*/, '').trim();
        recentText = userPart.length > 30 ? userPart.slice(0, 30) + '…' : (userPart || null);
      }
    }

    // 정규화: |z| 0~3 → 0~1 (3σ 이상은 1로 cap)
    const zNorm = z !== null ? Math.min(Math.abs(z) / 3, 1) : 0;
    const memoNorm = memoRecencyScore(recentDays);

    const priority =
      0.35 * zNorm +
      0.25 * weight +
      0.20 * goalProx +
      0.20 * memoNorm;

    return {
      symbol: s.symbol,
      weight,
      pnlPct,
      todayDp: dp,
      zScore: z,
      goalProximity: goalProx,
      memoRecencyDays: recentDays,
      recentMemoText: recentText,
      priority,
    };
  });

  // 3. 우선순위 내림차순 정렬
  return items.sort((a, b) => b.priority - a.priority);
}

/**
 * AI 프롬프트용 텍스트 컨텍스트 빌드.
 * 상위 N개는 다중 라인 상세, 나머지는 한 줄 요약.
 */
export function buildHoldingsPromptContext(
  priorities: HoldingPriority[],
  topN = 3,
): string {
  if (priorities.length === 0) return '보유 종목 없음';

  const top = priorities.slice(0, topN);
  const rest = priorities.slice(topN);

  const topLines = top.map((h, i) => {
    const parts: string[] = [];
    parts.push(`${i + 1}. ${h.symbol} — 비중 ${(h.weight * 100).toFixed(0)}%, 누적 ${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(1)}%, 오늘 ${h.todayDp >= 0 ? '+' : ''}${h.todayDp.toFixed(2)}%`);
    if (h.zScore !== null && Math.abs(h.zScore) >= 1.5) {
      parts.push(`   · 평소 대비 ${Math.abs(h.zScore).toFixed(1)}σ ${h.zScore > 0 ? '급등' : '급락'} (이례적)`);
    }
    if (h.goalProximity >= 0.7) {
      parts.push(`   · 목표 근접도 ${(h.goalProximity * 100).toFixed(0)}% — 수익 실현 검토 신호`);
    }
    if (h.recentMemoText && h.memoRecencyDays !== null && h.memoRecencyDays <= 30) {
      parts.push(`   · 최근 메모(${Math.round(h.memoRecencyDays)}일 전): "${h.recentMemoText}"`);
    }
    return parts.join('\n');
  });

  const restSummary = rest.length > 0
    ? `\n\n그 외 ${rest.length}종목: ${rest.map(h => `${h.symbol}(${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(1)}%, ${(h.weight * 100).toFixed(0)}%)`).join(', ')}`
    : '';

  return `## 사용자 핵심 보유 종목 (priority 순)\n${topLines.join('\n')}${restSummary}`;
}
