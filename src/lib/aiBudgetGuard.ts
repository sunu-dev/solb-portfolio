import { createClient } from '@supabase/supabase-js';
import { monthStartKstIso } from '@/lib/aiCostProjection';

export interface AiBudgetStatus {
  enabled: boolean;
  allowed: boolean;
  budgetUsd: number;
  stopAtUsd: number;
  spentUsd: number;
  remainingUsd: number;
  usagePercent: number;
  reason?: 'budget_reached' | 'ledger_unavailable';
}

const parsePositiveNumber = (value: string | undefined, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function evaluateAiBudget(
  budgetUsd: number,
  spentUsd: number,
  stopRatio = 0.95,
): AiBudgetStatus {
  if (budgetUsd <= 0) {
    return {
      enabled: false,
      allowed: true,
      budgetUsd: 0,
      stopAtUsd: 0,
      spentUsd: Math.max(0, spentUsd),
      remainingUsd: 0,
      usagePercent: 0,
    };
  }

  const safeRatio = Math.min(1, Math.max(0.5, stopRatio));
  const safeSpent = Math.max(0, spentUsd);
  const stopAtUsd = budgetUsd * safeRatio;
  const allowed = safeSpent < stopAtUsd;

  return {
    enabled: true,
    allowed,
    budgetUsd,
    stopAtUsd,
    spentUsd: safeSpent,
    remainingUsd: Math.max(0, budgetUsd - safeSpent),
    usagePercent: Math.round(safeSpent / budgetUsd * 1000) / 10,
    reason: allowed ? undefined : 'budget_reached',
  };
}

/**
 * 월 AI 예산 상태를 조회한다.
 * AI_MONTHLY_BUDGET_USD가 없거나 0이면 비활성이다.
 * 활성 상태에서 원장을 읽지 못하면 비용 보호를 위해 fail-closed 한다.
 */
export async function getAiMonthlyBudgetStatus(): Promise<AiBudgetStatus> {
  const budgetUsd = parsePositiveNumber(process.env.AI_MONTHLY_BUDGET_USD);
  const stopRatio = parsePositiveNumber(process.env.AI_MONTHLY_BUDGET_STOP_RATIO, 0.95);
  const disabled = evaluateAiBudget(budgetUsd, 0, stopRatio);
  if (!disabled.enabled) return disabled;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  if (!url || !key) {
    return { ...disabled, enabled: true, allowed: false, reason: 'ledger_unavailable' };
  }

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('ai_cost_ledger')
      .select('estimated_cost_usd')
      .gte('created_at', monthStartKstIso())
      .limit(50000);

    if (error) {
      console.error('[AI budget] ledger query failed:', error.message);
      return { ...disabled, enabled: true, allowed: false, reason: 'ledger_unavailable' };
    }

    const spentUsd = (data || []).reduce(
      (sum, row) => sum + (Number(row.estimated_cost_usd) || 0),
      0,
    );
    return evaluateAiBudget(budgetUsd, spentUsd, stopRatio);
  } catch (error) {
    console.error('[AI budget] unexpected error:', error instanceof Error ? error.message : error);
    return { ...disabled, enabled: true, allowed: false, reason: 'ledger_unavailable' };
  }
}
