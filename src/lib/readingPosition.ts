export interface ReadingAnchor { selector: string; offset: number }
export interface ReadingAnchorCandidate extends ReadingAnchor { height: number }

/** Prefer the closest visible heading. A heading below the viewport cannot win
 * merely because its reader is open; otherwise use the nearest preceding anchor. */
export function selectReadingAnchor(candidates: readonly ReadingAnchorCandidate[], viewportHeight: number): ReadingAnchor | undefined {
  const valid = candidates.filter(item => Number.isFinite(item.offset) && item.offset < viewportHeight);
  const visible = valid.filter(item => item.offset >= 0 && item.offset <= Math.min(viewportHeight, 160));
  const preceding = valid.filter(item => item.offset < 0);
  const choice = [...visible, ...preceding].sort((a, b) => Math.abs(a.offset - 16) - Math.abs(b.offset - 16))[0];
  return choice ? { selector: choice.selector, offset: choice.offset } : undefined;
}

export function restoredAnchorTop(scrollTop: number, currentOffset: number, savedOffset: number): number {
  return Math.max(0, scrollTop + currentOffset - savedOffset);
}
