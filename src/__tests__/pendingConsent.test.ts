import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { persistPendingConsent } from '@/lib/pendingConsent';

const pending = JSON.stringify({ age_18_plus: true, terms: 'v5', privacy: 'v4', ts: '2026-09-07T10:00:00.000Z' });

function setup(value: string | null = pending) {
  const storage = { getItem: vi.fn(() => value), removeItem: vi.fn() };
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const client = { from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient;
  return { storage, upsert, client };
}

describe('가입 동의 기록 보존', () => {
  it('DB 오류 반환 시 임시 기록을 삭제하지 않는다', async () => {
    const { client, storage, upsert } = setup();
    upsert.mockResolvedValue({ error: { message: 'database unavailable' } });
    await expect(persistPendingConsent(client, 'test-user', storage)).rejects.toThrow();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it('네트워크 예외도 기록을 보존한다', async () => {
    const { client, storage, upsert } = setup();
    upsert.mockRejectedValue(new Error('offline'));
    await expect(persistPendingConsent(client, 'test-user', storage)).rejects.toThrow();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it('성공 시 동의 세 항목만 전송하고 임시 기록을 삭제한다', async () => {
    const { client, storage, upsert } = setup();
    await persistPendingConsent(client, 'test-user', storage);
    expect(upsert.mock.calls[0][0]).toHaveLength(3);
    for (const row of upsert.mock.calls[0][0]) {
      expect(Object.keys(row).sort()).toEqual(['agreed_at', 'consent_type', 'user_id', 'version']);
    }
    expect(storage.removeItem).toHaveBeenCalledWith('solb_consent_pending');
  });
  it('저장 중 바뀐 임시 동의를 삭제하지 않는다', async () => {
    const { client, storage } = setup();
    storage.getItem.mockReturnValueOnce(pending).mockReturnValueOnce('new consent');
    await persistPendingConsent(client, 'test-user', storage);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it.each([null, '{}', '{broken'])('동의가 없거나 잘못됐으면 DB에 쓰지 않는다: %s', async (value) => {
    const { client, storage, upsert } = setup(value);
    if (value === null) await persistPendingConsent(client, 'test-user', storage);
    else await expect(persistPendingConsent(client, 'test-user', storage)).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});
