import { beforeEach, expect, it, vi } from 'vitest';
import { preparePortfolioIdentity, PORTFOLIO_RECOVERY_PREFIX } from '@/lib/portfolioIdentity';
import { clearUserStorage } from '@/lib/userStorage';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    clear: () => values.clear(),
  };
}
let storage: Storage;
beforeEach(() => { storage = memoryStorage(); });

it.each([null, 'new-account'])('첫 접속 %s: 주인 없는 실제 기록을 보존하고 비운 뒤 계정을 지정한다', userId => {
  const state = { stocks: { investing: [{ symbol: 'AAPL', shares: 5 }] }, dailySnapshots: [{ total: 100 }] };
  storage.setItem('solb-portfolio-storage', JSON.stringify(state));
  storage.setItem('solb_portfolio_sync_outbox_v1:old', 'pending');
  const order: string[] = [];
  preparePortfolioIdentity(userId, state, storage, () => {
    const key = storage.key(2)!;
    expect(key.startsWith(PORTFOLIO_RECOVERY_PREFIX)).toBe(true);
    const backup = JSON.parse(storage.getItem(key)!);
    expect(backup.state).toEqual(state);
    expect(backup.records['solb_portfolio_sync_outbox_v1:old']).toBe('pending');
    order.push('reset');
  }, id => { expect(id).toBe(userId); order.push('assign'); });
  expect(order).toEqual(['reset', 'assign']);
});

it('동일 계정의 재접속은 미동기화 기록을 그대로 유지한다', () => {
  const reset = vi.fn(), assign = vi.fn();
  preparePortfolioIdentity('A', { portfolioOwnerId: 'A' }, storage, reset, assign);
  expect(reset).not.toHaveBeenCalled();
  expect(assign).not.toHaveBeenCalled();
  expect(storage.length).toBe(0);
});

it.each([null, 'B'])('기존 A 계정 → %s: 다른 사용자에게 기록을 넘기지 않는다', userId => {
  const reset = vi.fn(), assign = vi.fn();
  preparePortfolioIdentity(userId, { portfolioOwnerId: 'A', stocks: { investing: [{}] } }, storage, reset, assign);
  expect(JSON.parse(storage.getItem(storage.key(0)!)!).ownerId).toBe('A');
  expect(reset).toHaveBeenCalledOnce();
  expect(assign).toHaveBeenCalledWith(userId);
});

it.each(['throws', 'silent'])('복구본 저장 실패(%s)는 원본 변경 전에 중단한다', mode => {
  storage.setItem = () => { if (mode === 'throws') throw new Error('quota'); };
  const reset = vi.fn(), assign = vi.fn();
  expect(() => preparePortfolioIdentity(null, { stocks: { investing: [{}] } }, storage, reset, assign)).toThrow();
  expect(reset).not.toHaveBeenCalled();
  expect(assign).not.toHaveBeenCalled();
});

it('빈 게스트 방문은 복구본을 계속 만들지 않는다', () => {
  preparePortfolioIdentity(null, { stocks: { investing: [] } }, storage, vi.fn(), vi.fn());
  expect(storage.length).toBe(0);
});

it('화면 데이터가 비어 있어도 미전송 outbox만 남았다면 보존한다', () => {
  storage.setItem('solb_portfolio_sync_outbox_v1:old', 'pending');
  preparePortfolioIdentity(null, {}, storage, vi.fn(), vi.fn());
  const backup = JSON.parse(storage.getItem(storage.key(1)!)!);
  expect(backup.records['solb_portfolio_sync_outbox_v1:old']).toBe('pending');
});

it('초기 경계 정리는 OAuth 약관 동의와 복구본을 보존한다', () => {
  const session = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('sessionStorage', session);
  session.setItem('solb_consent_pending', 'consent');
  storage.setItem(`${PORTFOLIO_RECOVERY_PREFIX}test`, 'backup');
  storage.setItem('solb-portfolio-storage', 'old');
  try {
    clearUserStorage({ preservePendingConsent: true });
    expect(session.getItem('solb_consent_pending')).toBe('consent');
    expect(storage.getItem(`${PORTFOLIO_RECOVERY_PREFIX}test`)).toBe('backup');
    expect(storage.getItem('solb-portfolio-storage')).toBeNull();
  } finally { vi.unstubAllGlobals(); }
});
