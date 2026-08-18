import { createClient } from '@supabase/supabase-js';

export type UserTier = 'free' | 'pro';

export interface MembershipRow {
  tier?: string | null;
  pro_until?: string | null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function getUserTier(userId: string | undefined): Promise<UserTier> {
  if (!userId || !supabase) return 'free';
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('tier, pro_until')
      .eq('id', userId)
      .maybeSingle();
    if (!error) return isProMembershipValid(data as MembershipRow | null) ? 'pro' : 'free';

    // 마이그레이션 적용 전 호환: pro_until 컬럼이 없으면 기존 tier만 조회한다.
    if (/pro_until/i.test(error.message)) {
      const fallback = await supabase.from('profiles').select('tier').eq('id', userId).maybeSingle();
      return (fallback.data as MembershipRow | null)?.tier === 'pro' ? 'pro' : 'free';
    }
    return 'free';
  } catch {
    return 'free';
  }
}

export function isProMembershipValid(row: MembershipRow | null, now = Date.now()): boolean {
  if (row?.tier !== 'pro') return false;
  if (!row.pro_until) return true; // 기존 수동 PRO 호환
  const expiresAt = Date.parse(row.pro_until);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export interface TierLimits {
  chokDaily: number;
  analysisDaily: number;
}

// 투자 관련 AI 접근량은 멤버십 대가와 분리한다. PRO는 기록·내보내기 등
// 비투자 도구에서만 차등하고, 분석·시장 관찰판의 한도/품질은 전 등급 동일하다.
const SHARED_AI_LIMITS: TierLimits = {
  chokDaily: parseInt(process.env.CHOK_DAILY_FREE || '1', 10),
  analysisDaily: parseInt(process.env.ANALYSIS_DAILY_FREE || '3', 10),
};

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: { ...SHARED_AI_LIMITS },
  pro: { ...SHARED_AI_LIMITS },
};

export function getTierLimits(tier: UserTier): TierLimits {
  return TIER_LIMITS[tier];
}
