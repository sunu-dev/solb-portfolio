import { supabase } from './supabase';
import type { PortfolioStocks } from '@/config/constants';

export type LoadResult =
  | { status: 'ok'; stocks: PortfolioStocks }
  | { status: 'empty' }       // 정상 응답 + DB row 없음 (첫 로그인)
  | { status: 'error'; error: string }; // 네트워크/RLS/일시적 오류 — save 금지

/**
 * 포트폴리오 DB 로드 — 결과 명확히 구분 (정합성 결함 C1 수정)
 *
 * 기존엔 null만 반환해 "row 없음"과 "쿼리 실패"를 구분 못 했음.
 * 쿼리 실패 시 caller가 save를 호출하면 빈 localStorage가 DB의 실제 데이터를 덮어씀.
 */
export async function loadPortfolio(userId: string): Promise<LoadResult> {
  const { data, error } = await supabase
    .from('user_portfolios')
    .select('stocks')
    .eq('user_id', userId)
    .maybeSingle(); // single() 대신 maybeSingle() — 0행이 error가 아닌 null

  if (error) {
    // PGRST116(0행) 외의 에러 = 네트워크/RLS/권한 문제. save 절대 금지.
    return { status: 'error', error: error.message };
  }
  if (!data || !data.stocks) return { status: 'empty' };
  return { status: 'ok', stocks: data.stocks as PortfolioStocks };
}

/** @deprecated use loadPortfolio for explicit error vs empty distinction */
export async function loadPortfolioFromDB(userId: string): Promise<PortfolioStocks | null> {
  const result = await loadPortfolio(userId);
  return result.status === 'ok' ? result.stocks : null;
}

// Save portfolio to Supabase (upsert)
export async function savePortfolioToDB(userId: string, stocks: PortfolioStocks): Promise<void> {
  const { error } = await supabase
    .from('user_portfolios')
    .upsert({
      user_id: userId,
      stocks,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (error) console.error('포트폴리오 저장 오류:', error);
}
