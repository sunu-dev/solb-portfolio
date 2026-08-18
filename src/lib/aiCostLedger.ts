import { createClient } from '@supabase/supabase-js';

export type AiCostProvider = 'gemini' | 'claude';

export interface AiTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
}

export interface AiCostEntry extends AiTokenUsage {
  feature: string;
  provider: AiCostProvider;
  model: string;
  userId?: string;
  latencyMs: number;
  cacheHit?: boolean;
  success?: boolean;
  errorCode?: string;
}

interface ModelPrice {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  cachedInputPerMillionUsd?: number;
}

// 2026-07-16 기준 기본값. 공급자 가격 변경 시 배포 없이 환경변수로 덮어쓸 수 있다.
const MODEL_PRICES: Record<string, ModelPrice> = {
  'gemini-2.5-flash-lite': {
    inputPerMillionUsd: Number(process.env.AI_PRICE_GEMINI_25_FLASH_LITE_INPUT || '0.10'),
    outputPerMillionUsd: Number(process.env.AI_PRICE_GEMINI_25_FLASH_LITE_OUTPUT || '0.40'),
    cachedInputPerMillionUsd: Number(process.env.AI_PRICE_GEMINI_25_FLASH_LITE_CACHED_INPUT || '0.025'),
  },
  'gemini-2.5-flash': {
    inputPerMillionUsd: Number(process.env.AI_PRICE_GEMINI_25_FLASH_INPUT || '0.30'),
    outputPerMillionUsd: Number(process.env.AI_PRICE_GEMINI_25_FLASH_OUTPUT || '2.50'),
    cachedInputPerMillionUsd: Number(process.env.AI_PRICE_GEMINI_25_FLASH_CACHED_INPUT || '0.075'),
  },
  'claude-haiku-4-5': {
    inputPerMillionUsd: Number(process.env.AI_PRICE_CLAUDE_HAIKU_45_INPUT || '1.00'),
    outputPerMillionUsd: Number(process.env.AI_PRICE_CLAUDE_HAIKU_45_OUTPUT || '5.00'),
    cachedInputPerMillionUsd: Number(process.env.AI_PRICE_CLAUDE_HAIKU_45_CACHE_READ || '0.10'),
  },
};

const safeTokenCount = (value: number | undefined): number =>
  Number.isFinite(value) && (value ?? 0) > 0 ? Math.floor(value!) : 0;

export function estimateAiCostUsd(model: string, usage: AiTokenUsage): number {
  const price = MODEL_PRICES[model];
  if (!price) return 0;

  const cached = safeTokenCount(usage.cachedInputTokens);
  const input = Math.max(0, safeTokenCount(usage.inputTokens) - cached);
  const output = safeTokenCount(usage.outputTokens) + safeTokenCount(usage.reasoningTokens);
  const cachedRate = price.cachedInputPerMillionUsd ?? price.inputPerMillionUsd;

  return (
    input * price.inputPerMillionUsd
    + cached * cachedRate
    + output * price.outputPerMillionUsd
  ) / 1_000_000;
}

/** AI 응답 경로를 방해하지 않는 best-effort 비용 기록. */
export async function recordAiCost(entry: AiCostEntry): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  if (!url || !key) return;

  const usage = {
    inputTokens: safeTokenCount(entry.inputTokens),
    outputTokens: safeTokenCount(entry.outputTokens),
    cachedInputTokens: safeTokenCount(entry.cachedInputTokens),
    reasoningTokens: safeTokenCount(entry.reasoningTokens),
  };

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await supabase.from('ai_cost_ledger').insert({
      feature: entry.feature,
      provider: entry.provider,
      model: entry.model,
      user_id: entry.userId || null,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cached_input_tokens: usage.cachedInputTokens,
      reasoning_tokens: usage.reasoningTokens,
      estimated_cost_usd: estimateAiCostUsd(entry.model, usage),
      latency_ms: Math.max(0, Math.floor(entry.latencyMs)),
      cache_hit: entry.cacheHit ?? usage.cachedInputTokens > 0,
      success: entry.success ?? true,
      error_code: entry.errorCode || null,
    });
    if (error) console.error('[AI cost ledger] insert failed:', error.message);
  } catch (error) {
    console.error('[AI cost ledger] unexpected error:', error instanceof Error ? error.message : error);
  }
}

