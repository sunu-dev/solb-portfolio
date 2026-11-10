import Anthropic from '@anthropic-ai/sdk';
import { budgetedAttempt, type BudgetPort } from '../marketCause/budgetedAttempt';
import { classifyProviderFailure, type ProviderFailure } from '../marketCause/providerDiagnostics';
import { BUSINESS_SYSTEM, businessPrompt, businessSchemas, type BusinessModel } from './model';
import type { BusinessDraft, BusinessEvidence, BusinessReview } from './types';
import { claudeJsonSchema } from '../claudeJsonSchema';

// Direct Anthropic API: use the user's Console credits, never a gateway fallback.
// Standard text tariff verified 2026-11-03 against platform.claude.com/docs/en/about-claude/pricing.
// Costs use the existing shared ledger's integer USD micro-units. Recheck before expiry.
export const BUSINESS_CLAUDE_TARIFF = { model: 'claude-haiku-5-5', expiresAt: '2026-11-30T00:00:00Z' } as const;
const MAX_OUTPUT = 4096;
type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };
export function estimateBusinessClaudeCost(usage: Usage): number | null {
  const { input_tokens: input, output_tokens: output } = usage;
  const read = usage.cache_read_input_tokens ?? 0, write = usage.cache_creation_input_tokens ?? 0;
  if (![input, output, read, write].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 2_000_000)) return null;
  const tier = input + read + write > 100_000 ? 5 : 1;
  // Cache writes are not requested. If a provider reports them, use the higher 1h tariff.
  return Math.ceil(tier * (input * 100_000 + output * 500_000 + read * 10_000 + write * 200_000) / 1_000_000);
}

export function createClaudeBusinessModel(apiKey: string, budget: BudgetPort): BusinessModel {
  if (!apiKey) throw new Error('business_model_not_configured');
  const ai = new Anthropic({ apiKey, maxRetries: 0, timeout: 45_000 });
  async function invoke(key: string, stage: 'draft' | 'review', prompt: string): Promise<unknown> {
    if (Date.now() >= Date.parse(BUSINESS_CLAUDE_TARIFF.expiresAt)) throw new Error('business_tariff_expired');
    const bytes = Buffer.byteLength(BUSINESS_SYSTEM + prompt);
    if (bytes > 90_000) throw new Error('business_prompt_limit');
    const schema = claudeJsonSchema(businessSchemas[stage]);
    // Each UTF-8 byte is a conservative text-token bound, plus schema and protocol overhead.
    const ceiling = bytes + Buffer.byteLength(JSON.stringify(schema)) + 4096;
    const maxCost = estimateBusinessClaudeCost({ input_tokens: ceiling, output_tokens: MAX_OUTPUT })!;
    let failure: ProviderFailure | undefined;
    const result = await budgetedAttempt({ key, maxCost, budget, call: async () => {
      const response = await ai.messages.create({ model: BUSINESS_CLAUDE_TARIFF.model, max_tokens: MAX_OUTPUT, service_tier: 'standard_only',
        system: BUSINESS_SYSTEM, messages: [{ role: 'user', content: prompt }],
        thinking: stage === 'draft' ? { type: 'disabled' } : { type: 'adaptive' },
        output_config: { effort: stage === 'draft' ? 'low' : 'medium', format: { type: 'json_schema', schema } },
      }).catch(error => { failure = classifyProviderFailure(error); throw error; });
      return { value: { text: response.content.filter(b => b.type === 'text').map(b => b.text).join(''), stop: response.stop_reason },
        actualCost: estimateBusinessClaudeCost(response.usage) };
    } });
    if (result.status !== 'completed') throw new Error(`business_model_${result.status}_${result.reason}${failure ? '_' + failure : ''}`);
    // Refusals/truncation are paid attempts but must never become valid drafts or be retried silently.
    if (result.value.stop !== 'end_turn' || Buffer.byteLength(result.value.text) > 18_000) throw new Error('business_model_incomplete');
    try { return JSON.parse(result.value.text) as unknown; } catch { throw new Error('business_model_invalid_json'); }
  }
  return {
    draft: (key: string, e: BusinessEvidence, repair?: { draft: BusinessDraft; feedback: BusinessReview }) => invoke(key, 'draft', businessPrompt(e, undefined, repair)),
    review: (key, e, draft) => invoke(key, 'review', businessPrompt(e, draft)),
  };
}
