/**
 * 투어 챕터 완료 추적 — localStorage. CoachMark(완료 시 마킹) ↔ TourChapterSheet(뱃지 표시) 공유.
 * 순수 UI 진행상태(§6 무관). 기기 로컬.
 */
const KEY = 'solb_tour_chapters_done';

export function getDoneChapters(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function markChapterDone(chapter: string): void {
  if (typeof window === 'undefined' || !chapter) return;
  try {
    const done = new Set(getDoneChapters());
    done.add(chapter);
    localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch { /* ignore */ }
}
