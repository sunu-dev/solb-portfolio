/**
 * 사용자 별 로컬 데이터 정리 헬퍼.
 *
 * 정합성 결함 C2-data 대응:
 * 계정 전환(A 로그인 → B 로그인) 시 A의 localStorage 데이터가 잔존해
 * usePortfolioSync 디바운스 effect가 빈 데이터로 B의 DB를 덮어쓰는 위험.
 *
 * 모든 SOLB 사용자별 키를 한 곳에서 관리. 신규 키 추가 시 USER_STORAGE_KEYS에 등록.
 */

/** 사용자별 데이터를 담는 모든 localStorage 키 (계정 전환/로그아웃 시 정리 대상) */
export const USER_STORAGE_KEYS = [
  'solb-portfolio-storage', // Zustand persist (stocks, dailySnapshots, investorType, customEvents)
  'solb_quote_cache',
  'solb_macro_cache',
  'solb_streak',
  'solb_onboarded',
  'solb_ai_usage',
  'solb_briefing_seen',
  'solb_recent_searches',
  // 알림 학습/스누즈 (사용자별)
  'solb_alert_snoozes',
  'solb_alert_prefs',
  'solb_alert_dismissals',
  // 챕터/투어 (사용자별 진행 상태)
  'solb_chapter_archive',
  'solb_chapter_keyword_prompted',
  'solb_tour_done',
  'solb_tour_pending',
  // 초대 캐시 (사용자별)
  'solb_invite_cache',
] as const;

/**
 * 사용자별 동적 키 prefix (런타임 생성, 사용자/챕터/날짜별로 키 이름이 달라짐)
 * 예: `solb_chapter_keyword_2026-W20` 같은 주차/사용자별 키
 */
export const USER_STORAGE_KEY_PREFIXES = [
  'solb_chapter_keyword_',
] as const;

/** 모든 사용자 데이터 키 정리 */
export function clearUserStorage(): void {
  // 1. 고정 키 정리
  for (const key of USER_STORAGE_KEYS) {
    try { localStorage.removeItem(key); } catch { /* quota / privacy mode 등 */ }
  }
  // 2. prefix 매칭 동적 키 정리
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (USER_STORAGE_KEY_PREFIXES.some(p => key.startsWith(p))) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
  } catch { /* localStorage 자체가 차단된 환경 등 */ }
  // 3. sessionStorage의 사용자별 키 (consent 흐름 중간 상태)
  try {
    sessionStorage.removeItem('solb_consent_pending');
  } catch { /* ignore */ }

  // 4. 사용자별 candle 캐시 — 동적 키 (candle_AAPL, candle_TSLA 등)
  try {
    const candleKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('candle_')) candleKeys.push(key);
    }
    for (const key of candleKeys) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}
