import { describe, expect, it, vi } from 'vitest';
import { createConversationStore, type ConversationAnswer } from '@/lib/joobiConversation';
import { createHistoryStore } from '@/lib/conversationHistoryStore';
import { historyAnswer, historyDayLabel, parseHistoryTurn, type HistoryTurn } from '@/lib/conversationHistory';
import type { HistoryAdapter } from '@/lib/conversationHistoryCloud';
const id = crypto.randomUUID();
const answer: ConversationAnswer = { historyId: id, createdAt: '2026-11-18T01:00:00Z', turnId: 1, question: 'ETF가 뭐야?', symbol: 'GENERAL', currentStatus: '주식처럼 거래하는 상품이에요.', keyAdvice: [], conclusion: { desc: '' } };
const row: HistoryTurn = { id, seq: 1, context: 'GENERAL:kr:1d', createdAt: answer.createdAt!, answer };
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { resolve, promise }; };
function fixture() {
  const adapter: HistoryAdapter = { read: vi.fn().mockResolvedValue({ rows: [row], cursor: null }), write: vi.fn().mockResolvedValue(true), remove: vi.fn().mockResolvedValue(undefined) };
  const conversations = createConversationStore(), history = createHistoryStore(adapter, conversations);
  return { adapter, conversations, history };
}
describe('personal history boundary', () => {
  it('restores across reload without saving the restored records or losing a new draft', async () => {
    const { adapter, conversations, history } = fixture();
    conversations.update(row.context, () => ({ question: '다음 질문', answers: [] }));
    await history.restore(row.context);
    expect(conversations.get(row.context)).toEqual({ question: '다음 질문', answers: [answer] });
    expect(adapter.write).not.toHaveBeenCalled();
  });
  it('merges a slow restoration with a newly answered question instead of replacing it', async () => {
    const { adapter, conversations, history } = fixture(); const read = deferred<{ rows: HistoryTurn[]; cursor: null }>();
    vi.mocked(adapter.read).mockReturnValue(read.promise);
    const restoring = history.restore(row.context);
    const newer = { ...answer, historyId: 'new-id', createdAt: '2026-11-18T02:00:00Z' };
    conversations.update(row.context, () => ({ question: '', answers: [newer] }));
    read.resolve({ rows: [row], cursor: null }); await restoring;
    expect(conversations.get(row.context).answers).toEqual([answer, newer]);
  });
  it('shows a write failure and retries the same immutable id without another AI request', async () => {
    const { adapter, history } = fixture(); vi.mocked(adapter.write).mockRejectedValueOnce(new Error('offline'));
    history.save(row.context, answer);
    await vi.waitFor(() => expect(history.getSnapshot().error).toContain('저장하지 못했어요'));
    expect(history.getSnapshot().pending).toBe(1);
    await history.retry(); expect(history.getSnapshot().pending).toBe(0);
    expect(adapter.write).toHaveBeenCalledTimes(2);
    expect(vi.mocked(adapter.write).mock.calls.map(c => c[1].historyId)).toEqual([id,id]);
  });
  it('does not publish a read or queued write after logout', async () => {
    const { adapter, history } = fixture(); const read = deferred<{ rows: HistoryTurn[]; cursor: null }>();
    vi.mocked(adapter.read).mockReturnValue(read.promise);
    const loading = history.load(); history.save(row.context, answer); history.dispose();
    read.resolve({ rows: [row], cursor: null }); await loading; await Promise.resolve();
    expect(history.getSnapshot().rows).toEqual([]); expect(adapter.write).not.toHaveBeenCalled();
  });
  it('keeps records visible on failed deletion, then removes the record from both history and transcript', async () => {
    const { adapter, history, conversations } = fixture(); await history.load(); await history.restore(row.context);
    vi.mocked(adapter.remove).mockRejectedValueOnce(new Error('offline'));
    expect(await history.remove(id)).toBe(false); expect(history.getSnapshot().rows).toHaveLength(1);
    expect(await history.remove(id)).toBe(true); expect(history.getSnapshot().rows).toHaveLength(0);
    expect(conversations.get(row.context).answers).toHaveLength(0);
  });
  it('invalidates a restoration that started before deletion', async () => {
    const { adapter, history, conversations } = fixture(); const read = deferred<{ rows: HistoryTurn[]; cursor: null }>();
    vi.mocked(adapter.read).mockReturnValue(read.promise);
    const restoring = history.restore(row.context); await history.remove(); read.resolve({ rows: [row], cursor: null }); await restoring;
    expect(conversations.get(row.context).answers).toEqual([]);
  });
  it('does not resurrect a record deleted in another tab on retry', async () => {
    const { adapter, history, conversations } = fixture(); await history.restore(row.context);
    vi.mocked(adapter.write).mockResolvedValue(false); history.save(row.context, answer); await history.retry();
    expect(conversations.get(row.context).answers).toEqual([]);
  });
  it('paginates with the server cursor and distinguishes outages from no history', async () => {
    const { adapter, history } = fixture(); vi.mocked(adapter.read).mockResolvedValueOnce({ rows: [row], cursor: 1 });
    await history.load(); await history.load(true); expect(adapter.read).toHaveBeenLastCalledWith(1);
    expect(history.getSnapshot().rows).toHaveLength(1);
    vi.mocked(adapter.read).mockRejectedValueOnce(new Error('offline')); await history.load();
    expect(history.getSnapshot().rows).toHaveLength(1); expect(history.getSnapshot().error).toContain('불러오지 못했어요');
  });
});
describe('history payload and date presentation', () => {
  it('does not store quality receipts, model metadata, or unsafe source URLs', () => {
    const saved = historyAnswer({ ...answer, qualityReceipt: 'sensitive', savedSources: [{ title:'bad',url:'javascript:alert(1)' },{title:'ok',url:'https://example.com/news'}] });
    expect(saved).not.toHaveProperty('qualityReceipt'); expect(saved.savedSources).toEqual([{title:'ok',url:'https://example.com/news'}]);
  });
  it('rejects invalid restored answers instead of crashing the transcript', () => {
    const raw = { id, seq: 1, context:row.context, created_at: row.createdAt, answer };
    expect(parseHistoryTurn(raw)?.answer.question).toBe(answer.question);
    expect(parseHistoryTurn({ ...raw, answer: { ...answer, keyAdvice:[{}] } })).toBeNull();
    expect(parseHistoryTurn({ ...raw, created_at:'nonsense' })).toBeNull();
  });
  it('groups dates at Korean midnight rather than browser UTC', () => {
    const now = new Date('2026-11-18T15:10:00Z');
    expect(historyDayLabel('2026-11-18T15:01:00Z',now)).toBe('오늘');
    expect(historyDayLabel('2026-11-18T14:59:00Z',now)).toBe('어제');
    expect(historyDayLabel('2026-11-16T01:00:00Z',now)).toBe('2026-11-16');
  });
});
