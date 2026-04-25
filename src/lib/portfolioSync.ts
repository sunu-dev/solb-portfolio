import { supabase } from './supabase';
import type { PortfolioStocks } from '@/config/constants';
import type { DailySnapshot } from '@/utils/dailySnapshot';

export type LoadResult =
  | { status: 'ok'; stocks: PortfolioStocks; dailySnapshots: DailySnapshot[] }
  | { status: 'empty' }       // 정상 응답 + DB row 없음 (첫 로그인)
  | { status: 'error'; error: string }; // 네트워크/RLS/일시적 오류 — save 금지

/**
 * 포트폴리오 DB 로드 — 결과 명확히 구분 (정합성 결함 C1 수정)
 *
 * stocks와 daily_snapshots를 함께 로드. 후자는 신규 컬럼이라 missing 가능 → 빈 배열 fallback.
 */
export async function loadPortfolio(userId: string): Promise<LoadResult> {
  const { data, error } = await supabase
    .from('user_portfolios')
    .select('stocks, daily_snapshots')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    // 컬럼 missing 에러는 무시하고 stocks만 가져오는 fallback
    if (/daily_snapshots/i.test(error.message)) {
      const fb = await supabase
        .from('user_portfolios').select('stocks').eq('user_id', userId).maybeSingle();
      if (fb.error) return { status: 'error', error: fb.error.message };
      if (!fb.data?.stocks) return { status: 'empty' };
      return { status: 'ok', stocks: fb.data.stocks as PortfolioStocks, dailySnapshots: [] };
    }
    return { status: 'error', error: error.message };
  }
  if (!data || !data.stocks) return { status: 'empty' };
  const snapshots = Array.isArray(data.daily_snapshots) ? data.daily_snapshots as DailySnapshot[] : [];
  return { status: 'ok', stocks: data.stocks as PortfolioStocks, dailySnapshots: snapshots };
}

/** @deprecated use loadPortfolio for explicit error vs empty distinction */
export async function loadPortfolioFromDB(userId: string): Promise<PortfolioStocks | null> {
  const result = await loadPortfolio(userId);
  return result.status === 'ok' ? result.stocks : null;
}

// Save portfolio to Supabase (upsert)
// dailySnapshots도 함께 저장 — 신규 컬럼 미존재 시 컬럼 제외 retry
export async function savePortfolioToDB(
  userId: string,
  stocks: PortfolioStocks,
  dailySnapshots?: DailySnapshot[],
): Promise<void> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    stocks,
    updated_at: new Date().toISOString(),
  };
  if (dailySnapshots !== undefined) payload.daily_snapshots = dailySnapshots;

  const { error } = await supabase
    .from('user_portfolios')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    // 신규 컬럼 missing이면 stocks만으로 retry (마이그레이션 전 호환)
    if (dailySnapshots !== undefined && /daily_snapshots/i.test(error.message)) {
      const retry = await supabase.from('user_portfolios').upsert({
        user_id: userId, stocks, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (retry.error) console.error('포트폴리오 저장 오류 (fallback):', retry.error);
      return;
    }
    console.error('포트폴리오 저장 오류:', error);
  }
}
