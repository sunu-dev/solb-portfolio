/**
 * 시간대 컨텍스트 알림 가중치
 * - 미장 개장 중: 실시간 반응 가능 → 원래 severity 유지
 * - 개장 전 후 원격: 가격 기반 알림은 덜 긴급 (행동할 수 없음)
 * - 주말/휴장: 가격 기반 알림 크게 약화, 기술지표 조금 약화
 *
 * severity 가중치: 숫자 클수록 우선순위 낮음 (severity 1=가장 중요)
 * 가중 후 severity는 단순 sort에만 영향, 원래 severity는 표시용으로 유지
 */

import type { Alert } from './alertsEngine';
import type { MarketStatus } from './marketHours';

// 가격 변동 즉시 반응 필요한 알림 타입들
const PRICE_SENSITIVE_TYPES = new Set([
  'stoploss-hit', 'stoploss-near', 'stoploss-pct',
  'target-hit', 'target-near', 'target-return', 'target-profit-usd', 'target-profit-krw',
  'below-avgcost', 'buy-zone',
  'daily-surge', 'daily-plunge',
  'portfolio-down',
]);

// 기술지표 알림 (시간대 덜 민감, 추세 기반)
const TECHNICAL_TYPES = new Set([
  'golden-cross', 'death-cross',
  'rsi-oversold', 'rsi-overbought',
  'bb-upper', 'bb-lower',
  'macd-bull', 'macd-bear',
  'near-52w-high', 'near-52w-low',
  'composite-strong-bounce', 'composite-strong-uptrend',
  'composite-overheated', 'composite-strong-downtrend', 'composite-squeeze',
]);

/**
 * alertId에서 타입 추출 (alertLearning와 동일 로직)
 */
function extractType(alertId: string): string | null {
  const parts = alertId.split('-');
  if (parts.length < 3) return null;
  const core = parts.slice(2);
  const last = core[core.length - 1];
  if (/^\d+$/.test(last)) core.pop();
  return core.join('-');
}

/**
 * 시간대 기반 severity 조정
 * 반환값은 sort 전용(가중치) — 원래 severity는 표시용으로 유지
 */
export function weightBySession(alert: Alert, marketStatus: MarketStatus): number {
  const baseSeverity = alert.severity;
  // urgent (severity 1) 은 시간대 무관 항상 최상위
  if (baseSeverity === 1) return baseSeverity;

  const type = extractType(alert.id);
  if (!type) return baseSeverity;

  const isPrice = PRICE_SENSITIVE_TYPES.has(type);
  const isTech  = TECHNICAL_TYPES.has(type);

  switch (marketStatus.phase) {
    case 'open': {
      // 정규장 개장 중: 원래 심각도
      return baseSeverity;
    }
    case 'pre': {
      // 개장 전 1시간 내면 가까우니 원래대로, 그 외엔 가격 기반 +1
      const oneHour = 60 * 60 * 1000;
      if (marketStatus.opensInMs <= oneHour) return baseSeverity;
      if (isPrice) return baseSeverity + 1;
      return baseSeverity;
    }
    case 'post': {
      // 마감 후: 가격 기반 알림은 다음 개장까지 action 불가 → +1
      if (isPrice) return baseSeverity + 1;
      return baseSeverity;
    }
    case 'weekend':
    case 'holiday': {
      // 주말/휴장: 가격 +2, 기술지표 +1
      if (isPrice) return baseSeverity + 2;
      if (isTech)  return baseSeverity + 1;
      return baseSeverity;
    }
  }
}

/**
 * 시간대 가중 적용하여 정렬 후 반환
 * 원본 배열 유지 (불변)
 */
export function sortWithSessionWeight(alerts: Alert[], marketStatus: MarketStatus): Alert[] {
  return [...alerts].sort((a, b) => {
    const wa = weightBySession(a, marketStatus);
    const wb = weightBySession(b, marketStatus);
    if (wa !== wb) return wa - wb;
    // 가중치 동점: 최신이 위로
    return b.timestamp - a.timestamp;
  });
}