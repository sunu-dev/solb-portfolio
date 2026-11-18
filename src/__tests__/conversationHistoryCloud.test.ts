import { expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudHistory } from '@/lib/conversationHistoryCloud';
function client(user = 'alice') {
  const q = { abortSignal: vi.fn(), then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: true, error: null }).then(resolve) };
  q.abortSignal.mockReturnValue(q);
  const rpc = vi.fn().mockReturnValue(q);
  return { rpc, db: { rpc, auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: user } } } }) } } as unknown as SupabaseClient };
}
it('rejects a changed session before any mutation', async () => {
  const { db, rpc } = client('bob');
  await expect(cloudHistory(db, 'alice').remove()).rejects.toThrow('history_owner_changed');
  expect(rpc).not.toHaveBeenCalled();
});
it('sends the expected owner for the server to reject a session change during a request', async () => {
  const { db, rpc } = client();
  await cloudHistory(db, 'alice').remove();
  expect(rpc).toHaveBeenCalledWith('delete_joobi_conversations', { p_owner:'alice', p_id:null });
});
