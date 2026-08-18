import { supabase } from './supabase';
import type { PortfolioStocks } from '@/config/constants';
import {
  normalizePortfolioVersions,
  type PortfolioVersionEntry,
} from '@/lib/portfolioReconciliation';
import { normalizePortfolioSyncPayload } from '@/lib/portfolioSyncOutbox';
import type { DailySnapshot } from '@/utils/dailySnapshot';

export type LoadResult =
  | {
      status: 'ok';
      stocks: PortfolioStocks;
      dailySnapshots: DailySnapshot[];
      updatedAt: string;
      /** undefined면 운영 DB에 컬럼이 아직 없어 로컬 기록을 유지해야 한다. */
      portfolioHistory?: PortfolioVersionEntry[];
    }
  | { status: 'empty' }       // 정상 응답 + DB row 없음 (첫 로그인)
  | { status: 'error'; error: string }; // 네트워크/RLS/일시적 오류 — save 금지

export type SaveResult =
  | {
      status: 'ok';
      dailySnapshotsSaved: boolean;
      portfolioHistorySaved: boolean;
      updatedAt: string;
    }
  | { status: 'conflict'; remoteUpdatedAt?: string }
  | { status: 'error'; error: string };

function toLoadResult(
  data: Record<string, unknown> | null,
  options: { historyAvailable: boolean },
): LoadResult {
  if (!data?.stocks) return { status: 'empty' };
  const normalized = normalizePortfolioSyncPayload({
    stocks: data.stocks,
    snapshots: Array.isArray(data.daily_snapshots)
      ? data.daily_snapshots
      : [],
    history: options.historyAvailable
      ? data.portfolio_history
      : [],
  });
  if (!normalized) {
    return {
      status: 'error',
      error: '클라우드 포트폴리오 데이터 형식을 확인하지 못했습니다.',
    };
  }
  return {
    status: 'ok',
    stocks: normalized.stocks,
    updatedAt: typeof data.updated_at === 'string'
      ? data.updated_at
      : new Date(0).toISOString(),
    dailySnapshots: normalized.snapshots,
    portfolioHistory: options.historyAvailable
      ? normalized.history
      : undefined,
  };
}

/**
 * 포트폴리오 DB 로드 — 결과 명확히 구분 (정합성 결함 C1 수정)
 *
 * 신규 컬럼이 아직 없는 운영 환경에서도 stocks를 읽되, 없는 history는 undefined로
 * 반환해 기기 안의 복구 기록을 실수로 빈 배열로 덮지 않는다.
 */
export async function loadPortfolio(userId: string): Promise<LoadResult> {
  const primary = await supabase
    .from('user_portfolios')
    .select('stocks, daily_snapshots, portfolio_history, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!primary.error) {
    return toLoadResult(primary.data as Record<string, unknown> | null, {
      historyAvailable: true,
    });
  }

  if (/portfolio_history/i.test(primary.error.message)) {
    const fallback = await supabase
      .from('user_portfolios')
      .select('stocks, daily_snapshots, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (!fallback.error) {
      return toLoadResult(fallback.data as Record<string, unknown> | null, {
        historyAvailable: false,
      });
    }
    if (!/daily_snapshots/i.test(fallback.error.message)) {
      return { status: 'error', error: fallback.error.message };
    }
  }

  if (/daily_snapshots/i.test(primary.error.message)) {
    const fallback = await supabase
      .from('user_portfolios')
      .select('stocks, portfolio_history, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (!fallback.error) {
      return toLoadResult(fallback.data as Record<string, unknown> | null, {
        historyAvailable: true,
      });
    }
    if (!/portfolio_history/i.test(fallback.error.message)) {
      return { status: 'error', error: fallback.error.message };
    }
  }

  if (!/daily_snapshots|portfolio_history/i.test(primary.error.message)) {
    return { status: 'error', error: primary.error.message };
  }

  const stocksOnly = await supabase
    .from('user_portfolios')
    .select('stocks, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (stocksOnly.error) return { status: 'error', error: stocksOnly.error.message };
  return toLoadResult(stocksOnly.data as Record<string, unknown> | null, {
    historyAvailable: false,
  });
}

/** @deprecated use loadPortfolio for explicit error vs empty distinction */
export async function loadPortfolioFromDB(userId: string): Promise<PortfolioStocks | null> {
  const result = await loadPortfolio(userId);
  return result.status === 'ok' ? result.stocks : null;
}

// Save portfolio to Supabase (upsert)
// dailySnapshots도 함께 저장 — 신규 컬럼 미존재 시 컬럼 제외 retry
/**
 * 데모(둘러보기) 종목은 서버에 저장하지 않는다.
 * 온보딩/비로그인 샘플(demo:true)이 실제 계좌 포트폴리오로 동기화되는 오염을 차단.
 * 로컬(Zustand persist) 표시는 그대로 두고, DB upsert 직전에만 걸러낸다.
 */
function stripDemoStocks(stocks: PortfolioStocks): PortfolioStocks {
  return {
    investing: (stocks.investing ?? []).filter(s => !s.demo),
    watching: (stocks.watching ?? []).filter(s => !s.demo),
    sold: (stocks.sold ?? []).filter(s => !s.demo),
  };
}

export async function savePortfolioToDB(
  userId: string,
  stocks: PortfolioStocks,
  dailySnapshots?: DailySnapshot[],
  portfolioHistory?: PortfolioVersionEntry[],
  expectedUpdatedAt?: string | null,
): Promise<SaveResult> {
  const requestedSnapshots = dailySnapshots !== undefined;
  const requestedHistory = portfolioHistory !== undefined;
  const cleanStocks = stripDemoStocks(stocks);
  const normalizedHistory = portfolioHistory !== undefined
    ? normalizePortfolioVersions(portfolioHistory)
    : [];

  // 로그인 동기화 경로는 DB 함수에서 updated_at을 비교해 다중 탭·기기 덮어쓰기를 원자적으로 차단한다.
  if (expectedUpdatedAt !== undefined) {
    const { data, error } = await supabase.rpc('save_user_portfolio_if_current_v2', {
      p_user_id: userId,
      p_stocks: cleanStocks,
      p_daily_snapshots: dailySnapshots ?? [],
      p_portfolio_history: normalizedHistory,
      p_expected_updated_at: expectedUpdatedAt,
    });
    if (error) return { status: 'error', error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') {
      return { status: 'error', error: '포트폴리오 저장 결과를 확인하지 못했습니다.' };
    }
    const result = row as Record<string, unknown>;
    const savedAt = typeof result.saved_updated_at === 'string'
      ? result.saved_updated_at
      : undefined;
    if (result.save_status === 'conflict') {
      return { status: 'conflict', remoteUpdatedAt: savedAt };
    }
    if (result.save_status !== 'ok' || !savedAt) {
      return { status: 'error', error: '포트폴리오 저장 상태가 올바르지 않습니다.' };
    }
    return {
      status: 'ok',
      dailySnapshotsSaved: true,
      portfolioHistorySaved: true,
      updatedAt: savedAt,
    };
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    stocks: cleanStocks,
    updated_at: new Date().toISOString(),
  };
  if (dailySnapshots !== undefined) payload.daily_snapshots = dailySnapshots;
  if (portfolioHistory !== undefined) {
    payload.portfolio_history = normalizedHistory;
  }

  // 신규 컬럼 배포 전에는 해당 필드만 제외하고 순차 재시도한다.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase
      .from('user_portfolios')
      .upsert(payload, { onConflict: 'user_id' });
    if (!error) {
      return {
        status: 'ok',
        dailySnapshotsSaved: !requestedSnapshots || 'daily_snapshots' in payload,
        portfolioHistorySaved: !requestedHistory || 'portfolio_history' in payload,
        updatedAt: payload.updated_at as string,
      };
    }

    if ('portfolio_history' in payload && /portfolio_history/i.test(error.message)) {
      delete payload.portfolio_history;
      continue;
    }
    if ('daily_snapshots' in payload && /daily_snapshots/i.test(error.message)) {
      delete payload.daily_snapshots;
      continue;
    }

    console.error('포트폴리오 저장 오류:', error);
    return { status: 'error', error: error.message };
  }

  return {
    status: 'error',
    error: '포트폴리오 저장 호환 재시도 횟수를 초과했습니다.',
  };
}
