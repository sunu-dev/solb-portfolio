import type { HistoryAdapter } from './conversationHistoryCloud';
import type { HistoryTurn } from './conversationHistory';
import type { ConversationAnswer, ConversationStore } from './joobiConversation';
export interface HistoryState { rows: HistoryTurn[]; loading: boolean; cursor: number | null; error: string; pending: number; saving: boolean }
export const EMPTY_HISTORY: HistoryState = { rows: [], loading: false, cursor: null, error: '', pending: 0, saving: false };
/** Account-scoped. Queued writes never cross an account change, and restored rows are never re-saved. */
export function createHistoryStore(adapter: HistoryAdapter, conversations: ConversationStore) {
  let state = EMPTY_HISTORY, alive = true, revision = 0;
  let tail: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>(), pending = new Map<string, { context: string; answer: ConversationAnswer }>();
  const restored = new Map<string, Promise<void>>();
  const publish = (patch: Partial<HistoryState>) => { if (alive) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const enqueue = <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    const next = tail.then(() => alive ? fn() : undefined);
    tail = next.catch(() => {}); return next;
  };
  const savePending = async () => {
    publish({ saving: true });
    try {
      for (const [id, item] of pending) {
        if (!alive) return;
        const saved = await adapter.write(item.context, item.answer);
        if (!alive) return;
        pending.delete(id);
        if (!saved) conversations.removeStored(id); // A retry cannot revive a deleted record.
      }
      publish({ error: '' });
    } catch { publish({ error: '대화를 저장하지 못했어요. 이 창을 닫기 전에 저장을 다시 시도해 주세요. 보관 한도는 1,000개예요.' }); }
    finally { publish({ saving: false, pending: pending.size }); }
  };
  const api = {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    save(context: string, answer: ConversationAnswer) {
      if (!alive || !answer.historyId) return;
      pending.set(answer.historyId, { context, answer }); publish({ pending: pending.size });
      void enqueue(savePending);
    },
    retry() { return enqueue(savePending); },
    async restore(context: string) {
      if (!alive) return;
      if (restored.has(context)) return restored.get(context);
      const version = revision;
      const task = (async () => {
        try {
          const { rows } = await adapter.read(undefined, context);
          if (alive && version === revision) conversations.restore(context, rows.map(row => row.answer).reverse());
        } catch {
          restored.delete(context);
          if (alive && version === revision) publish({ error: '이전 대화를 불러오지 못했어요. 이전 대화에서 다시 확인해 주세요.' });
        }
      })();
      restored.set(context, task); return task;
    },
    async load(more = false) {
      if (!alive || state.loading || (more && state.cursor === null)) return;
      const version = revision;
      publish({ loading: true });
      try {
        const result = await adapter.read(more ? state.cursor! : undefined);
        if (!alive || version !== revision) return;
        const rows = more ? [...state.rows, ...result.rows] : result.rows;
        publish({ rows: [...new Map(rows.map(row => [row.id, row])).values()], cursor: result.cursor, error: pending.size ? state.error : '' });
      } catch { if (alive && version === revision) publish({ error: '대화 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }); }
      finally { publish({ loading: false }); }
    },
    async remove(id?: string) {
      return enqueue(async () => {
        try {
          await adapter.remove(id);
          if (!alive) return false;
          revision++; restored.clear();
          if (id) pending.delete(id); else pending.clear();
          conversations.removeStored(id);
          publish({ rows: id ? state.rows.filter(row => row.id !== id) : [], cursor: id ? state.cursor : null, pending: pending.size, error: '' });
          return true;
        } catch { publish({ error: '삭제하지 못했어요. 기록은 그대로 남아 있어요. 다시 시도해 주세요.' }); return false; }
      });
    },
    dispose() { alive = false; revision++; pending.clear(); listeners.clear(); },
  };
  return api;
}
export type HistoryStore = ReturnType<typeof createHistoryStore>;
