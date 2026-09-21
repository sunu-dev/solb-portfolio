import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadChapters, saveChapter, subscribeChapters, type ArchivedChapter } from '@/utils/chapterArchive';

const values = new Map<string, string>();
const chapter: ArchivedChapter = { chapterId: '2026-08', monthLabel: '8월', keyword: null, totalPctReturn: 6, totalAbsReturn: 600, championSymbol: null, championPctReturn: null, notesCount: 0, memoStreak: 0, bestDayDate: null, bestDayPctChange: null, archivedAt: '2026-09-01' };
beforeEach(() => {
  values.clear();
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

describe('chapter shelf refresh', () => {
  it('notifies an already mounted shelf after a chapter has been persisted', () => {
    const seen: ArchivedChapter[][] = [];
    const stop = subscribeChapters(() => seen.push(loadChapters()));
    saveChapter(chapter);
    expect(seen).toEqual([[chapter]]);
    stop();
    saveChapter({ ...chapter, chapterId: '2026-07' });
    expect(seen).toHaveLength(1);
  });

  it('responds to cross-tab archive updates and clearing, not unrelated storage', () => {
    const changed = vi.fn();
    const stop = subscribeChapters(changed);
    for (const key of ['other-key', 'solb_chapter_archive', null]) {
      const event = new Event('storage');
      Object.defineProperty(event, 'key', { value: key });
      window.dispatchEvent(event);
    }
    expect(changed).toHaveBeenCalledTimes(2);
    stop();
  });

  it('does not announce a chapter when storage fails', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('quota'); } });
    const changed = vi.fn();
    const stop = subscribeChapters(changed);
    saveChapter(chapter);
    expect(changed).not.toHaveBeenCalled();
    stop();
  });
});
