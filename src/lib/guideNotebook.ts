import type { MarketGuideId } from '@/config/marketGuides';

export const GUIDE_NOTEBOOK_KEY = 'solb_market_guide_v1';
export const GUIDE_NOTE_LIMIT = 900;
export const GUIDE_IDS: MarketGuideId[] = ['rates', 'inflation', 'currency', 'earnings'];
export interface GuideEntry {
  explanation: string;
  savedAt?: number;
  checkCorrect?: boolean;
  checkedAt?: number;
}
export interface GuideNotebook { version: 1; entries: Partial<Record<MarketGuideId, GuideEntry>> }
export const emptyNotebook = (): GuideNotebook => ({ version: 1, entries: {} });
export const isGuideId = (value: unknown): value is MarketGuideId => typeof value === 'string' && GUIDE_IDS.includes(value as MarketGuideId);
const isTimestamp = (value: unknown): value is number => typeof value === 'number' && value > 0 && Number.isFinite(new Date(value).getTime());

/** Only the four supported topics and bounded text survive a storage restore. */
export function parseGuideNotebook(raw: string | null): GuideNotebook {
  if (!raw) return emptyNotebook();
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !value.entries || typeof value.entries !== 'object') return emptyNotebook();
    const notebook = emptyNotebook();
    for (const id of GUIDE_IDS) {
      if (!Object.hasOwn(value.entries, id)) continue;
      const entry = value.entries[id];
      if (!entry || typeof entry !== 'object') continue;
      const clean: GuideEntry = { explanation: typeof entry.explanation === 'string' ? entry.explanation.slice(0, GUIDE_NOTE_LIMIT) : '' };
      if (isTimestamp(entry.savedAt) && clean.explanation.trim()) clean.savedAt = entry.savedAt;
      if (typeof entry.checkCorrect === 'boolean' && isTimestamp(entry.checkedAt)) {
        clean.checkCorrect = entry.checkCorrect;
        clean.checkedAt = entry.checkedAt;
      }
      if (clean.savedAt || clean.checkedAt) notebook.entries[id] = clean;
    }
    return notebook;
  } catch { return emptyNotebook(); }
}

export function updateGuideEntry(notebook: GuideNotebook, id: MarketGuideId, patch: Partial<GuideEntry>): GuideNotebook {
  return parseGuideNotebook(JSON.stringify({ version: 1, entries: {
    ...notebook.entries,
    [id]: { explanation: '', ...notebook.entries[id], ...patch },
  } }));
}
