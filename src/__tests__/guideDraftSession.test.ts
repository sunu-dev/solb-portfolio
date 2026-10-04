import { describe, expect, it } from 'vitest';
import { createGuideDraftSession, getGuideDraftState } from '@/lib/guideDraftSession';
import { GUIDE_NOTE_LIMIT } from '@/lib/guideNotebook';

describe('guide draft account and storage boundaries', () => {
  it('keeps separate in-memory drafts without turning them into saved entries', () => {
    const session = createGuideDraftSession();
    const epoch = session.getSnapshot().epoch;
    session.update('rates', { text: '금리 초안', baseExplanation: '' }, epoch);
    session.update('inflation', { text: '물가 초안', baseExplanation: '기존 물가 메모' }, epoch);
    expect(session.getSnapshot().entries.rates).toEqual({ text: '금리 초안', baseExplanation: '' });
    expect(session.getSnapshot().entries.inflation?.text).toBe('물가 초안');
    expect(createGuideDraftSession().getSnapshot().entries).toEqual({});
  });

  it('rejects a captured old-account writer after clearing, even without mounted subscribers', () => {
    const session = createGuideDraftSession();
    const oldEpoch = session.getSnapshot().epoch;
    session.update('rates', { text: 'private', baseExplanation: '' }, oldEpoch);
    session.clear();
    expect(session.update('rates', { text: 'stale callback', baseExplanation: '' }, oldEpoch)).toBe(false);
    expect(session.getSnapshot().entries).toEqual({});
    expect(session.update('rates', { text: 'new account', baseExplanation: '' }, session.getSnapshot().epoch)).toBe(true);
  });

  it('follows external saves only when pristine and keeps a conflicting dirty draft', () => {
    const entry = { explanation: '다른 탭에서 저장한 글', savedAt: 1 };
    expect(getGuideDraftState(entry, { text: '기존 글', baseExplanation: '기존 글' }))
      .toMatchObject({ text: entry.explanation, dirty: false, conflict: false });
    expect(getGuideDraftState(entry, { text: '내 작성 중인 글', baseExplanation: '기존 글' }))
      .toMatchObject({ text: '내 작성 중인 글', dirty: true, conflict: true });
    expect(getGuideDraftState(entry, { text: '', baseExplanation: '기존 글' }))
      .toMatchObject({ text: '', dirty: true, conflict: true });
  });

  it('bounds retained text and removes only the saved guide draft', () => {
    const session = createGuideDraftSession();
    const epoch = session.getSnapshot().epoch;
    session.update('rates', { text: '가'.repeat(GUIDE_NOTE_LIMIT + 20), baseExplanation: '' }, epoch);
    session.update('inflation', { text: '유지', baseExplanation: '' }, epoch);
    expect(session.getSnapshot().entries.rates?.text).toHaveLength(GUIDE_NOTE_LIMIT);
    session.update('rates', undefined, epoch);
    expect(session.getSnapshot().entries).toEqual({ inflation: { text: '유지', baseExplanation: '' } });
  });
});
