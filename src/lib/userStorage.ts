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
] as const;

/** 모든 사용자 데이터 키 정리 */
export function clearUserStorage(): void {
  for (const key of USER_STORAGE_KEYS) {
    try { localStorage.removeItem(key); } catch { /* quota / privacy mode 등 */ }
  }
}
