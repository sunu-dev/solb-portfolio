import type { SupabaseClient } from '@supabase/supabase-js';
import { withDeadline } from './withDeadline';
import { historyAnswer, parseHistoryTurn, type HistoryTurn } from './conversationHistory';
import type { ConversationAnswer } from './joobiConversation';
export interface HistoryAdapter {
  read(before?: number, context?: string): Promise<{ rows: HistoryTurn[]; cursor: number | null }>;
  write(context: string, answer: ConversationAnswer): Promise<boolean>;
  remove(id?: string): Promise<void>;
}
export function cloudHistory(client: SupabaseClient, owner: string): HistoryAdapter {
  async function run<T>(operation: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
    const controller = new AbortController();
    try {
      const { data: { session } } = await withDeadline(client.auth.getSession(), 6000);
      if (!session || session.user.id !== owner) throw new Error('history_owner_changed');
      return await withDeadline(Promise.resolve(operation(controller.signal)), 8000);
    } finally { controller.abort(); }
  }
  return {
    async read(before, context) {
      const limit = context ? 20 : 50;
      const { data, error } = await run(signal => {
        let q = client.from('joobi_conversation_history').select('id,seq,context,answer,created_at').eq('user_id', owner).is('deleted_at', null).order('seq', { ascending: false }).limit(limit);
        if (before !== undefined) q = q.lt('seq', before);
        if (context) q = q.eq('context', context);
        return q.abortSignal(signal);
      });
      if (error || !data) throw new Error('history_read_failed');
      const rows = data.map(parseHistoryTurn);
      if (rows.some(row => !row)) throw new Error('history_invalid_data');
      return { rows: rows as HistoryTurn[], cursor: data.length === limit ? data.at(-1)!.seq as number : null };
    },
    async write(context, answer) {
      const payload = historyAnswer(answer);
      if (new TextEncoder().encode(JSON.stringify(payload)).length > 32000) throw new Error('history_too_large');
      const { data, error } = await run(signal => client.rpc('save_joobi_conversation', { p_owner: owner, p_id: answer.historyId, p_context: context, p_answer: payload }).abortSignal(signal));
      if (error || typeof data !== 'boolean') throw new Error('history_write_failed');
      return data;
    },
    async remove(id) {
      const { error } = await run(signal => client.rpc('delete_joobi_conversations', { p_owner: owner, p_id: id ?? null }).abortSignal(signal));
      if (error) throw new Error('history_delete_failed');
    },
  };
}
