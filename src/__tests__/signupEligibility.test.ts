import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveSignupEligibility, resolveSignupRequirements } from '@/lib/signupEligibility';
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
  const eq = vi.fn(() => ({ in: () => ({ abortSignal: () => read() }) }));
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
  it('약관만 구버전이면 이미 확인한 생년월일과 개인정보 동의를 다시 요청하지 않는다', async () => {
    const s = setup(false);
    s.read.mockResolvedValue({ data: rows.map(row => row.consent_type === 'terms' ? { ...row, version: 'old' } : row), error: null });
    await expect(resolveSignupRequirements(s.client, 'a', s.storage)).resolves.toEqual({ status: 'required', missing: ['terms'] });
    expect(s.upsert).not.toHaveBeenCalled();
  });
  it('새 계정은 성인 확인과 필수 동의가 모두 필요하고 자동 동의하지 않는다', async () => {
    const s = setup(false);
    s.read.mockResolvedValue({ data: [], error: null });
    await expect(resolveSignupRequirements(s.client, 'a', s.storage)).resolves.toEqual({ status: 'required', missing: [AI_ADULT_CONSENT_TYPE, 'terms', 'privacy'] });
    expect(s.upsert).not.toHaveBeenCalled();
  });
  it('서버 조회 실패를 누락 항목 없음으로 통과시키지 않는다', async () => {
    const s = setup(false);
    s.read.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    await expect(resolveSignupRequirements(s.client, 'a', s.storage)).resolves.toEqual({ status: 'error', missing: [] });
  });
});


describe('동의 조회 지연과 취소', () => {
  it('4.4초 정상 응답을 중단하거나 재조회하지 않는다', async () => {
    vi.useFakeTimers();
    try {
      const s = setup(false);
      s.read.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: rows, error: null }), 4400)));
      const result = resolveSignupRequirements(s.client, 'a', s.storage);
      await vi.advanceTimersByTimeAsync(4400);
      await expect(result).resolves.toEqual({ status: 'eligible', missing: [] });
      expect(s.read).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
  it('응답 없는 조회도 5.5초 안에 오류로 끝내며 통과하지 않는다', async () => {
    vi.useFakeTimers();
    try {
      const s = setup(false);
      s.read.mockImplementation(() => new Promise(() => {}));
      const result = resolveSignupRequirements(s.client, 'a', s.storage);
      await vi.advanceTimersByTimeAsync(5500);
      await expect(result).resolves.toEqual({ status: 'error', missing: [] });
      expect(s.read).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it('화면 이탈 취소는 재시도하지 않는다', async () => {
    const s = setup(false);
    const controller = new AbortController();
    s.read.mockImplementation(() => new Promise(() => {}));
    const result = resolveSignupRequirements(s.client, 'a', s.storage, controller.signal);
    await vi.waitFor(() => expect(s.read).toHaveBeenCalledTimes(1));
    controller.abort();
    await expect(result).resolves.toEqual({ status: 'error', missing: [] });
    expect(s.read).toHaveBeenCalledTimes(1);
  });
});
