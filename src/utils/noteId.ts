/**
 * 노트 ID/날짜 키 생성 — 충돌 방지 (정합성 결함 M2-data 수정).
 *
 * 기존 결함:
 * - EditStockModal: ISO + '_' + Date.now() → 같은 ms에 다중 생성 시 충돌
 * - InvestmentNotes: ISO + '_' + 모듈 카운터 → reload 후 0으로 reset, 충돌 가능
 *
 * 해결: ISO_random — 첫 부분이 ISO라 기존 파싱(.split('_')[0])과 호환.
 * crypto.randomUUID 사용 시 cross-module 충돌도 방지.
 */
export function createNoteDate(): string {
  const iso = new Date().toISOString();
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return iso + '_' + crypto.randomUUID().slice(0, 8);
  }
  // Fallback (구형 브라우저)
  return iso + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}
