import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ create: vi.fn(), options: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { constructor(options: unknown) { sdk.options(options); } messages = { create: sdk.create }; } }));
import { callClaudeAnalysis } from '@/lib/claudeAnalysis';
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('ANTHROPIC_API_KEY', 'unit-test-only'); });
afterEach(() => vi.unstubAllEnvs());
describe('Haiku analysis transport', () => {
  it('uses the selected explanation model and reports its actual identity without changing chart models', async () => {
    sdk.create.mockResolvedValue({ content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 100 } });
    const result = await callClaudeAnalysis('공개 자료', true, true, false, true, 'medium', 'claude-sonnet-5-5');
    expect(sdk.create.mock.calls[0][0].model).toBe('claude-sonnet-5-5');
    expect(result.model).toBe('claude-sonnet-5-5');
    await callClaudeAnalysis('차트 자료', true, true, true, false, 'medium', 'claude-sonnet-5-5');
    expect(sdk.create.mock.calls[1][0].model).toBe('claude-haiku-5-5');
  });
  it('reads text after thinking, reports billed tokens and exposes truncation to the route validator', async () => {
    sdk.create.mockResolvedValue({ content: [{ type: 'thinking', signature: 'private' }, { type: 'text', text: '{"currentStatus":"부분' }], stop_reason: 'max_tokens',
      usage: { input_tokens: 5000, output_tokens: 4096, cache_read_input_tokens: 500, cache_creation_input_tokens: 0 } });
    const result = await callClaudeAnalysis('공개 자료로 답해주세요.', true);
    expect(result.finishReason).toBe('INCOMPLETE'); expect(result.usage).toEqual({ inputTokens: 5500, outputTokens: 4096, cachedInputTokens: 500, cacheWriteInputTokens: 0 });
    expect(result.text).not.toContain('private'); expect(result.model).toBe('claude-haiku-5-5');
    expect(sdk.options).toHaveBeenCalledWith({ apiKey: 'unit-test-only', timeout: 45000, maxRetries: 0 });
    const request = sdk.create.mock.calls[0][0]; expect(request.service_tier).toBe('standard_only');
    expect(request).not.toHaveProperty('temperature'); expect(request).not.toHaveProperty('tools');
  });
  it('returns only a closed error classification on a provider failure', async () => {
    sdk.create.mockRejectedValue({ status: 401, message: 'secret-key' });
    await expect(callClaudeAnalysis('공개 자료', true)).rejects.toThrow(/^analysis_provider_access_denied$/);
    expect(sdk.create).toHaveBeenCalledOnce();
  });
  it('bounds a chart explanation with higher reasoning while keeping the same model and one request', async () => {
    sdk.create.mockResolvedValue({ content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 100 } });
    await callClaudeAnalysis('공개 차트 관찰', true, true, true);
    expect(sdk.create).toHaveBeenCalledOnce();
    const request = sdk.create.mock.calls[0][0]; expect(request.model).toBe('claude-haiku-5-5'); expect(request.max_tokens).toBe(6144);
    expect(request.output_config.effort).toBe('high'); expect(request.output_config.format.schema.required).toContain('chartViews');
  });
});
