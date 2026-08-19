import { describe, expect, it } from 'vitest';
import { redactAiAuditExport } from '@/lib/aiAuditExport';

describe('redactAiAuditExport', () => {
  it('removes personal input keys recursively', () => {
    const result = redactAiAuditExport({
      user_id: 'user-1',
      report: { avgCost: 123, shares: 4, conclusion: '중립' },
      publicPrice: 150,
    });

    expect(result).toEqual({ report: { conclusion: '중립' }, publicPrice: 150 });
  });

  it('redacts personal values embedded in output text', () => {
    expect(redactAiAuditExport('평단 123,000원, 보유 수량: 10, 목표수익률 8%'))
      .toBe('평단 [REDACTED]원, 보유 수량: [REDACTED], 목표수익률 [REDACTED]');
  });
});
