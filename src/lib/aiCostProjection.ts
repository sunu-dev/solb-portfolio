export interface AiCostProjection {
  monthSpentUsd: number;
  monthCalls: number;
  avgCostPerCallUsd: number | null;
  projectedMonthEndUsd: number | null;
  remainingCallsAtBudget: number | null;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function monthStartKstIso(now = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const utcAtKstMonthStart = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - KST_OFFSET_MS;
  return new Date(utcAtKstMonthStart).toISOString();
}

export function projectAiMonthlyCost(params: {
  monthSpentUsd: number;
  monthCalls: number;
  budgetStopAtUsd?: number;
  now?: Date;
}): AiCostProjection {
  const now = params.now ?? new Date();
  const spent = Number.isFinite(params.monthSpentUsd) ? Math.max(0, params.monthSpentUsd) : 0;
  const calls = Number.isFinite(params.monthCalls) ? Math.max(0, Math.floor(params.monthCalls)) : 0;
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const elapsedDays = Math.max(
    1 / 24,
    kst.getUTCDate() - 1
      + (kst.getUTCHours() * 60 + kst.getUTCMinutes()) / (24 * 60),
  );
  const avgCostPerCallUsd = calls > 0 ? spent / calls : null;
  const projectedMonthEndUsd = calls > 0 ? spent / elapsedDays * daysInMonth : null;
  const stopAt = params.budgetStopAtUsd;
  const remainingCallsAtBudget = avgCostPerCallUsd && stopAt != null && stopAt > 0
    ? Math.max(0, Math.floor((stopAt - spent) / avgCostPerCallUsd))
    : null;

  return {
    monthSpentUsd: spent,
    monthCalls: calls,
    avgCostPerCallUsd,
    projectedMonthEndUsd,
    remainingCallsAtBudget,
  };
}
