import { createClient } from '@supabase/supabase-js';

export type UserTier = 'free' | 'pro';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function getUserTier(userId: string | undefined): Promise<UserTier> {
  if (!userId || !supabase) return 'free';
  try {
    const { data } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', userId)
      .maybeSingle();
    const tier = (data as { tier?: string } | null)?.tier;
    return tier === 'pro' ? 'pro' : 'free';
  } catch {
    return 'free';
  }
}

export interface TierLimits {
  chokDaily: number;
  analysisDaily: number;
}

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    chokDaily: parseInt(process.env.CHOK_DAILY_FREE || '1', 10),
    analysisDaily: parseInt(process.env.ANALYSIS_DAILY_FREE || '3', 10),
  },
  pro: {
    chokDaily: parseInt(process.env.CHOK_DAILY_PRO || '30', 10),
    analysisDaily: parseInt(process.env.ANALYSIS_DAILY_PRO || '30', 10),
  },
};

export function getTierLimits(tier: UserTier): TierLimits {
  return TIER_LIMITS[tier];
}