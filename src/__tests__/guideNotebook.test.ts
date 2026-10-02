import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  emptyNotebook, GUIDE_NOTEBOOK_KEY, GUIDE_NOTE_LIMIT, isGuideId, parseGuideNotebook, updateGuideEntry,
} from '@/lib/guideNotebook';
import { clearUserStorage, USER_STORAGE_KEYS } from '@/lib/userStorage';

const savedAt = Date.parse('2026-10-01T12:00:00Z');
const checkedAt = Date.parse('2026-10-02T12:00:00Z');
const restore = (entries: unknown) => parseGuideNotebook(JSON.stringify({ version: 1, entries }));

afterEach(() => vi.unstubAllGlobals());

describe('guide notebook restore', () => {
  it.each([null, '', '{', 'null', 'false', '[]', '42', '{"version":2,"entries":{}}', '{"version":1,"entries":null}'])('handles corrupt or unsupported storage: %s', raw => {
    expect(parseGuideNotebook(raw)).toEqual(emptyNotebook());
  });

  it('restores only known entries and schema fields without changing object prototypes', () => {
    const raw = `{"version":1,"entries":{"__proto__":{"polluted":true},"unknown":{"explanation":"private","savedAt":${savedAt}},"inflation":{"explanation":"물가와 매출을 함께 확인해요.","savedAt":${savedAt},"checkCorrect":false,"checkedAt":${checkedAt},"symbol":"AAPL","__proto__":{"polluted":true}}}}`;
    expect(parseGuideNotebook(raw)).toEqual({ version: 1, entries: {
      inflation: { explanation: '물가와 매출을 함께 확인해요.', savedAt, checkCorrect: false, checkedAt },
    } });
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });

  it('does not restore an entry inherited from a polluted prototype', () => {
    Object.defineProperty(Object.prototype, 'inflation', {
      configurable: true, writable: true, value: { explanation: 'inherited text', savedAt },
    });
    try {
      expect(restore({ rates: { explanation: '내가 저장한 글', savedAt } })).toEqual({
        version: 1, entries: { rates: { explanation: '내가 저장한 글', savedAt } },
      });
    } finally {
      Reflect.deleteProperty(Object.prototype, 'inflation');
    }
  });

  it('limits restored explanations while preserving valid check outcomes', () => {
    expect(restore({ rates: { explanation: '가'.repeat(GUIDE_NOTE_LIMIT + 50), savedAt, checkCorrect: true, checkedAt } }).entries.rates)
      .toEqual({ explanation: '가'.repeat(GUIDE_NOTE_LIMIT), savedAt, checkCorrect: true, checkedAt });
  });

  it('does not turn empty text, invalid timestamps or non-boolean answers into completed work', () => {
    expect(restore({
      rates: { explanation: '금리', savedAt: '2026-10-01' },
      inflation: { explanation: '물가', savedAt: -1, checkCorrect: 'false', checkedAt },
      currency: { explanation: '환율', savedAt: 1e99 },
      earnings: { explanation: 123, checkCorrect: false, checkedAt },
    }).entries).toEqual({ earnings: { explanation: '', checkCorrect: false, checkedAt } });
    expect(restore({ rates: { explanation: '   ', savedAt } })).toEqual(emptyNotebook());
  });

  it('rejects the retired coffee topic in restored notes and incoming guide IDs', () => {
    expect(isGuideId('coffee')).toBe(false);
    expect(restore({ coffee: { explanation: 'retired topic', savedAt } })).toEqual(emptyNotebook());
  });
});

describe('guide notebook updates', () => {
  it('merges saved explanations and check results without losing either or another guide', () => {
    const first = updateGuideEntry(emptyNotebook(), 'inflation', { explanation: '물가의 비교 기간을 확인해요.', savedAt });
    const checked = updateGuideEntry(first, 'inflation', { checkCorrect: false, checkedAt });
    const other = updateGuideEntry(checked, 'rates', { explanation: '금리를 내린 이유도 봐요.', savedAt });
    const revised = updateGuideEntry(other, 'inflation', { explanation: '물가와 매출을 함께 확인해요.', savedAt: checkedAt });
    expect(revised.entries).toEqual({
      inflation: { explanation: '물가와 매출을 함께 확인해요.', savedAt: checkedAt, checkCorrect: false, checkedAt },
      rates: { explanation: '금리를 내린 이유도 봐요.', savedAt },
    });
    expect(first.entries.inflation).toEqual({ explanation: '물가의 비교 기간을 확인해요.', savedAt });
  });

  it('enforces the text limit on saving and retains checks when a saved explanation is cleared', () => {
    const checked = updateGuideEntry(emptyNotebook(), 'currency', { checkCorrect: true, checkedAt });
    const saved = updateGuideEntry(checked, 'currency', { explanation: '나'.repeat(GUIDE_NOTE_LIMIT + 1), savedAt });
    expect(saved.entries.currency?.explanation).toHaveLength(GUIDE_NOTE_LIMIT);
    expect(updateGuideEntry(saved, 'currency', { explanation: '' }).entries.currency)
      .toEqual({ explanation: '', checkCorrect: true, checkedAt });
  });
});

it('clears the notebook on logout after notifying mounted consumers', () => {
  expect(USER_STORAGE_KEYS).toContain(GUIDE_NOTEBOOK_KEY);
  const local = new Map([[GUIDE_NOTEBOOK_KEY, 'private explanation'], ['unrelated-setting', 'keep']]);
  const target = new EventTarget();
  let notifiedBeforeDeletion = false;
  target.addEventListener('solb-user-storage-clearing', () => { notifiedBeforeDeletion = local.has(GUIDE_NOTEBOOK_KEY); });
  vi.stubGlobal('window', target);
  vi.stubGlobal('localStorage', {
    get length() { return local.size; },
    key: (index: number) => [...local.keys()][index] ?? null,
    removeItem: (key: string) => local.delete(key),
  });
  vi.stubGlobal('sessionStorage', { length: 0, key: () => null, removeItem: vi.fn() });
  clearUserStorage();
  expect(notifiedBeforeDeletion).toBe(true);
  expect(local.has(GUIDE_NOTEBOOK_KEY)).toBe(false);
  expect(local.get('unrelated-setting')).toBe('keep');
});
