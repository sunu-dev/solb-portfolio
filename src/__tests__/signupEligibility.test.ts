import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveSignupEligibility } from '@/lib/signupEligibility';
import { AGE_GATE_VERSION, TERMS_VERSION, PRIVACY_VERSION } from '@/config/legalVersions';
import { AI_ADULT_CONSENT_TYPE } from '@/lib/aiAgeGate';

const rows = [
  { consent_type: AI_ADULT_CONSENT_TYPE, version: AGE_GATE_VERSION },
  { consent_type: 'terms', version: TERMS_VERSION },
  { consent_type: 'privacy', version: PRIVACY_VERSION },
];
function setup(pending = true) {
  let value: string | null = pending ? JSON.stringify({ age_18_plus: true,
    terms: TERMS_VERSION, privacy: PRIVACY_VERSION, ts: new Date().toISOString() }) : null;
  const storage = { getItem: vi.fn(() => value), removeItem: vi.fn(() => { value = null; }) };
  const read = vi.fn().mockResolvedValue({ data: rows, error: null });
  const eq = vi.fn(() => ({ in: read }));
  const select = vi.fn(() => ({ eq }));
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const client = { from: vi.fn(() => ({ select, upsert })) } as unknown as SupabaseClient;
  return { client, storage, select, eq, read, upsert };
}

describe('로그인 동의 저장 → 조회 순서', () => {
  it('저장이 느려도 완료 전 동의 없음으로 판정하거나 조회하지 않는다', async () => {
    const s = setup();
    let finish!: (value: { error: null }) => void;
    s.upsert.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const result = resolveSignupEligibility(s.client, 'user-a', s.storage);
    await Promise.resolve();
    expect(s.select).not.toHaveBeenCalled();
    finish({ error: null });
    await expect(result).resolves.toBe('eligible');
    expect(s.eq).toHaveBeenCalledWith('user_id', 'user-a');
  });
  it('저장 실패는 입력 재요청이 아니라 오류이며 동의를 보존한다', async () => {
    const s = setup();
    s.upsert.mockResolvedValue({ error: { message: 'offline' } });
    await expect(resolveSignupEligibility(s.client, 'a', s.storage)).resolves.toBe('error');
    expect(s.select).not.toHaveBeenCalled();
    expect(s.storage.removeItem).not.toHaveBeenCalled();
    s.upsert.mockResolvedValue({ error: null });
    await expect(resolveSignupEligibility(s.client, 'a', s.storage)).resolves.toBe('eligible');
  });
  it('기존 회원은 DB의 현행 동의 세 항목으로 통과하고 재저장하지 않는다', async () => {
    const s = setup(false);
    await expect(resolveSignupEligibility(s.client, 'a', s.storage)).resolves.toBe('eligible');
    expect(s.upsert).not.toHaveBeenCalled();
  });
  it.each([[], rows.slice(0, 1), rows.map(r => ({ ...r, version: 'old' }))].map(data => ({ data })))(
    '동의 누락·구버전은 재확인이 필요하다', async ({ data }) => {
      const s = setup(false);
      s.read.mockResolvedValue({ data, error: null });
      await expect(resolveSignupEligibility(s.client, 'a', s.storage)).resolves.toBe('required');
    });
  it('조회 네트워크 예외는 통과하지 않는다', async () => {
    const s = setup(false);
    s.read.mockRejectedValue(new Error('offline'));
    await expect(resolveSignupEligibility(s.client, 'a', s.storage)).resolves.toBe('error');
  });
});
