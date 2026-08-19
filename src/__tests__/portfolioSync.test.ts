import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortfolioStocks } from '@/config/constants';
import { savePortfolioToDB } from '@/lib/portfolioSync';

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => ({
      upsert: mocks.upsert,
    }),
  },
}));

const STOCKS: PortfolioStocks = {
  investing: [{
    symbol: 'AAPL',
    avgCost: 100,
    shares: 2,
    targetReturn: 10,
  }],
  watching: [{
    symbol: 'NVDA',
    avgCost: 0,
    shares: 0,
    targetReturn: 0,
    demo: true,
  }],
  sold: [],
};

describe('포트폴리오 클라우드 저장 계약', () => {
  beforeEach(() => {
    mocks.upsert.mockReset();
    mocks.rpc.mockReset();
  });

  it('모든 필드 저장 성공을 호출부에 명확히 반환하고 데모 종목은 제외한다', async () => {
    mocks.upsert.mockResolvedValueOnce({ error: null });

    const result = await savePortfolioToDB('user-1', STOCKS, [], []);

    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      dailySnapshotsSaved: true,
      portfolioHistorySaved: true,
      updatedAt: expect.any(String),
    }));
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        stocks: expect.objectContaining({ watching: [] }),
        portfolio_history: [],
      }),
      { onConflict: 'user_id' },
    );
  });

  it('운영 DB에 복구 기록 컬럼이 없으면 로컬 전용 상태로 구분할 수 있게 반환한다', async () => {
    mocks.upsert
      .mockResolvedValueOnce({ error: { message: 'portfolio_history column does not exist' } })
      .mockResolvedValueOnce({ error: null });

    const result = await savePortfolioToDB('user-1', STOCKS, [], []);

    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      dailySnapshotsSaved: true,
      portfolioHistorySaved: false,
      updatedAt: expect.any(String),
    }));
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });

  it('일시적 저장 오류를 성공처럼 삼키지 않는다', async () => {
    mocks.upsert.mockResolvedValueOnce({ error: { message: 'network unavailable' } });

    await expect(savePortfolioToDB('user-1', STOCKS, [], []))
      .resolves.toEqual({ status: 'error', error: 'network unavailable' });
  });

  it('마지막으로 읽은 서버 시각과 같을 때만 원자 저장한다', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{
        save_status: 'ok',
        saved_updated_at: '2026-07-28T09:00:00.000Z',
      }],
      error: null,
    });

    await expect(savePortfolioToDB(
      'user-1',
      STOCKS,
      [],
      [],
      '2026-07-28T08:00:00.000Z',
    )).resolves.toEqual({
      status: 'ok',
      dailySnapshotsSaved: true,
      portfolioHistorySaved: true,
      updatedAt: '2026-07-28T09:00:00.000Z',
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      'save_user_portfolio_if_current_v2',
      expect.objectContaining({
        p_user_id: 'user-1',
        p_expected_updated_at: '2026-07-28T08:00:00.000Z',
      }),
    );
  });

  it('다른 기기가 먼저 저장했으면 덮어쓰지 않고 충돌을 반환한다', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{
        save_status: 'conflict',
        saved_updated_at: '2026-07-28T09:00:00.000Z',
      }],
      error: null,
    });

    await expect(savePortfolioToDB(
      'user-1',
      STOCKS,
      [],
      [],
      '2026-07-28T08:00:00.000Z',
    )).resolves.toEqual({
      status: 'conflict',
      remoteUpdatedAt: '2026-07-28T09:00:00.000Z',
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
