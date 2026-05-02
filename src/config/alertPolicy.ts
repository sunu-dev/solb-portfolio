// ==========================================
// ALERT POLICY — 단일 진실 원천 (SSOT)
// ==========================================
//
// 정책 문서: docs/NOTIFICATION_POLICY.md
// 본 모듈은 client(alertsEngine)와 server(api/cron/check-alerts) 양쪽에서
// 동일한 채널·카테고리 정책을 참조하도록 분리됨.
// 변경 시 NOTIFICATION_POLICY.md §2 표도 함께 갱신할 것.

export type AlertChannel = 'push' | 'toast' | 'inapp';

export type AlertCategory = 'price' | 'indicator' | 'market' | 'portfolio' | 'celebrate' | 'digest';

export interface AlertPolicyEntry {
  channels: AlertChannel[];
  category: AlertCategory;
}

/**
 * Alert condition별 채널·카테고리 정책 맵.
 *
 * client alertsEngine과 server check-alerts cron이 같은 키 사용.
 * cron은 alertType 명이 약간 다른 경우 alias로 동일 정책 매핑 (target-sell ≡ target-hit 등).
 */
export const ALERT_POLICY: Record<string, AlertPolicyEntry> = {
  // ─── 가격 도달 — 푸시 + 토스트 + 인앱 (사용자가 명시 설정한 트리거)
  'stoploss-hit':       { channels: ['push', 'toast', 'inapp'], category: 'price' },
  'stoploss-price':     { channels: ['push', 'toast', 'inapp'], category: 'price' }, // cron alias
  'stoploss-pct':       { channels: ['push', 'toast', 'inapp'], category: 'price' },
  'target-hit':         { channels: ['push', 'toast', 'inapp'], category: 'price' },
  'target-sell':        { channels: ['push', 'toast', 'inapp'], category: 'price' }, // cron alias
  'target-return':      { channels: ['push', 'toast', 'inapp'], category: 'price' },
  'target-profit-usd':  { channels: ['push', 'toast', 'inapp'], category: 'price' },
  'target-profit-krw':  { channels: ['push', 'toast', 'inapp'], category: 'price' },
  // buy-zone: 사용자가 buyBelow를 명시 설정한 트리거이므로 push 허용 (자산 변동 트리거에 준함)
  'buy-zone':           { channels: ['push', 'toast', 'inapp'], category: 'price' },

  // ─── 가격 근접 — 토스트 + 인앱 (push 없음)
  'stoploss-near':      { channels: ['toast', 'inapp'],         category: 'price' },
  'target-near':        { channels: ['toast', 'inapp'],         category: 'price' },

  // ─── 시장/포트폴리오
  'portfolio-down':     { channels: ['push', 'toast', 'inapp'], category: 'portfolio' },
  'daily-plunge':       { channels: ['push', 'toast', 'inapp'], category: 'market' },
  'daily-surge':        { channels: ['toast', 'inapp'],         category: 'market' },
  'zscore-extreme':     { channels: ['toast', 'inapp'],         category: 'market' },
  'below-avgcost':      { channels: ['inapp'],                  category: 'portfolio' },

  // ─── 기술지표·52주 — 인앱 한정 (자문업 회피 + 알림 피로 방지)
  'near-52w-low':       { channels: ['inapp'],                  category: 'indicator' },
  'near-52w-high':      { channels: ['inapp'],                  category: 'indicator' },
  'golden-cross':       { channels: ['inapp'],                  category: 'indicator' },
  'death-cross':        { channels: ['inapp'],                  category: 'indicator' },
  'rsi-oversold':       { channels: ['inapp'],                  category: 'indicator' },
  'rsi-overbought':     { channels: ['inapp'],                  category: 'indicator' },
  'bb-lower':           { channels: ['inapp'],                  category: 'indicator' },
  'bb-upper':           { channels: ['inapp'],                  category: 'indicator' },
  'macd-bull':          { channels: ['inapp'],                  category: 'indicator' },
  'macd-bear':          { channels: ['inapp'],                  category: 'indicator' },

  // ─── 복합 신호 — 토스트 + 인앱
  'composite-strong-bounce':    { channels: ['toast', 'inapp'], category: 'indicator' },
  'composite-strong-uptrend':   { channels: ['toast', 'inapp'], category: 'indicator' },
  'composite-overheated':       { channels: ['toast', 'inapp'], category: 'indicator' },
  'composite-strong-downtrend': { channels: ['toast', 'inapp'], category: 'indicator' },
  'composite-squeeze':          { channels: ['toast', 'inapp'], category: 'indicator' },
};

/** 정책에 없는 condition — 보수적으로 inapp만 (푸시 절대 X, 안전 디폴트) */
export const DEFAULT_ALERT_POLICY: AlertPolicyEntry = {
  channels: ['inapp'],
  category: 'indicator',
};

/**
 * 특정 alertType이 push 채널을 허용하는지 여부.
 * 정책에 없는 type은 false (안전 디폴트).
 */
export function isPushAllowed(alertType: string): boolean {
  const policy = ALERT_POLICY[alertType];
  return policy?.channels.includes('push') ?? false;
}

/**
 * 특정 alertType의 카테고리 — Settings ON/OFF 단위.
 * 정책에 없는 type은 'indicator'로 분류 (보수).
 */
export function getAlertCategory(alertType: string): AlertCategory {
  return ALERT_POLICY[alertType]?.category ?? 'indicator';
}

// ─── 신규 유저 ramp-up 정책 (정책 §3.1) ─────────────────────────────────────
//
// 푸시 알림 폭주로 인한 즉시 OFF를 방지. 가입 직후 7일은 가장 긴급한
// 손절·포트폴리오 알림만 푸시하고, 8일째부터 전체 isPushAllowed 적용.

export const PUSH_RAMP_UP_DAYS = 7;

/** ramp-up 기간 동안 허용되는 alert 타입 (가장 긴급한 것만) */
const RAMP_UP_ALLOWED: ReadonlySet<string> = new Set([
  'stoploss-hit',
  'stoploss-price',  // cron alias
  'stoploss-pct',
  'portfolio-down',
]);

/**
 * 가입 N일 경과 유저에게 이 alertType이 푸시 가능한가.
 * createdAt: push_subscriptions.created_at (ISO string)
 *
 * - 7일 미만: stoploss + portfolio-down 만
 * - 7일 이상: isPushAllowed 결과 그대로
 *
 * createdAt null/invalid 시 ramp-up 적용 안 함 (legacy 구독자는 전체 허용).
 */
export function isPushAllowedForUser(alertType: string, createdAt?: string | null): boolean {
  if (!isPushAllowed(alertType)) return false;
  if (!createdAt) return true; // 가입일 미상 → 전체 허용 (legacy)
  const ageMs = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(ageMs) || ageMs < 0) return true;
  const ageDays = ageMs / (24 * 3600 * 1000);
  if (ageDays >= PUSH_RAMP_UP_DAYS) return true;
  return RAMP_UP_ALLOWED.has(alertType);
}
