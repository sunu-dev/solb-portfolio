'use client';

import { useEffect, useRef, useState } from 'react';
import type { MarketGuideId } from '@/config/marketGuides';
import { emptyNotebook, GUIDE_NOTEBOOK_KEY, parseGuideNotebook, updateGuideEntry, type GuideEntry } from '@/lib/guideNotebook';

const CHANGE_EVENT = 'joobi-guide-notebook-changed';

export function useGuideNotebook() {
  const [notebook, setNotebook] = useState(emptyNotebook);
  const [ready, setReady] = useState(false);
  const blocked = useRef(false);
  useEffect(() => {
    const restore = () => {
      if (blocked.current) return;
      try { setNotebook(parseGuideNotebook(localStorage.getItem(GUIDE_NOTEBOOK_KEY))); }
      catch { setNotebook(emptyNotebook()); }
      setReady(true);
    };
    const frame = requestAnimationFrame(restore);
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === GUIDE_NOTEBOOK_KEY) restore(); };
    const clear = () => { blocked.current = true; setNotebook(emptyNotebook()); setReady(false); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, restore);
    window.addEventListener('solb-user-storage-clearing', clear);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANGE_EVENT, restore);
      window.removeEventListener('solb-user-storage-clearing', clear);
    };
  }, []);

  const save = (id: MarketGuideId, patch: Partial<GuideEntry>) => {
    if (!ready || blocked.current) return false;
    try {
      // Read again so saving one lesson cannot overwrite another tab's newer lesson.
      const next = updateGuideEntry(parseGuideNotebook(localStorage.getItem(GUIDE_NOTEBOOK_KEY)), id, patch);
      localStorage.setItem(GUIDE_NOTEBOOK_KEY, JSON.stringify(next));
      setNotebook(next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return true;
    } catch { return false; }
  };
  return { notebook, ready, save };
}
