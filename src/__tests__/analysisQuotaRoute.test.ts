import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

interface UsageRow { user_id: string; date: string; mentor_id: string | null }
const state = vi.hoisted(() => ({
  rows: [] as UsageRow[], serviceAvailable: true, queryFailure: false,
  getUser: vi.fn(), getTier: vi.fn(), from: vi.fn(), insert: vi.fn(),
  generate: vi.fn(), fallback: vi.fn(), gate: vi.fn(), finalize: vi.fn(),
  cost: vi.fn(), audit: vi.fn(), budget: vi.fn(), consent: vi.fn(),
}));

vi.mock('@/lib/supabaseServer', () => ({
  getAuthClient: () => ({ auth: { getUser: state.getUser }, from: state.from }),
  getServiceClient: () => state.serviceAvailable ? { from: state.from } : null,
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContent: state.generate }; },
}));
vi.mock('@/lib/userTier', () => ({
  getUserTier: state.getTier,
  getTierLimits: () => ({ analysisDaily: 3, chokDaily: 1 }),
}));
vi.mock('@/lib/rateLimiter', () => ({ enforceRateLimit: state.gate, POLICIES: { aiAnalysis: {} } }));
vi.mock('@/lib/circuitBreaker', () => ({
  checkCircuit: async () => ({ open: false }), CIRCUIT_POLICIES: { aiStrict: {} },
  circuitOpenResponse: () => new Response(null, { status: 503 }),
}));
vi.mock('@/lib/aiProvider', () => ({ callAiJson: state.fallback, AiProviderError: class extends Error {} }));
vi.mock('@/lib/aiCostLedger', () => ({ recordAiCost: state.cost }));
vi.mock('@/lib/aiOutputAudit', () => ({ sampleAiOutput: state.audit }));
vi.mock('@/lib/aiBudgetGuard', () => ({ getAiMonthlyBudgetStatus: state.budget }));
vi.mock('@/lib/aiAgeGate', () => ({ hasCurrentAdultAiConsent: state.consent }));

let GET: (request: NextRequest) => Promise<Response>;
let POST: (request: NextRequest) => Promise<Response>;
const NOW = Date.parse('2026-10-05T03:00:00Z');
const report = { text: JSON.stringify({ currentStatus: '제공된 기업 지표를 확인했어요.', keyAdvice: [] }) };

beforeAll(async () => {
  vi.stubEnv('GEMINI_API_KEY', 'unit-test-only');
  vi.stubEnv('GEMINI_API_KEY_2', '');
  vi.stubEnv('GEMINI_API_KEY2', '');
  vi.stubEnv('SLACK_WEBHOOK_URL', '');
  vi.stubEnv('AI_DAILY_LIMIT_TOTAL', '250');
  ({ GET, POST } = await import('@/app/api/ai-analysis/route'));
});
afterAll(() => vi.unstubAllEnvs());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  state.rows = [];
  state.serviceAvailable = true;
  state.queryFailure = false;
  state.getUser.mockResolvedValue({ data: { user: { id: 'alice' } } });
  state.getTier.mockResolvedValue('free');
  state.generate.mockResolvedValue(report);
  state.fallback.mockRejectedValue(new Error('provider unavailable'));
  state.gate.mockResolvedValue({ ok: true, finalize: state.finalize });
  state.finalize.mockResolvedValue(undefined);
  state.cost.mockResolvedValue(undefined);
  state.audit.mockResolvedValue(undefined);
  state.budget.mockResolvedValue({ allowed: true });
  state.consent.mockResolvedValue(true);
  state.insert.mockImplementation(async (table: string, row: UsageRow) => {
    if (table === 'ai_usage') state.rows.push(row);
    return { error: null };
  });
  state.from.mockImplementation((table: string) => {
    const equalities: Record<string, unknown> = {};
    let condition: string | undefined;
    const query = {
      select: () => query,
      eq: (field: string, value: unknown) => { equalities[field] = value; return query; },
      or: (value: string) => { condition = value; return query; },
      maybeSingle: async () => ({ data: null, error: null }),
      insert: (row: UsageRow) => state.insert(table, row),
      then: (resolve: (value: { count: number | null; error: { message: string } | null }) => unknown) => {
        if (state.queryFailure) return Promise.resolve({ count: null, error: { message: 'unavailable' } }).then(resolve);
        const excluded = condition?.match(/mentor_id\.not\.in\.\(([^)]+)\)/)?.[1].split(',') ?? [];
        const rows = state.rows.filter(row => {
          const record = row as unknown as Record<string, unknown>;
          if (!Object.entries(equalities).every(([key, value]) => record[key] === value)) return false;
          if (!condition) return true;
          return row.mentor_id === null ? condition.includes('mentor_id.is.null') : !excluded.includes(row.mentor_id);
        });
        return Promise.resolve({ count: rows.length, error: null }).then(resolve);
      },
    };
    return query;
  });
});

function request(method: 'GET' | 'POST' = 'GET', body: Record<string, unknown> = {}, token: string | null = 'alice-token') {
  return new NextRequest('https://joobi.test/api/ai-analysis?userId=someone-else', {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify({ symbol: 'AAPL', price: 220, ...body }) } : {}),
  });
}

function addUsage(mentor_id: string | null, user_id = 'alice', date = '2026-10-05') {
  state.rows.push({ user_id, date, mentor_id });
}

function expectNoGenerationOrWrites() {
  expect(state.generate).not.toHaveBeenCalled();
  expect(state.fallback).not.toHaveBeenCalled();
  expect(state.insert).not.toHaveBeenCalled();
  expect(state.cost).not.toHaveBeenCalled();
  expect(state.audit).not.toHaveBeenCalled();
}

describe('GET /api/ai-analysis quota preflight', () => {
  it('authenticates server-side and reads only the authenticated account without spending any quota', async () => {
    addUsage(null);
    addUsage('safe');
    addUsage('ocr-import');
    addUsage('ai-chok');
    addUsage(null, 'someone-else');
    addUsage(null, 'alice', '2026-10-04');
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, remaining: 1, dailyLimit: 3, tier: 'free', day: '2026-10-05' });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(state.getUser).toHaveBeenCalledWith('alice-token');
    expect(state.getTier).toHaveBeenCalledWith('alice');
    expectNoGenerationOrWrites();
    expect(state.gate).not.toHaveBeenCalled();
    expect(state.finalize).not.toHaveBeenCalled();
    expect(state.budget).not.toHaveBeenCalled();
    expect(state.consent).not.toHaveBeenCalled();
  });

  it('retains older analysis tags in the count and returns zero when the limit is exceeded', async () => {
    for (const tag of [null, 'safe', 'legacy-mentor', 'retired-analysis']) addUsage(tag);
    state.getTier.mockResolvedValue('pro');
    const response = await GET(request());
    expect(await response.json()).toEqual({ success: true, remaining: 0, dailyLimit: 3, tier: 'pro', day: '2026-10-05' });
    expectNoGenerationOrWrites();
  });

  it('does not expose personal zero quota to an unauthenticated client', async () => {
    const response = await GET(request('GET', {}, null));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'AI 분석은 로그인 후 이용할 수 있어요.', code: 'unauthorized', loginForMore: true });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(state.getUser).not.toHaveBeenCalled();
    expect(state.from).not.toHaveBeenCalled();
    expectNoGenerationOrWrites();
  });

  it('rejects a token that fails server authentication', async () => {
    state.getUser.mockResolvedValue({ data: { user: null } });
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(await response.json()).not.toHaveProperty('remaining');
    expect(state.from).not.toHaveBeenCalled();
  });

  it.each(['database', 'service-client'] as const)('keeps unavailable %s distinct from zero remaining', async reason => {
    state.queryFailure = reason === 'database';
    state.serviceAvailable = reason !== 'service-client';
    const response = await GET(request());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe('daily_usage_unavailable');
    expect(body).not.toHaveProperty('remaining');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expectNoGenerationOrWrites();
  });
});

describe('POST uses the same personal daily ledger', () => {
  it('agrees with preflight when null and historical analysis tags exhaust the quota', async () => {
    for (const tag of [null, 'safe', 'legacy-mentor', 'ocr-import', 'ai-chok']) addUsage(tag);
    expect((await (await GET(request())).json()).remaining).toBe(0);
    const response = await POST(request('POST', { mentorId: 'value' }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: 'daily_user_limit', remaining: 0, dailyLimit: 3, day: '2026-10-05' });
    expectNoGenerationOrWrites();
  });

  it('does not make OCR or market observation consume the final available analysis', async () => {
    for (const tag of [null, 'safe', 'ocr-import', 'ocr-import', 'ai-chok']) addUsage(tag);
    expect((await (await GET(request())).json()).remaining).toBe(1);
    const response = await POST(request('POST', { mentorId: 'value' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, remaining: 0, day: '2026-10-05' });
    expect(state.insert).toHaveBeenCalledWith('ai_usage', expect.objectContaining({ user_id: 'alice', mentor_id: 'value', date: '2026-10-05' }));
    expect((await (await GET(request())).json()).remaining).toBe(0);
    expect(state.generate).toHaveBeenCalledTimes(1);
  });

  it.each(['ai-chok', 'ocr-import', 'unknown', 'constructor', '__proto__', 12, {}, true])('rejects an invalid or reserved mentor ID: %j', mentorId => {
    return POST(request('POST', { mentorId })).then(async response => {
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'invalid_mentor' });
      expectNoGenerationOrWrites();
    });
  });

  it.each([undefined, '', '   ', null])('records an absent mentor ID %j as general analysis', async mentorId => {
    expect((await POST(request('POST', { mentorId }))).status).toBe(200);
    expect(state.insert).toHaveBeenCalledWith('ai_usage', expect.objectContaining({ mentor_id: null }));
  });

  it('keeps a request crossing KST midnight attached to the day its quota was checked', async () => {
    vi.setSystemTime(Date.parse('2026-10-05T14:59:59Z'));
    addUsage(null);
    addUsage('safe');
    state.generate.mockImplementation(async () => {
      vi.setSystemTime(Date.parse('2026-10-05T15:00:01Z'));
      return report;
    });
    const response = await POST(request('POST', { mentorId: 'value' }));
    expect(await response.json()).toMatchObject({ remaining: 0, day: '2026-10-05' });
    expect(state.insert).toHaveBeenCalledWith('ai_usage', expect.objectContaining({ date: '2026-10-05' }));
    expect(await (await GET(request())).json()).toMatchObject({ remaining: 3, day: '2026-10-06' });
  });

  it('does not insert a daily usage record when all providers fail', async () => {
    state.generate.mockRejectedValue(new Error('generation unavailable'));
    const response = await POST(request('POST', { mentorId: 'safe' }));
    expect(response.status).toBe(500);
    expect(state.insert).not.toHaveBeenCalled();
    expect(await (await GET(request())).json()).toMatchObject({ remaining: 3 });
  });

  it('preserves the existing policy of counting a generated response even if its JSON is invalid', async () => {
    state.generate.mockResolvedValue({ text: 'not valid JSON' });
    const response = await POST(request('POST', { mentorId: 'safe' }));
    expect(await response.json()).toMatchObject({ success: true, remaining: 2 });
    expect(state.insert.mock.calls.filter(([table]) => table === 'ai_usage')).toHaveLength(1);
  });
});
