import { supabase } from './supabase';
import type { PortfolioStocks } from '@/config/constants';

// Load portfolio from Supabase
export async function loadPortfolioFromDB(userId: string): Promise<PortfolioStocks | null> {
  const { data, error } = await supabase
    .from('user_portfolios')
    .select('stocks')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data.stocks as PortfolioStocks;
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
