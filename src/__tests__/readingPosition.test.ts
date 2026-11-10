import { describe, expect, it } from 'vitest';
import { restoredAnchorTop, selectReadingAnchor } from '@/lib/readingPosition';

describe('semantic reading position', () => {
  it('does not choose a distant open reader over the section being read', () => {
    expect(selectReadingAnchor([
      { selector: '#anchor-news', offset: -120, height: 900 },
      { selector: '[data-inline-origin="answer-cash"] h3', offset: 850, height: 32 },
    ], 600)).toEqual({ selector: '#anchor-news', offset: -120 });
  });
  it('prefers a heading at the reading line and preserves its screen offset when content above grows', () => {
    const anchor = selectReadingAnchor([
      { selector: '#anchor-news', offset: -900, height: 1000 },
      { selector: '[data-inline-origin="answer-cash"] h3', offset: 18, height: 32 },
    ], 600)!;
    expect(anchor.selector).toContain('answer-cash');
    expect(restoredAnchorTop(4041, 64, anchor.offset)).toBe(4087);
    // The scroll number changes, but the same heading remains 18px below body top.
    expect(64 - (4087 - 4041)).toBe(anchor.offset);
  });
  it('falls back to an absolute position when no eligible anchor exists', () => {
    expect(selectReadingAnchor([{ selector: '#anchor-personal', offset: 900, height: 400 }], 600)).toBeUndefined();
  });
});
