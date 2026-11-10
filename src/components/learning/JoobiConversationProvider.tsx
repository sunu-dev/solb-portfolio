'use client';
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode, type SetStateAction } from 'react';
import { createConversationStore, EMPTY_CONVERSATION, type ConversationAnswer, type ConversationStore } from '@/lib/joobiConversation';

const Context = createContext<ConversationStore | null>(null);
export default function JoobiConversationProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createConversationStore);
  useEffect(() => {
    const clear = () => store.clear();
    window.addEventListener('solb-user-storage-clearing', clear);
    return () => { window.removeEventListener('solb-user-storage-clearing', clear); store.clear(); };
  }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

export function useJoobiConversation(key: string) {
  const store = useContext(Context);
  if (!store) throw new Error('JoobiConversationProvider is required');
  const getSnapshot = useCallback(() => store.get(key), [store, key]);
  const conversation = useSyncExternalStore(store.subscribe, getSnapshot, () => EMPTY_CONVERSATION);
  const setQuestion = useCallback((value: SetStateAction<string>) => {
    store.update(key, previous => ({ ...previous, question: typeof value === 'function' ? value(previous.question) : value }));
  }, [store, key]);
  const setAnswers = useCallback((value: SetStateAction<ConversationAnswer[]>) => {
    store.update(key, previous => ({ ...previous, answers: typeof value === 'function' ? value(previous.answers) : value }));
  }, [store, key]);
  const clear = useCallback(() => store.clear(key), [store, key]);
  const copyDraftTo = useCallback((target: string) => store.copyDraft(key, target), [store, key]);
  return { ...conversation, setQuestion, setAnswers, clear, copyDraftTo };
}
