/**
 * 알림 사용자 설정 (Settings → 알림 토글)
 *
 * 정책 SSOT: docs/NOTIFICATION_POLICY.md §5
 *
 * - 카테고리별 ON/OFF (price/indicator/market/portfolio/digest)
 * - 무음 시간대 (KST 22:00 ~ 07:00)
 *
 * 저장: localStorage. 비로그인 유저도 작동.
 */

import type { AlertCategory } from '@/config/alertPolicy';

const STORAGE_KEY = 'solb_alert_prefs';

export interface AlertPrefs {
  categories: Record<AlertCategory, boolean>;
  /** KST 22:00 ~ 07:00 동안 토스트·푸시 무음 */
  quietHours: boolean;
}

/**
 * 디폴트 — 모두 ON (사용자 발견성 우선).
 * 시끄러우면 사용자가 명시 OFF.
 */
const DEFAULT_PREFS: AlertPrefs = {
  categories: {
    price: true,
    portfolio: true,
    market: true,
    indicator: true,
    celebrate: true,
    digest: true,
  },
  quietHours: false,
};

export function getAlertPrefs(): AlertPrefs {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_PREFS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AlertPrefs>;
    return {
      categories: { ...DEFAULT_PREFS.categories, ...(parsed.categories || {}) },
      quietHours: parsed.quietHours ?? DEFAULT_PREFS.quietHours,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setAlertPrefs(prefs: Partial<AlertPrefs>) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const current = getAlertPrefs();
  const merged: AlertPrefs = {
    categories: { ...current.categories, ...(prefs.categories || {}) },
    quietHours: prefs.quietHours ?? current.quietHours,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    // 다른 탭/컴포넌트에서 변경 감지
    window.dispatchEvent(new CustomEvent('solb-alert-prefs-changed'));
  } catch { /* silent */ }
}

/** 특정 카테고리가 사용자에 의해 활성화됐는지 */
export function isCategoryEnabled(category: AlertCategory): boolean {
  return getAlertPrefs().categories[category] ?? true;
}

/** 현재 무음 시간대인지 (KST 22:00 ~ 07:00) */
export function isQuietHours(): boolean {
  if (!getAlertPrefs().quietHours) return false;
  const kstHour = new Date(Date.now() + 9 * 3600_000).getUTCHours();
  return kstHour >= 22 || kstHour < 7;
}

/**
 * 알림이 사용자 설정에 의해 노출 가능한지 통합 체크.
 * 토스트·푸시 라우터에서 호출. 사이드바는 별도 (학습 억제만 적용).
 */
export function isAlertAllowedByPrefs(category: AlertCategory): boolean {
  if (!isCategoryEnabled(category)) return false;
  if (isQuietHours()) return false;
  return true;
}

export const CATEGORY_LABELS: Record<AlertCategory, { label: string; desc: string; emoji: string }> = {
  price:     { label: '가격 도달',   desc: '목표가·손절가·관심가 도달',         emoji: '🎯' },
  portfolio: { label: '포트폴리오',  desc: '평단 하회·전체 -10% 손실',         emoji: '📊' },
  market:    { label: '시장 변동',   desc: '일간 ±5% 급등락·이례적 변동',       emoji: '📈' },
  indicator: { label: '기술 지표',   desc: 'RSI·MACD·볼린저·52주·이동평균',     emoji: '🔍' },
  celebrate: { label: '달성·배지',   desc: '목표 달성·연속 출석',                 emoji: '🎉' },
  digest:    { label: '정기 알림',   desc: '모닝브리프·월말 D-3 리마인더',        emoji: '📬' },
};
