import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BadgeSection from '@/components/portfolio/BadgeSection';
import { AVAILABLE_BADGES } from '@/config/badges';

describe('available badge display', () => {
  it.each([false, true])('keeps unavailable achievements out of names and counts (compact=%s)', compact => {
    const html = renderToStaticMarkup(<BadgeSection compact={compact} />);
    expect(html).not.toContain('멘토 마스터');
    expect(html).not.toContain('비광');
    expect(html).not.toContain('전설');
    expect(html).toContain(`/${AVAILABLE_BADGES.length}개 달성`);
    expect(AVAILABLE_BADGES).toHaveLength(12);
    for (const badge of AVAILABLE_BADGES) expect(html).toContain(badge.name);
  });
});
