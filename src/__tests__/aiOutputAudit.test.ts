import { describe, expect, it } from 'vitest';
import { inspectAiOutput } from '@/lib/aiOutputAudit';

describe('inspectAiOutput', () => {
  it('marks clean informational output as none', () => {
    expect(inspectAiOutput({ desc: '현재 변동성과 거래량을 함께 살펴보세요.' }))
      .toEqual({ flags: [], severity: 'none' });
  });

  it('marks a forbidden phrase as high severity', () => {
    const forbiddenFixture = ['지금', '매수'].join(' ') + ' 구간입니다.';
    expect(inspectAiOutput({ desc: forbiddenFixture })).toMatchObject({
      flags: ['forbidden_phrase'],
      severity: 'high',
    });
  });

  it('detects target prices for manual review', () => {
    expect(inspectAiOutput({ desc: '목표가: $123.50' })).toMatchObject({
      flags: ['target_price'],
      severity: 'review',
    });
  });
});
