'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { DICTIONARY_PREFIX, parseDictionary, saveDictionaryEntry, type DictionaryEntry } from '@/lib/personalDictionary';
import { readCloudDictionary, writeCloudDictionary, deleteCloudDictionary } from '@/lib/personalDictionaryCloud';
import DictionaryOverlay from './DictionaryOverlay';
import JoobiConversationProvider from './JoobiConversationProvider';
import { withDeadline } from '@/lib/withDeadline';
const EVENT = 'joobi-dictionary-changed';
interface DictionaryContext { owner: string; ready: boolean; entries: DictionaryEntry[]; error: string; reload: () => void; save: (entry: DictionaryEntry) => Promise<boolean>; remove: (id: string) => Promise<boolean> }
const Context = createContext<DictionaryContext>({ owner: 'guest', ready: false, entries: [], error: '', reload: () => {}, save: async () => false, remove: async () => false });
export const usePersonalDictionary = () => useContext(Context);
/** Mounted behind the account boundary. Account data never falls back to a guest/local write. */
export default function PersonalLearningProvider({ owner, children }: { owner: string; children: ReactNode }) {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const allowed = useRef(false), revision = useRef(0), reload = useRef<() => void>(() => {});
  const key = DICTIONARY_PREFIX + owner;
  useEffect(() => {
    allowed.current = true;
    const restore = async () => {
      if (!allowed.current) return;
      const version = ++revision.current;
      try {
        const next = owner === 'guest' ? parseDictionary(localStorage.getItem(key))
          : await readCloudDictionary((await import('@/lib/supabase')).supabase, owner);
        if (allowed.current && version === revision.current) { setEntries(next); setReady(true); setError(''); }
      } catch { if (allowed.current && version === revision.current) { setReady(false); setError('저장한 단어를 불러오지 못했어요. 기본 용어는 계속 읽을 수 있어요.'); } }
    };
    const clear = () => { allowed.current = false; revision.current++; setEntries([]); setReady(false); setError(''); };
    const storage = (event: StorageEvent) => { if (owner === 'guest' && (event.key === key || event.key === null)) void restore(); };
    reload.current = () => { void restore(); };
    const frame = requestAnimationFrame(() => { void restore(); });
    window.addEventListener(EVENT, reload.current); window.addEventListener('storage', storage); window.addEventListener('focus', reload.current); window.addEventListener('solb-user-storage-clearing', clear);
    const callback = reload.current;
    const invalidate = () => { allowed.current = false; revision.current++; };
    return () => { invalidate(); cancelAnimationFrame(frame); window.removeEventListener(EVENT, callback); window.removeEventListener('storage', storage); window.removeEventListener('focus', callback); window.removeEventListener('solb-user-storage-clearing', clear); };
  }, [key, owner]);
  const mutate = async (entry: DictionaryEntry, remove = false) => {
    if (!ready || !allowed.current) return false;
    try {
      if (owner === 'guest') {
        const current = parseDictionary(localStorage.getItem(key));
        const next = remove ? current.filter(item => item.id !== entry.id) : saveDictionaryEntry(current, entry);
        localStorage.setItem(key, JSON.stringify(next)); setEntries(next);
      } else {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await withDeadline(supabase.auth.getSession(), 6000);
        if (!allowed.current || session?.user.id !== owner) return false;
        const saved = remove ? await deleteCloudDictionary(supabase, owner, entry) : await writeCloudDictionary(supabase, owner, entry);
        if (!allowed.current) return false;
        if (!saved) { reload.current(); return false; }
        // Publish the authoritative row versions before resolving a successful write.
        const next = await readCloudDictionary(supabase, owner);
        if (!allowed.current) return false;
        revision.current++; setEntries(next); setError('');
      }
      window.dispatchEvent(new Event(EVENT));
      return true;
    } catch { return false; }
  };
  return <Context.Provider value={{ owner, ready, entries, error, reload: () => reload.current(), save: entry => mutate(entry), remove: async id => { const entry = entries.find(item => item.id === id); return entry ? mutate(entry, true) : false; } }}><JoobiConversationProvider key={owner}>{children}<DictionaryOverlay /></JoobiConversationProvider></Context.Provider>;
}
