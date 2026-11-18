'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode, type SetStateAction } from 'react';
import { createConversationStore, EMPTY_CONVERSATION, type ConversationAnswer, type ConversationStore } from '@/lib/joobiConversation';
import { createHistoryStore, EMPTY_HISTORY, type HistoryStore } from '@/lib/conversationHistoryStore';
import { cloudHistory } from '@/lib/conversationHistoryCloud';

const Context = createContext<{ store: ConversationStore; archive: HistoryStore | null } | null>(null);
export default function JoobiConversationProvider({ owner = 'guest', children }: { owner?: string; children: ReactNode }) {
  const [store] = useState(createConversationStore);
  const [archive, setArchive] = useState<HistoryStore | null>(null);
  useEffect(() => {
    const next = owner === 'guest' ? null : createHistoryStore({
      read: async (...args) => cloudHistory((await import('@/lib/supabase')).supabase, owner).read(...args),
      write: async (...args) => cloudHistory((await import('@/lib/supabase')).supabase, owner).write(...args),
      remove: async (...args) => cloudHistory((await import('@/lib/supabase')).supabase, owner).remove(...args),
    }, store);
    const frame = requestAnimationFrame(() => setArchive(next));
    const clear = () => { next?.dispose(); store.clear(); setArchive(null); };
    window.addEventListener('solb-user-storage-clearing', clear);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('solb-user-storage-clearing', clear); next?.dispose(); store.clear(); };
  }, [store, owner]);
  const value = useMemo(() => ({ store, archive }), [store, archive]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
const noopSubscribe = () => () => {};
const emptyHistory = () => EMPTY_HISTORY;
export function useConversationHistory() {
  const archive = useContext(Context)?.archive ?? null;
  const state = useSyncExternalStore(archive?.subscribe ?? noopSubscribe, archive?.getSnapshot ?? emptyHistory, emptyHistory);
  return { archive, ...state };
}
export function useJoobiConversation(key: string) {
  const context = useContext(Context);
  if (!context) throw new Error('JoobiConversationProvider is required');
  const { store, archive } = context;
  const getSnapshot = useCallback(() => store.get(key), [store, key]);
  const conversation = useSyncExternalStore(store.subscribe, getSnapshot, () => EMPTY_CONVERSATION);
  useEffect(() => { void archive?.restore(key); }, [archive, key]);
  const setQuestion = useCallback((value: SetStateAction<string>) => {
    store.update(key, previous => ({ ...previous, question: typeof value === 'function' ? value(previous.question) : value }));
  }, [store, key]);
  const setAnswers = useCallback((value: SetStateAction<ConversationAnswer[]>) => {
    store.update(key, previous => {
      const next = typeof value === 'function' ? value(previous.answers) : value;
      const existing = new Set(previous.answers.map(a => a.historyId ?? a.turnId));
      const answers = next.map(a => {
        if (existing.has(a.historyId ?? a.turnId)) return a;
        const stamped = { ...a, historyId: crypto.randomUUID(), createdAt: new Date().toISOString() };
        archive?.save(key, stamped);
        return stamped;
      });
      return { ...previous, answers };
    });
  }, [store, archive, key]);
  const clear = useCallback(() => store.clear(key), [store, key]);
  const copyDraftTo = useCallback((target: string) => store.copyDraft(key, target), [store, key]);
  return { ...conversation, setQuestion, setAnswers, clear, copyDraftTo };
}
