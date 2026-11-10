import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createClaudeBusinessModel, estimateBusinessClaudeCost } from '@/lib/companyBusiness/claudeModel';
import { createConfiguredBusinessModel } from '@/lib/companyBusiness/provider';
import type { BusinessDraft, BusinessEvidence } from '@/lib/companyBusiness/types';
import { validateDraft } from '@/lib/companyBusiness/validation';
const sdk = vi.hoisted(() => ({ options: vi.fn(), create: vi.fn(), google: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { constructor(options: unknown) { sdk.options(options); } messages = { create: sdk.create }; } }));
vi.mock('@google/genai', () => ({ GoogleGenAI: class { constructor() { sdk.google(); } } }));
const evidence: BusinessEvidence = {
  identity: { symbol: 'TEST', issuerId: '0000000123', name: 'Test', market: 'US', provider: 'sec', identityUrl: 'https://data.sec.gov/submissions/CIK0000000123.json', verifiedAt: '2026-11-03' },
  documentId: '0000000123-26-000001', url: 'https://www.sec.gov/Archives/edgar/data/123/000000012326000001/report.htm', title: 'Report', publishedAt: '2026-02-01', retrievedAt: '2026-11-03', bodyHash: 'a'.repeat(64), passages: [],
};
const response = (text = '{"test":true}', stop = 'end_turn') => ({ content: [{ type: 'thinking', thinking: '', signature: 'hidden' }, { type: 'text', text }], stop_reason: stop,
  usage: { input_tokens: 2_000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
const budget = () => ({ reserve: vi.fn(async (_key: string, _maxCost: number) => ({ status: 'reserved' as const, token: randomUUID() })), settle: vi.fn(async () => true) });
beforeEach(() => { vi.resetAllMocks(); sdk.create.mockResolvedValue(response()); });

describe('Claude company explanation integration', () => {
  it('keeps provider routing explicit, and never falls back when the selected key is missing', () => {
    const b = budget();
    createConfiguredBusinessModel({ anthropicKey: 'test', geminiKey: 'test' }, b);
    expect(sdk.google).toHaveBeenCalledOnce(); expect(sdk.options).not.toHaveBeenCalled();
    expect(() => createConfiguredBusinessModel({ provider: 'anthropic', geminiKey: 'test' }, b)).toThrow('business_model_not_configured');
    expect(() => createConfiguredBusinessModel({ provider: 'misspelled', geminiKey: 'test' }, b)).toThrow('business_provider_not_configured');
    createConfiguredBusinessModel({ provider: 'anthropic', anthropicKey: 'test' }, b);
    expect(sdk.options).toHaveBeenCalledWith({ apiKey: 'test', maxRetries: 0, timeout: 45_000 });
  });
  it('refuses a paid request when the existing shared budget refuses reservation', async () => {
    const b = { reserve: vi.fn(async () => ({ status: 'limit_reached' as const })), settle: vi.fn() };
    await expect(createClaudeBusinessModel('test', b).draft('business:TEST:1:draft', evidence)).rejects.toThrow('business_model_blocked_limit_reached');
    expect(sdk.create).not.toHaveBeenCalled(); expect(b.settle).not.toHaveBeenCalled();
  });
  it('uses Haiku 5.5 schema-compatible settings and settles actual tokens including reasoning', async () => {
    const b = budget(), model = createClaudeBusinessModel('test', b);
    await expect(model.draft('business:TEST:2:draft', evidence)).resolves.toEqual({ test: true });
    const request = sdk.create.mock.calls[0][0];
    expect(request.model).toBe('claude-haiku-5-5'); expect(request.max_tokens).toBe(4096);
    expect(request.thinking).toEqual({ type: 'disabled' }); expect(request.output_config.effort).toBe('low');
    for (const field of ['temperature', 'top_p', 'top_k', 'tools']) expect(request).not.toHaveProperty(field);
    expect(JSON.stringify(request.output_config.format.schema)).not.toMatch(/"(?:minLength|maxLength|minItems|maxItems)":/);
    expect(request.output_config.format.schema.properties.sections.properties.summary.properties.text.description).toContain('maxLength: 220');
    expect(b.settle).toHaveBeenCalledWith('business:TEST:2:draft', expect.any(String), 450);
    expect(b.reserve.mock.calls[0][1]).toBeGreaterThanOrEqual(450);
    await model.review('business:TEST:2:review', evidence, {} as BusinessDraft);
    expect(sdk.create.mock.calls[1][0].thinking).toEqual({ type: 'adaptive' });
    expect(sdk.create.mock.calls[1][0].output_config.effort).toBe('medium');
  });
  it.each(['refusal', 'max_tokens', 'model_context_window_exceeded'])('settles but rejects %s without silently retrying', async stop => {
    const b = budget(); sdk.create.mockResolvedValue(response('{"test":true}', stop));
    await expect(createClaudeBusinessModel('test', b).draft('business:TEST:3:draft', evidence)).rejects.toThrow('business_model_incomplete');
    expect(b.settle).toHaveBeenCalledOnce(); expect(sdk.create).toHaveBeenCalledOnce();
  });
  it('holds uncertain cost on an outage, with a sanitized error and no fallback', async () => {
    const b = budget(); sdk.create.mockRejectedValue({ status: 503, message: 'secret-key-and-private-provider-body' });
    await expect(createConfiguredBusinessModel({ provider: 'anthropic', anthropicKey: 'test', geminiKey: 'test' }, b).draft('business:TEST:4:draft', evidence))
      .rejects.toThrow(/^business_model_unsettled_call_uncertain_provider_unavailable$/);
    expect(b.settle).not.toHaveBeenCalled(); expect(sdk.create).toHaveBeenCalledOnce(); expect(sdk.google).not.toHaveBeenCalled();
  });
  it('does not accept missing usage as a free request', async () => {
    const b = budget(); sdk.create.mockResolvedValue({ ...response(), usage: { input_tokens: 500 } });
    await expect(createClaudeBusinessModel('test', b).draft('business:TEST:5:draft', evidence)).rejects.toThrow('business_model_unsettled_cost_unknown');
    expect(b.settle).not.toHaveBeenCalled();
  });
  it('leaves local length and source validation authoritative even after the provider returns JSON', async () => {
    const b = budget(); sdk.create.mockResolvedValue(response(JSON.stringify({ policy: 'business-v2', symbol: 'TEST', evidenceHash: 'wrong', sections: {} })));
    const value = await createClaudeBusinessModel('test', b).draft('business:TEST:6:draft', evidence);
    expect(validateDraft(value, evidence, '2026-11-03').draft).toBeNull();
  });
  it('prices the 100,000-token boundary, cache tokens and invalid usage in integer micro-dollars', () => {
    expect(estimateBusinessClaudeCost({ input_tokens: 100_000, output_tokens: 1000 })).toBe(10_500);
    expect(estimateBusinessClaudeCost({ input_tokens: 100_001, output_tokens: 1000 })).toBe(52_501);
    expect(estimateBusinessClaudeCost({ input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 99_001 })).toBe(5701);
    expect(estimateBusinessClaudeCost({ input_tokens: 1000, output_tokens: 100, cache_creation_input_tokens: 1000 })).toBe(350);
    expect(estimateBusinessClaudeCost({ input_tokens: NaN, output_tokens: 100 })).toBeNull();
    expect(estimateBusinessClaudeCost({ input_tokens: -1, output_tokens: 100 })).toBeNull();
  });
});
