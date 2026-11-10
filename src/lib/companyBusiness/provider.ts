import type { BudgetPort } from '../marketCause/budgetedAttempt';
import { createBusinessModel } from './model';
import { createClaudeBusinessModel } from './claudeModel';

/** Explicit routing: a key alone cannot change a provider or activate a fallback. */
export function createConfiguredBusinessModel(config: { provider?: string; anthropicKey?: string; geminiKey?: string }, budget: BudgetPort) {
  if (config.provider === 'anthropic') return createClaudeBusinessModel(config.anthropicKey ?? '', budget);
  if (!config.provider || config.provider === 'gemini') return createBusinessModel(config.geminiKey ?? '', budget);
  throw new Error('business_provider_not_configured');
}
