import { GUIDE_NOTE_LIMIT, GUIDE_NOTEBOOK_KEY, type GuideEntry } from './guideNotebook';
import type { MarketGuideId } from '@/config/marketGuides';

export interface GuideDraft { text: string; baseExplanation: string }
interface DraftSnapshot { epoch: number; entries: Partial<Record<MarketGuideId, GuideDraft>> }

/** Page-memory only: menu unmounts keep drafts, a reload does not. */
export function createGuideDraftSession() {
  let snapshot: DraftSnapshot = { epoch: 0, entries: {} };
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update(id: MarketGuideId, draft: GuideDraft | undefined, epoch: number) {
      // A callback retained by an old account cannot recreate its text after clearing.
      if (epoch !== snapshot.epoch) return false;
      const entries = { ...snapshot.entries };
      if (draft) entries[id] = { text: draft.text.slice(0, GUIDE_NOTE_LIMIT), baseExplanation: draft.baseExplanation.slice(0, GUIDE_NOTE_LIMIT) };
      else delete entries[id];
      snapshot = { ...snapshot, entries };
      notify();
      return true;
    },
    clear() { snapshot = { epoch: snapshot.epoch + 1, entries: {} }; notify(); },
  };
}

export const guideDraftSession = createGuideDraftSession();
let boundWindow: Window | undefined;
const clear = () => guideDraftSession.clear();
const onStorage = (event: StorageEvent) => {
  if (event.key === null || (event.key === GUIDE_NOTEBOOK_KEY && event.newValue === null)) clear();
};

/** Remains attached while the report is unmounted, so logout in another menu clears drafts. */
export function bindGuideDraftBoundary() {
  if (typeof window === 'undefined' || boundWindow === window) return;
  boundWindow?.removeEventListener('solb-user-storage-clearing', clear);
  boundWindow?.removeEventListener('storage', onStorage);
  boundWindow = window;
  window.addEventListener('solb-user-storage-clearing', clear);
  window.addEventListener('storage', onStorage);
}

export function getGuideDraftState(entry: GuideEntry | undefined, local: GuideDraft | undefined) {
  const saved = entry?.explanation ?? '';
  const edited = !!local && local.text !== local.baseExplanation;
  const text = edited ? local.text : saved;
  const dirty = text.trim() !== saved.trim();
  return { text, edited, dirty, conflict: edited && dirty && saved !== local.baseExplanation };
}
