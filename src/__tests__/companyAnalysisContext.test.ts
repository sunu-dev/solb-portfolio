import { beforeEach, describe, expect, it, vi } from 'vitest';
const reader = vi.hoisted(() => vi.fn());
vi.mock('@/lib/companyBusiness/store', () => ({ readPublishedBusiness: reader }));
import { companyAnalysisContext } from '@/lib/companyAnalysisContext';
beforeEach(() => { reader.mockReset(); reader.mockResolvedValue({ status: 'none' }); });
describe('server-owned business context for AI questions', () => {
  it('supplies actual products, customers, revenue, useful questions and dated sources', async () => {
    const { prompt: context } = await companyAnalysisContext('340810.KQ');
    expect(context).toContain('SEEU ON'); expect(context).toContain('SEEU ID');
    expect(context).toContain('FaceLocker'); expect(context).toContain('알체라');
    expect(context).toContain('공항'); expect(context).toContain('설치·연결');
    expect(context).toContain('secern.ai'); expect(context).toContain('2026-11-03');
    expect(reader).toHaveBeenCalledExactlyOnceWith('340810.KQ');
  });
  it.each(['withheld', 'unavailable'])('does not revive the static story when it is %s', async status => {
    reader.mockResolvedValue({ status });
    const { prompt: context } = await companyAnalysisContext('340810.KQ');
    expect(context).toContain('제공되지 않았어요'); expect(context).not.toContain('SEEU ON');
  });
  it('does not treat industry labels or product lists as a verified business explanation', async () => {
    const { prompt: context } = await companyAnalysisContext('UNKNOWN');
    expect(context).toContain('만들어내지 마세요'); expect(context).not.toContain('검수된 회사 사업 자료');
  });
  it('uses a published explanation instead of silently preferring the static one', async () => {
    reader.mockResolvedValue({ status: 'published', profile: { symbol: 'NFLX', version: 'v2', validUntil: '2099-01-01',
      summary: '검수된 새로운 사업 설명이에요.', customers: '검수한 고객이에요.', revenue: '검수한 이용료예요.', watch: '검수한 확인점이에요.', sources: [{ label: '공식 자료', url: 'https://example.com/filing' }] } });
    const { prompt: context } = await companyAnalysisContext('NFLX');
    expect(context).toContain('검수된 새로운 사업 설명'); expect(context).not.toContain('광고형 요금제');
  });
  it('holds cross-company and expired engine projections rather than reviving the static story', async () => {
    reader.mockResolvedValue({ status: 'published', profile: { symbol: 'OTHER', validUntil: '2099-01-01', sources: [] } });
    expect((await companyAnalysisContext('NFLX')).prompt).not.toContain('구독료');
    reader.mockResolvedValue({ status: 'published', profile: { symbol: 'NFLX', validUntil: '2020-01-01', sources: [] } });
    expect((await companyAnalysisContext('NFLX')).prompt).not.toContain('구독료');
  });
});
