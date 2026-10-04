import { describe, expect, it } from 'vitest';
import { workspaceSection, workspaceUrl } from '@/lib/workspaceNavigation';

describe('workspace URLs', () => {
  it('supports existing PWA shortcuts and shared guides', () => {
    expect(workspaceSection(new URLSearchParams('section=news'))).toBe('news');
    expect(workspaceSection(new URLSearchParams('guide=rates'))).toBe('insights');
    expect(workspaceSection(new URLSearchParams('view=analysis'))).toBe('events');
    expect(workspaceSection(new URLSearchParams('view=unknown'))).toBe('portfolio');
  });
  it('keeps section context when stock detail closes', () => {
    expect(workspaceUrl('https://joobi.kr/?view=news&stock=AAPL', 'news', null)).toBe('/?view=news');
    expect(workspaceUrl('https://joobi.kr/?view=insights&guide=rates', 'insights', 'AAPL')).toBe('/?view=insights&guide=rates&stock=AAPL');
  });
  it('clears view-specific state without discarding unrelated parameters', () => {
    expect(workspaceUrl('https://joobi.kr/?view=insights&guide=rates&tool=macro&login=1', 'news', null)).toBe('/?view=news&login=1');
  });
});
