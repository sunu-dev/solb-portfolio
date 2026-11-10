import type { AiResultMeta } from './aiResultMeta';
import type { AssistantEvidencePacket, AssistantIndustry, AssistantInsight, AssistantPeriod } from './assistantEvidence';
import type { AssistantSessionReference } from './assistantSession';

export interface ConversationAnswer {
  qualityReceipt?: string;
  turnId: number; question: string; symbol: string; market?: 'kr' | 'us'; period?: AssistantPeriod; currentStatus: string; keyAdvice: string[];
  conclusion: { desc: string }; _meta?: AiResultMeta; assistantEvidence?: AssistantEvidencePacket;
  assistantInsights?: AssistantInsight[]; followUps?: string[];
  sessionReference?: AssistantSessionReference;
  industryFocus?: AssistantIndustry[];
}
export interface Conversation { question: string; answers: ConversationAnswer[] }
export const EMPTY_CONVERSATION: Conversation = { question: '', answers: [] };
export const CONVERSATION_TURN_LIMIT = 20;

/** Owned by one keyed account provider, never a server singleton or durable browser storage. */
export function createConversationStore() {
  const threads = new Map<string, Conversation>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  return {
    get: (key: string) => threads.get(key) ?? EMPTY_CONVERSATION,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    copyDraft(from: string, to: string) {
      const draft = threads.get(from)?.question ?? '';
      const target = threads.get(to) ?? EMPTY_CONVERSATION;
      if (from === to || !draft || target.question) return;
      threads.set(to, { ...target, question: draft }); emit();
    },
    update(key: string, change: (previous: Conversation) => Conversation) {
      const next = change(threads.get(key) ?? EMPTY_CONVERSATION);
      threads.set(key, { question: next.question.slice(0, 600), answers: next.answers.slice(-CONVERSATION_TURN_LIMIT) });
      emit();
    },
    clear(key?: string) { if (key === undefined) threads.clear(); else threads.delete(key); emit(); },
  };
}
export type ConversationStore = ReturnType<typeof createConversationStore>;
