import { NextResponse } from 'next/server';
import { requireServiceClient } from '@/lib/supabaseServer';
import { defineRoute } from '@/lib/apiRoute';
import { getClaudeUsageToday, getProviderStatus } from '@/lib/aiProvider';
import { getAiMonthlyBudgetStatus } from '@/lib/aiBudgetGuard';
import { getAiSafetyStatus } from '@/lib/aiSafetyStatus';
import { monthStartKstIso, projectAiMonthlyCost } from '@/lib/aiCostProjection';

// 모듈 스코프에서 클라이언트를 만들면 키가 없을 때 **빌드 전체가 실패**한다
// (Next가 page data 수집 중 이 모듈을 import한다). 요청 시점 지연 생성으로 국소화.
const supabaseAdmin = () => requireServiceClient();

interface ApiCallRow {
  endpoint: string;
  user_key: string;
  user_id: string | null;
  ip: string | null;
  status: number;
  latency_ms: number | null;
  error_code: string | null;
  created_at: string;
}

interface AiCostRow {
  feature: string;
  provider: 'gemini' | 'claude';
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  reasoning_tokens: number;
  estimated_cost_usd: number | string;
  latency_ms: number;
  cache_hit: boolean;
  success: boolean;
}

export const GET = defineRoute({
  name: '/api/admin/api-stats',
  auth: 'admin',
  handler: async ({ req }) => {
  const hours = parseInt(req.nextUrl.searchParams.get('hours') || '24');
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    // 독립 쿼리는 병렬 실행. 비용 원장 마이그레이션 전에도 기존 API 통계는 정상 제공한다.
    const [apiCallsResult, aiCostsResult, monthCostsResult] = await Promise.all([
      supabaseAdmin()
        .from('api_calls')
        .select('endpoint, user_key, user_id, ip, status, latency_ms, error_code, created_at')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(50000),
      supabaseAdmin()
        .from('ai_cost_ledger')
        .select('feature, provider, model, input_tokens, output_tokens, cached_input_tokens, reasoning_tokens, estimated_cost_usd, latency_ms, cache_hit, success')
        .gte('created_at', sinceIso)
        .limit(50000),
      supabaseAdmin()
        .from('ai_cost_ledger')
        .select('estimated_cost_usd')
        .gte('created_at', monthStartKstIso())
        .limit(50000),
    ]);

    const rows = (apiCallsResult.data || []) as ApiCallRow[];
    const total = rows.length;
    const successes = rows.filter(r => r.status >= 200 && r.status < 400).length;
    const errors = total - successes;
    const successRate = total > 0 ? (successes / total) * 100 : 100;

    // 엔드포인트별 집계
    const byEndpoint: Record<string, { count: number; errors: number; latencies: number[] }> = {};
    for (const r of rows) {
      const e = r.endpoint;
      if (!byEndpoint[e]) byEndpoint[e] = { count: 0, errors: 0, latencies: [] };
      byEndpoint[e].count++;
      if (r.status >= 400) byEndpoint[e].errors++;
      if (r.latency_ms != null) byEndpoint[e].latencies.push(r.latency_ms);
    }
    const endpoints = Object.entries(byEndpoint).map(([endpoint, v]) => {
      const lats = v.latencies.slice().sort((a, b) => a - b);
      const p50 = lats.length ? lats[Math.floor(lats.length * 0.5)] : null;
      const p95 = lats.length ? lats[Math.floor(lats.length * 0.95)] : null;
      const avg = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : null;
      return {
        endpoint,
        count: v.count,
        errors: v.errors,
        errorRate: v.count > 0 ? (v.errors / v.count) * 100 : 0,
        p50, p95, avg,
      };
    }).sort((a, b) => b.count - a.count);

    // Top user_keys
    const byUser: Record<string, number> = {};
    for (const r of rows) {
      byUser[r.user_key] = (byUser[r.user_key] || 0) + 1;
    }
    const topUsers = Object.entries(byUser)
      .map(([userKey, count]) => ({
        userKey,
        count,
        isAnon: userKey.startsWith('ip:'),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 에러 코드 분포
    const errorCodes: Record<string, number> = {};
    for (const r of rows) {
      if (r.error_code) errorCodes[r.error_code] = (errorCodes[r.error_code] || 0) + 1;
    }
    const errorDist = Object.entries(errorCodes)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);

    // 시간별 히스토그램 (버킷 = 1시간)
    const buckets: Record<number, { total: number; errors: number }> = {};
    for (let i = 0; i < hours; i++) buckets[i] = { total: 0, errors: 0 };
    const now = Date.now();
    for (const r of rows) {
      const ageMs = now - new Date(r.created_at).getTime();
      const bucket = Math.floor(ageMs / (60 * 60 * 1000));
      if (bucket < 0 || bucket >= hours) continue;
      buckets[bucket].total++;
      if (r.status >= 400) buckets[bucket].errors++;
    }
    // 최근 → 과거 순으로 반환 (UI는 뒤집어 과거→최근)
    const timeline = Array.from({ length: hours }, (_, i) => {
      const b = buckets[i];
      const at = new Date(now - i * 60 * 60 * 1000);
      return {
        hoursAgo: i,
        label: `${at.getMonth() + 1}/${at.getDate()} ${String(at.getHours()).padStart(2, '0')}시`,
        total: b.total,
        errors: b.errors,
      };
    }).reverse();

    // Claude fallback 사용량
    const providerStatus = getProviderStatus();
    const [claudeUsage, monthlyBudget] = await Promise.all([
      getClaudeUsageToday(),
      getAiMonthlyBudgetStatus(),
    ]);

    // 실제 토큰 기반 AI 비용 집계
    const aiCostRows = (aiCostsResult.data || []) as AiCostRow[];
    const costGroups = new Map<string, {
      feature: string;
      provider: string;
      model: string;
      calls: number;
      costUsd: number;
      inputTokens: number;
      outputTokens: number;
      cachedInputTokens: number;
      reasoningTokens: number;
      latencyTotal: number;
      cacheHits: number;
    }>();
    let totalCostUsd = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCachedInputTokens = 0;
    let totalReasoningTokens = 0;
    let totalAiLatency = 0;
    let totalCacheHits = 0;

    for (const row of aiCostRows) {
      const costUsd = Number(row.estimated_cost_usd) || 0;
      totalCostUsd += costUsd;
      totalInputTokens += row.input_tokens || 0;
      totalOutputTokens += row.output_tokens || 0;
      totalCachedInputTokens += row.cached_input_tokens || 0;
      totalReasoningTokens += row.reasoning_tokens || 0;
      totalAiLatency += row.latency_ms || 0;
      if (row.cache_hit) totalCacheHits++;

      const key = `${row.feature}\u0000${row.provider}\u0000${row.model}`;
      const group = costGroups.get(key) || {
        feature: row.feature,
        provider: row.provider,
        model: row.model,
        calls: 0,
        costUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        reasoningTokens: 0,
        latencyTotal: 0,
        cacheHits: 0,
      };
      group.calls++;
      group.costUsd += costUsd;
      group.inputTokens += row.input_tokens || 0;
      group.outputTokens += row.output_tokens || 0;
      group.cachedInputTokens += row.cached_input_tokens || 0;
      group.reasoningTokens += row.reasoning_tokens || 0;
      group.latencyTotal += row.latency_ms || 0;
      if (row.cache_hit) group.cacheHits++;
      costGroups.set(key, group);
    }

    const aiCostBreakdown = Array.from(costGroups.values())
      .map(group => ({
        feature: group.feature,
        provider: group.provider,
        model: group.model,
        calls: group.calls,
        costUsd: group.costUsd,
        inputTokens: group.inputTokens,
        outputTokens: group.outputTokens,
        cachedInputTokens: group.cachedInputTokens,
        reasoningTokens: group.reasoningTokens,
        avgLatencyMs: group.calls ? Math.round(group.latencyTotal / group.calls) : 0,
        cacheHitRate: group.calls ? Math.round(group.cacheHits / group.calls * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.costUsd - a.costUsd);
    const monthCostRows = monthCostsResult.data || [];
    const projection = projectAiMonthlyCost({
      monthSpentUsd: monthCostRows.reduce((sum, row) => sum + (Number(row.estimated_cost_usd) || 0), 0),
      monthCalls: monthCostRows.length,
      budgetStopAtUsd: monthlyBudget.enabled ? monthlyBudget.stopAtUsd : undefined,
    });

    return NextResponse.json({
      hours,
      total,
      successes,
      errors,
      successRate: Math.round(successRate * 10) / 10,
      endpoints,
      topUsers,
      errorDist,
      timeline,
      provider: {
        gemini: { keys: providerStatus.geminiKeys },
        claude: {
          available: providerStatus.claudeAvailable,
          used: claudeUsage.used,
          limit: claudeUsage.limit,
          remaining: claudeUsage.remaining,
          estimatedCostUsd: claudeUsage.estimatedCostUsd,
        },
      },
      aiCost: {
        available: !aiCostsResult.error,
        message: aiCostsResult.error ? 'ai_cost_ledger 마이그레이션을 적용하면 비용 데이터가 표시돼요.' : null,
        calls: aiCostRows.length,
        totalCostUsd,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cachedInputTokens: totalCachedInputTokens,
        reasoningTokens: totalReasoningTokens,
        avgLatencyMs: aiCostRows.length ? Math.round(totalAiLatency / aiCostRows.length) : 0,
        cacheHitRate: aiCostRows.length ? Math.round(totalCacheHits / aiCostRows.length * 1000) / 10 : 0,
        breakdown: aiCostBreakdown,
        monthlyBudget,
        projection: monthCostsResult.error ? null : projection,
      },
      safety: getAiSafetyStatus(),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('API stats error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
},
});
