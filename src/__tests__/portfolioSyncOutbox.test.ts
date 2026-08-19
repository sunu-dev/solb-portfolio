import { describe, expect, it } from 'vitest';
import type { PortfolioStocks } from '@/config/constants';
import {
  PORTFOLIO_SYNC_OUTBOX_PREFIX,
  choosePortfolioRecovery,
  clearPortfolioSyncOutbox,
  mergeLocalChoiceWithRemote,
  readPortfolioSyncOutbox,
  rebasePortfolioSyncOutbox,
  writePortfolioSyncOutbox,
  type PortfolioSyncPayload,
} from '@/lib/portfolioSyncOutbox';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function stocks(shares: number): PortfolioStocks {
  return {
    investing: [{
      symbol: '005930.KS',
      avgCost: 70_000,
      shares,
      targetReturn: 10,
      broker: 'kiwoom',
    }],
    watching: [],
    sold: [],
  };
}

function payload(shares: number): PortfolioSyncPayload {
  return {
    stocks: stocks(shares),
    snapshots: [],
    history: [],
  };
}

describe('portfolio durable sync outbox', () => {
  it('사용자와 기준 revision을 묶어 재시작 뒤에도 pending payload를 복구한다', () => {
    const storage = new MemoryStorage();
    writePortfolioSyncOutbox('user-a', payload(3), 'rev-1', storage);

    expect(readPortfolioSyncOutbox('user-a', storage)).toMatchObject({
      userId: 'user-a',
      baseUpdatedAt: 'rev-1',
      payload: { stocks: { investing: [{ shares: 3 }] } },
    });
    expect(readPortfolioSyncOutbox('user-b', storage)).toBeNull();
  });

  it('서버 revision이 그대로면 로컬 outbox를 재전송하고, 원격도 바뀌었으면 충돌로 멈춘다', () => {
    const storage = new MemoryStorage();
    const outbox = writePortfolioSyncOutbox('user-a', payload(3), 'rev-1', storage);

    expect(choosePortfolioRecovery(outbox, 'rev-1', payload(2))).toBe('outbox');
    expect(choosePortfolioRecovery(outbox, 'rev-2', payload(2))).toBe('conflict');
  });

  it('서버가 이미 같은 payload면 저장 응답 전 종료된 경우로 보고 outbox를 정리할 수 있다', () => {
    const storage = new MemoryStorage();
    const outbox = writePortfolioSyncOutbox('user-a', payload(3), 'rev-1', storage);

    expect(choosePortfolioRecovery(outbox, 'rev-2', payload(3))).toBe('remote');
  });

  it('JSON 객체 키 순서가 달라도 같은 서버 payload로 판단한다', () => {
    const storage = new MemoryStorage();
    const local = payload(3);
    const stock = local.stocks.investing[0];
    const reordered: PortfolioSyncPayload = {
      history: [],
      snapshots: [],
      stocks: {
        sold: [],
        watching: [],
        investing: [{
          broker: stock.broker,
          targetReturn: stock.targetReturn,
          shares: stock.shares,
          avgCost: stock.avgCost,
          symbol: stock.symbol,
        }],
      },
    };
    const outbox = writePortfolioSyncOutbox('user-a', local, 'rev-1', storage);

    expect(choosePortfolioRecovery(outbox, 'rev-2', reordered)).toBe('remote');
  });

  it('이전 저장 성공이 더 최신 pending payload를 지우지 않고 revision만 갱신한다', () => {
    const storage = new MemoryStorage();
    const older = payload(2);
    const newer = payload(3);
    writePortfolioSyncOutbox('user-a', newer, 'rev-1', storage);

    expect(clearPortfolioSyncOutbox('user-a', older, storage)).toBe(false);
    expect(rebasePortfolioSyncOutbox('user-a', 'rev-2', storage)?.baseUpdatedAt).toBe('rev-2');
    expect(readPortfolioSyncOutbox('user-a', storage)?.payload.stocks.investing[0].shares).toBe(3);
  });

  it('손상되거나 소유자가 다른 outbox는 격리하고 제거한다', () => {
    const storage = new MemoryStorage();
    storage.setItem(`${PORTFOLIO_SYNC_OUTBOX_PREFIX}user-a`, JSON.stringify({
      schema: 'joobi-portfolio-sync-outbox-v1',
      userId: 'user-b',
      queuedAt: new Date().toISOString(),
      baseUpdatedAt: null,
      payload: payload(2),
    }));

    expect(readPortfolioSyncOutbox('user-a', storage)).toBeNull();
    expect(storage.getItem(`${PORTFOLIO_SYNC_OUTBOX_PREFIX}user-a`)).toBeNull();
  });

  it('로컬 변경 유지 시 원격 종목은 복구 지점으로 남기고 스냅샷은 합친다', () => {
    const local = payload(3);
    local.snapshots = [{
      date: '2026-07-28',
      totalValue: 300,
      totalCost: 200,
      stocks: [],
    }];
    const remote = payload(2);
    remote.snapshots = [{
      date: '2026-07-27',
      totalValue: 200,
      totalCost: 200,
      stocks: [],
    }];

    const merged = mergeLocalChoiceWithRemote(local, remote, {
      checkpointId: 'cloud-before-conflict',
      createdAt: '2026-07-28T12:00:00.000Z',
    });

    expect(merged.stocks.investing[0].shares).toBe(3);
    expect(merged.snapshots.map((snapshot) => snapshot.date)).toEqual([
      '2026-07-27',
      '2026-07-28',
    ]);
    expect(merged.history[0]).toMatchObject({
      id: 'cloud-before-conflict',
      source: '충돌 전 클라우드 기록',
      stocks: { investing: [{ shares: 2 }] },
    });
  });
});
