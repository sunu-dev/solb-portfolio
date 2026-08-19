import { describe, expect, it } from 'vitest';
import { buildAiAuditCoverage } from '@/lib/aiAuditCoverage';

describe('buildAiAuditCoverage', () => {
  it('tracks each feature independently', () => {
    const rows = [
      ...Array.from({ length: 100 }, () => ({ feature: 'ai-analysis', reviewed_at: '2026-07-16T00:00:00Z' })),
      ...Array.from({ length: 25 }, () => ({ feature: 'ai-chok', reviewed_at: null })),
    ];
    const [analysis, chok] = buildAiAuditCoverage(rows, 100);

    expect(analysis).toMatchObject({ total: 100, reviewed: 100, remaining: 0, progressPercent: 100, ready: true });
    expect(chok).toMatchObject({ total: 25, reviewed: 0, remaining: 75, progressPercent: 25, ready: false });
  });

  it('uses a safe target when configuration is invalid', () => {
    expect(buildAiAuditCoverage([], 0)[0].target).toBe(100);
  });
});
