import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

interface UsageRow { user_id: string; date: string; mentor_id: string | null; request_id?: string }
const state = vi.hoisted(() => ({
  rows: [] as UsageRow[], serviceAvailable: true, queryFailure: false, queryPending: false, receiptPending: false,
  getUser: vi.fn(), getTier: vi.fn(), from: vi.fn(), insert: vi.fn(),
  generate: vi.fn(), fallback: vi.fn(), gate: vi.fn(), finalize: vi.fn(),
  cost: vi.fn(), audit: vi.fn(), budget: vi.fn(), consent: vi.fn(),
  evidence: vi.fn(), articles: vi.fn(), claude: vi.fn(), business: vi.fn(), intraday: vi.fn(),
  signals: [] as AbortSignal[],
  qualityAfter: [] as (() => Promise<void>)[], qualityWrite: vi.fn(),
}));

vi.mock('next/server', async importOriginal => ({
  ...await importOriginal<typeof import('next/server')>(),
  after: (work: () => Promise<void>) => { state.qualityAfter.push(work); },
}));
vi.mock('@/lib/assistantQualityServer', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/assistantQualityServer')>(), persistQualityEvent: state.qualityWrite,
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
vi.mock('@/lib/rateLimiter', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/rateLimiter')>(),
  enforceRateLimit: state.gate, POLICIES: { aiAnalysis: {} },
}));
vi.mock('@/lib/circuitBreaker', () => ({
  checkCircuit: async () => ({ open: false }), CIRCUIT_POLICIES: { aiStrict: {} },
  circuitOpenResponse: () => new Response(null, { status: 503 }),
}));
vi.mock('@/lib/aiProvider', () => ({ callAiJson: state.fallback, AiProviderError: class extends Error {} }));
vi.mock('@/lib/aiCostLedger', () => ({ recordAiCost: state.cost }));
vi.mock('@/lib/aiOutputAudit', () => ({ sampleAiOutput: state.audit }));
vi.mock('@/lib/aiBudgetGuard', () => ({ getAiMonthlyBudgetStatus: state.budget }));
vi.mock('@/lib/aiAgeGate', () => ({ checkCurrentAdultAiConsent: state.consent }));
vi.mock('@/lib/claudeAnalysis', () => ({ callClaudeAnalysis: state.claude }));
vi.mock('@/lib/companyAnalysisContext', () => ({ companyAnalysisContext: state.business }));
vi.mock('@/lib/assistantEvidenceSource', () => ({ collectAssistantEvidence: state.evidence }));
vi.mock('@/lib/assistantArticleSources', () => ({ collectAssistantArticles: state.articles }));
vi.mock('@/lib/intradaySource', () => ({ readLatestIntraday: state.intraday }));

let GET: (request: NextRequest) => Promise<Response>;
let POST: (request: NextRequest) => Promise<Response>;
const NOW = Date.parse('2026-10-05T03:00:00Z');
const report = { text: JSON.stringify({ assistantInsights: [], followUps: ['어떤 자료인가요?', '공식 자료는 어디에서 봐요?'], currentStatus: '제공된 기업 지표를 확인했어요.', keyAdvice: ['공식 실적 자료를 확인할 수 있어요.'], indicators: [{ name: 'RSI', value: '자료 미확인', signal: 'neutral' }], conclusion: { label: '정보 정리', signal: 'neutral', desc: '추가 자료가 필요해요.' } }) };

beforeAll(async () => {
  vi.stubEnv('GEMINI_API_KEY', 'unit-test-only');
  if (!process.env.ANTHROPIC_API_KEY) vi.stubEnv('ANTHROPIC_API_KEY', 'unit-test-only');
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
  vi.stubEnv('JOOBI_QUESTION_QUALITY_ENABLED', 'false');
  state.qualityAfter = []; state.qualityWrite.mockResolvedValue(true);
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  state.rows = [];
  state.serviceAvailable = true;
  state.queryFailure = false;
  state.queryPending = false;
  state.receiptPending = false;
  state.signals = [];
  state.getUser.mockResolvedValue({ data: { user: { id: 'alice' } } });
  state.getTier.mockResolvedValue('free');
  state.generate.mockResolvedValue(report);
  state.claude.mockResolvedValue({ ...report, finishReason: 'STOP', provider: 'claude', model: 'claude-haiku-5-5', latencyMs: 100, usage: { inputTokens: 1000, outputTokens: 500 } });
  state.fallback.mockRejectedValue(new Error('provider unavailable'));
  state.gate.mockResolvedValue({ ok: true, finalize: state.finalize });
  state.finalize.mockResolvedValue(undefined);
  state.cost.mockResolvedValue(undefined);
  state.audit.mockResolvedValue(undefined);
  state.budget.mockResolvedValue({ allowed: true });
  state.consent.mockResolvedValue({ status: 'granted' });
  vi.stubEnv('AI_ANALYSIS_PROVIDER', 'gemini');
  state.business.mockResolvedValue({ prompt: '회사 사업 자료는 제공되지 않았어요.', sources: [] });
  state.intraday.mockResolvedValue({ status: 'none' });
  state.evidence.mockResolvedValue({ version: 1, symbol: 'MU', period: '1d', checkedAt: new Date(NOW).toISOString(), comparisons: [], evidence: [], gaps: [] });
  state.articles.mockResolvedValue([]);
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
      abortSignal: (signal: AbortSignal) => { state.signals.push(signal); return query; },
      maybeSingle: async () => {
        if (table !== 'ai_usage') return { data: null, error: null };
        if (state.receiptPending) return new Promise(() => {});
        const match = state.rows.find(row => Object.entries(equalities).every(([key, value]) => (row as unknown as Record<string, unknown>)[key] === value));
        return { data: match ?? null, error: null };
      },
      insert: (row: UsageRow) => ({ abortSignal: (signal: AbortSignal) => {
        state.signals.push(signal); return state.insert(table, row);
      } }),
      then: (resolve: (value: { count: number | null; error: { message: string } | null }) => unknown) => {
        if (state.queryPending) return new Promise(() => {});
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
  expect(state.articles).not.toHaveBeenCalled();
  expect(state.fallback).not.toHaveBeenCalled();
  expect(state.insert).not.toHaveBeenCalled();
  expect(state.cost).not.toHaveBeenCalled();
  expect(state.audit).not.toHaveBeenCalled();
}

it.runIf(process.env.CHART_LIVE_TEST === '1')('checks real Haiku chart explanations using public server-fetched five-minute prices', async () => {
  vi.useRealTimers(); vi.stubEnv('AI_ANALYSIS_PROVIDER', 'anthropic');
  const { readLatestIntraday } = await vi.importActual<typeof import('@/lib/intradaySource')>('@/lib/intradaySource');
  const { chartSessionFacts } = await import('@/lib/chartAnalysis');
  const { callClaudeAnalysis: realClaude } = await vi.importActual<typeof import('@/lib/claudeAnalysis')>('@/lib/claudeAnalysis');
  const { estimateAiCostUsd } = await vi.importActual<typeof import('@/lib/aiCostLedger')>('@/lib/aiCostLedger');
  const fixturePath = process.env.CHART_LIVE_FIXTURE;
  const fixtures = fixturePath ? JSON.parse(readFileSync(fixturePath, 'utf8')).results : null;
  const results: unknown[] = []; let calls = 0, total = 0;
  state.claude.mockImplementation(async (prompt, mentor, selected, chart) => {
    if (++calls > 4) throw new Error('live_chart_limit');
    const answer = await realClaude(prompt, mentor, selected, chart); total += estimateAiCostUsd(answer.model, answer.usage); return answer;
  });
  const symbols = process.env.CHART_LIVE_SYMBOLS === 'siseon' ? ['340810.KQ'] : process.env.CHART_LIVE_SYMBOLS === 'focused' ? ['SOXL', 'AAPL'] : ['340810.KQ', 'SOXL', 'AAPL', 'NVDA'];
  for (const symbol of symbols) {
    const source = fixtures ? { status: 'ok' as const, data: fixtures.find((item: { symbol: string }) => item.symbol === symbol)?.source, resolvedSymbol: symbol } : await readLatestIntraday(symbol);
    if (source.status !== 'ok' || !source.data) throw new Error('public_chart_source_unavailable:' + symbol);
    state.rows = []; state.cost.mockClear(); state.intraday.mockResolvedValue(source);
    const chartViews = symbol === 'AAPL' ? ['rsi', 'volume'] : symbol === 'NVDA' ? ['bollinger', 'macd'] : undefined;
    const response = await POST(request('POST', { symbol, price: source.data.c.at(-1), mentorId: 'trend', questionId: 'chart-session', chartSessionDate: source.data.sessionDate, chartViews }));
    const body = await response.json(), cost = state.cost.mock.calls.at(-1)?.[0];
    results.push({ symbol, requestedViews: chartViews, status: response.status, source: source.data, facts: chartSessionFacts(source.data), report: body.report,
      returnedSnapshot: body.chart?.snapshotId, estimatedCostUsd: cost ? estimateAiCostUsd(cost.model, cost) : null, error: body.code });
  }
  const dir = 'artifacts/chart-studies-20261103'; mkdirSync(dir, { recursive: true });
  const reportFile = process.env.CHART_LIVE_SYMBOLS === 'siseon' ? 'live-siseon.json' : 'live-results.json';
  writeFileSync(`${dir}/${reportFile}`, JSON.stringify({ checkedAt: new Date().toISOString(), mode: fixturePath ? 'previously captured real Yahoo data and real Haiku; simulated authentication/quota/cost stores' : 'real Yahoo data and Haiku; simulated authentication/quota/cost stores',
    generationCalls: calls, estimatedCostUsd: total, productionWrites: 0, results }, null, 2));
  expect(calls).toBe(symbols.length); expect(total).toBeLessThan(0.05); expect(results.every(r => (r as { status: number }).status === 200)).toBe(true);
}, 240_000);

// Explicit opt-in only: real model, public source fixtures, simulated auth/quota stores.
// No production account, portfolio, usage ledger, email, queue or published content is touched.
it.runIf(process.env.CLAUDE_LIVE_TEST === '1')('checks five real Haiku API answers through the analysis route contract', async () => {
  vi.useRealTimers(); vi.stubEnv('AI_ANALYSIS_PROVIDER', 'anthropic');
  const { callClaudeAnalysis: realClaude } = await vi.importActual<typeof import('@/lib/claudeAnalysis')>('@/lib/claudeAnalysis');
  const { formatCompanyAnalysisContext } = await vi.importActual<typeof import('@/lib/companyAnalysisContext')>('@/lib/companyAnalysisContext');
  const { companyBusinessProfile } = await import('@/lib/companyBusinessProfile');
  const { storedIndustryFields } = await import('@/lib/storedIndustry');
  const { estimateAiCostUsd } = await vi.importActual<typeof import('@/lib/aiCostLedger')>('@/lib/aiCostLedger');
  const results: unknown[] = []; let calls = 0, total = 0;
  state.business.mockImplementation(async symbol => {
    const business = companyBusinessProfile(symbol, storedIndustryFields(symbol).classification);
    return { prompt: formatCompanyAnalysisContext(symbol, business), sources: business.sources };
  });
  state.claude.mockImplementation(async (prompt, mentor, questionAnswer) => {
    if (++calls > 5 || total > 0.08) throw new Error('live_test_limit');
    const answer = await realClaude(prompt, mentor, questionAnswer); total += estimateAiCostUsd(answer.model, answer.usage); return answer;
  });
  const cases = [
    { symbol: '340810.KQ', koreanName: '시선AI', price: 2750, mentorId: 'growth', questionId: 'growth' },
    { symbol: '340810.KQ', koreanName: '시선AI', price: 2750, mentorId: 'value', questionId: 'value' },
    { symbol: 'SOXL', koreanName: 'SOXL', price: 80, mentorId: 'value', questionId: 'fund-returns' },
    { symbol: 'NFLX', koreanName: '넷플릭스', price: 100, mentorId: 'growth', questionId: 'growth' },
    { symbol: 'UNKNOWN', koreanName: '자료 없는 테스트 종목', price: 100, mentorId: 'growth', questionId: 'growth' },
  ];
  for (const c of cases) {
    state.rows = []; state.claude.mockClear(); state.cost.mockClear();
    const started = Date.now(), response = await POST(request('POST', c)), body = await response.json();
    const cost = state.cost.mock.calls.at(-1)?.[0];
    results.push({ symbol: c.symbol, question: c.questionId, httpStatus: response.status, elapsedMs: Date.now() - started,
      model: body.report?._meta?.aiModel, report: body.report, error: body.code, usage: cost ? { inputTokens: cost.inputTokens, outputTokens: cost.outputTokens } : null,
      estimatedCostUsd: cost ? estimateAiCostUsd(cost.model, cost) : null });
    console.log(JSON.stringify({ liveCase: c.symbol, question: c.questionId, httpStatus: response.status }));
  }
  const dir = process.env.CLAUDE_LIVE_TEST_OUTPUT || 'artifacts/claude-haiku-cost-20261103'; mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/live-analysis-route-test.json`, JSON.stringify({ checkedAt: new Date().toISOString(), mode: 'real API; simulated auth/quota/source lookup',
    generationCalls: calls, estimatedCostUsd: total, productionWrites: 0, results }, null, 2));
  expect(calls).toBe(5); expect(results).toHaveLength(5);
  expect(results.every(r => (r as { httpStatus: number }).httpStatus === 200)).toBe(true);
}, 180_000);

describe('GET /api/ai-analysis quota preflight', () => {
  it.each(['GET', 'POST'] as const)('returns 503 for unavailable authentication on %s without suggesting login', async method => {
    state.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    const response = await (method === 'GET' ? GET : POST)(request(method));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.code).toBe('auth_unavailable');
    expect(body).not.toHaveProperty('loginForMore');
    expect(body).not.toHaveProperty('remaining');
    expect(state.consent).not.toHaveBeenCalled();
    expectNoGenerationOrWrites();
  });

  it.each(['GET', 'POST'] as const)('returns 503 when authentication times out on %s', async method => {
    state.getUser.mockImplementation(() => new Promise(() => {}));
    const pending = (method === 'GET' ? GET : POST)(request(method));
    await vi.advanceTimersByTimeAsync(5000);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'auth_unavailable' });
    expectNoGenerationOrWrites();
  });

  it.each(['GET', 'POST'] as const)('retains 401 for a confirmed invalid token on %s', async method => {
    state.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401, code: 'bad_jwt' } });
    const response = await (method === 'GET' ? GET : POST)(request(method));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'unauthorized', loginForMore: true });
    expectNoGenerationOrWrites();
  });

  it('returns 503 for an unavailable consent record without asking the user to consent again', async () => {
    state.consent.mockResolvedValue({ status: 'unavailable' });
    const response = await POST(request('POST'));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.code).toBe('adult_consent_unavailable');
    expect(body).not.toHaveProperty('remaining');
    expect(state.gate).not.toHaveBeenCalled();
    expectNoGenerationOrWrites();
  });

  it('retains 403 for a confirmed missing consent record', async () => {
    state.consent.mockResolvedValue({ status: 'required' });
    const response = await POST(request('POST'));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'adult_consent_required' });
    expectNoGenerationOrWrites();
  });

  it('stops a stuck quota lookup at its deadline without generation or writes', async () => {
    state.queryPending = true;
    const pending = GET(request());
    await vi.advanceTimersByTimeAsync(4500);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'daily_usage_unavailable' });
    expect(state.signals).toHaveLength(4);
    expect(state.signals.every(signal => signal.aborted)).toBe(true);
    expectNoGenerationOrWrites();
  });
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
  const firstBar = Date.parse('2026-10-05T00:00:00Z') / 1000;
  const chart = { s: 'ok', interval: '5m', timeZone: 'Asia/Seoul', sessionDate: '2026-10-05',
    t: Array.from({ length: 25 }, (_, i) => firstBar + i * 300), o: Array.from({ length: 25 }, (_, i) => 124 - i),
    h: Array.from({ length: 25 }, (_, i) => 125 - i), l: Array.from({ length: 25 }, (_, i) => 122 - i), c: Array.from({ length: 25 }, (_, i) => 123 - i),
    v: Array(25).fill(100), asOf: firstBar + 24 * 300, snapshotId: 'a'.repeat(64) };
  const chartReport = { currentStatus: '가격은 평균보다 아래에 있어요.', chartViews: [
    { view: 'trend', title: '평균보다 낮은 가격', observed: '가격은 20개 평균보다 아래예요.', meaning: '최근 받은 가격보다 낮게 거래된 흐름이에요.', watchNext: '평균 위로 돌아오는지 볼 수 있어요.' },
    { view: 'volume', title: '최근 거래량 비교', observed: '최근 거래량 평균은 앞 구간과 같아요.', meaning: '이 비교에서는 거래량 증가가 보이지 않아요.', watchNext: '가격과 거래량이 함께 달라지는지 볼 수 있어요.' },
  ], conclusion: { label: '정보 정리', signal: 'neutral', desc: '같은 날의 5분 가격과 거래량을 비교했어요.' } };
  it('explains the server-read chart rather than browser-supplied numbers or news, with shared daily usage', async () => {
    vi.stubEnv('AI_ANALYSIS_PROVIDER', 'anthropic');
    state.intraday.mockResolvedValue({ status: 'ok', data: chart, resolvedSymbol: '340810.KQ' });
    state.claude.mockResolvedValue({ text: JSON.stringify(chartReport), finishReason: 'STOP', provider: 'claude', model: 'claude-haiku-5-5', latencyMs: 100, usage: { inputTokens: 1000, outputTokens: 500 } });
    const response = await POST(request('POST', { symbol: '340810.KQ', price: 99999, currency: 'USD', mentorId: 'trend', questionId: 'chart-session', chartSessionDate: chart.sessionDate,
      recentNews: 'invented-news', timeSeriesContext: 'invented-series' }));
    const value = await response.json();
    expect(response.status).toBe(200); expect(value.chart).toEqual(chart); expect(value.remaining).toBe(2);
    const prompt = state.claude.mock.calls[0][0]; expect(prompt).toContain('"currency":"KRW"'); expect(prompt).toContain('"lastLinePrice":99');
    expect(prompt).not.toContain('99999'); expect(prompt).not.toContain('invented-news'); expect(prompt).not.toContain('invented-series');
    expect(state.business).not.toHaveBeenCalled(); expect(state.intraday).toHaveBeenCalledExactlyOnceWith('340810.KQ');
    expect(value.report._meta.sourceDetails).toEqual([expect.objectContaining({ name: '5분 가격 자료', provider: 'Yahoo Finance' })]);
    expect(value.report.chartViews.map((item: { view: string }) => item.view)).toEqual(['trend', 'volume']);
  });
  it('does not request paid prose for a short chart with no meaningful multi-view comparison', async () => {
    state.intraday.mockResolvedValue({ status: 'ok', data: { ...chart, t: chart.t.slice(0, 3), o: chart.o.slice(0, 3), h: chart.h.slice(0, 3), l: chart.l.slice(0, 3), c: chart.c.slice(0, 3), v: chart.v.slice(0, 3), asOf: chart.t[2] }, resolvedSymbol: 'AAPL' });
    const response = await POST(request('POST', { mentorId: 'trend', questionId: 'chart-session', chartSessionDate: chart.sessionDate }));
    expect(response.status).toBe(503); expectNoGenerationOrWrites();
  });
  it('does not charge a legacy price-only answer or an invented unavailable study', async () => {
    vi.stubEnv('AI_ANALYSIS_PROVIDER', 'anthropic');
    state.intraday.mockResolvedValue({ status: 'ok', data: { ...chart, v: Array(25).fill(0) }, resolvedSymbol: 'AAPL' });
    for (const value of [JSON.parse(report.text), chartReport]) {
      state.claude.mockResolvedValue({ text: JSON.stringify(value), finishReason: 'STOP', provider: 'claude', model: 'claude-haiku-5-5', usage: { inputTokens: 100, outputTokens: 100 } });
      const response = await POST(request('POST', { mentorId: 'trend', questionId: 'chart-session', chartSessionDate: chart.sessionDate }));
      expect(response.status).toBe(502); expect(state.insert).not.toHaveBeenCalled();
    }
  });
  it.each(['none', 'unavailable'])('does not call a model or charge usage when chart source is %s', async status => {
    state.intraday.mockResolvedValue({ status });
    const response = await POST(request('POST', { mentorId: 'trend', questionId: 'chart-session', chartSessionDate: chart.sessionDate }));
    expect(response.status).toBe(503); expectNoGenerationOrWrites(); expect(state.claude).not.toHaveBeenCalled();
  });
  it('returns new-session data for confirmation without paying for a different date', async () => {
    state.intraday.mockResolvedValue({ status: 'ok', data: chart, resolvedSymbol: 'AAPL' });
    const response = await POST(request('POST', { mentorId: 'trend', questionId: 'chart-session', chartSessionDate: '2026-10-02' }));
    expect(response.status).toBe(409); expect((await response.json()).chart).toEqual(chart); expectNoGenerationOrWrites();
  });
  it('keeps chart analysis inside existing fund and single-stock leverage boundaries', async () => {
    const response = await POST(request('POST', { symbol: 'TSLL', mentorId: 'trend', questionId: 'chart-session', chartSessionDate: chart.sessionDate }));
    expect(response.status).toBe(400); expect((await response.json()).code).toBe('chart_analysis_unsupported');
    expect(state.intraday).not.toHaveBeenCalled(); expectNoGenerationOrWrites();
  });
  it('uses the selected Haiku model and server-owned business context with the same quota', async () => {
    vi.stubEnv('AI_ANALYSIS_PROVIDER', 'anthropic');
    state.business.mockResolvedValue({ prompt: '검수된 회사 사업 자료: SEEU ON은 화면을 가려줘요.', sources: [] });
    state.claude.mockResolvedValue({ ...report, finishReason: 'STOP', provider: 'claude', model: 'claude-haiku-5-5', latencyMs: 100,
      usage: { inputTokens: 5000, outputTokens: 1000 } });
    const response = await POST(request('POST', { symbol: '340810.KQ', price: 2750, mentorId: 'growth', questionId: 'growth' }));
    expect(response.status).toBe(200); expect(state.claude).toHaveBeenCalledOnce();
    expect(state.claude.mock.calls[0][0]).toContain('검수된 회사 사업 자료: SEEU ON');
    expect(state.generate).not.toHaveBeenCalled(); expect(state.fallback).not.toHaveBeenCalled();
    expect(state.cost).toHaveBeenCalledWith(expect.objectContaining({ provider: 'claude', model: 'claude-haiku-5-5', inputTokens: 5000, outputTokens: 1000 }));
    expect((await response.json()).remaining).toBe(2);
  });
  it('does not charge user quota or silently try another provider after a truncated Haiku answer', async () => {
    vi.stubEnv('AI_ANALYSIS_PROVIDER', 'anthropic');
    state.claude.mockResolvedValue({ ...report, finishReason: 'INCOMPLETE', provider: 'claude', model: 'claude-haiku-5-5', latencyMs: 100,
      usage: { inputTokens: 5000, outputTokens: 4096 } });
    const response = await POST(request('POST', { mentorId: 'growth', questionId: 'growth' }));
    expect(response.status).toBe(502); expect(state.generate).not.toHaveBeenCalled(); expect(state.fallback).not.toHaveBeenCalled();
    expect(state.rows).toHaveLength(0); expect(state.cost).toHaveBeenCalledWith(expect.objectContaining({ success: false, errorCode: 'invalid_ai_response' }));
  });
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

  it('does not expose an uncharged successful answer when usage persistence fails', async () => {
    state.insert.mockResolvedValue({ error: { message: 'unavailable' } });
    const response = await POST(request('POST', { mentorId: 'value' }));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toMatchObject({ success: false, code: 'usage_record_failed' });
    expect(body).not.toHaveProperty('report');
    expect(body).not.toHaveProperty('remaining');
    expect(body.error).not.toContain('차감하지');
    expect(state.finalize).toHaveBeenCalledWith(503, 'usage_record_failed');
    expect(state.insert.mock.calls.filter(([table]) => table === 'ai_usage')).toHaveLength(1);
    expect(state.cost).toHaveBeenCalled();
  });

  it('delivers the answer after confirming a committed usage write whose response was lost', async () => {
    state.insert.mockImplementation((table: string, row: UsageRow) => {
      if (table === 'ai_usage') state.rows.push(row);
      return new Promise(() => {});
    });
    const pending = POST(request('POST', { mentorId: 'value' }));
    await vi.advanceTimersByTimeAsync(3000);
    const response = await pending;
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, remaining: 2 });
    expect(state.signals.some(signal => signal.aborted)).toBe(true);
    expect(state.rows).toHaveLength(1);
    expect(state.insert.mock.calls.filter(([table]) => table === 'ai_usage')).toHaveLength(1);
    expect((await (await GET(request())).json()).remaining).toBe(2);
  });

  it('does not mistake another user or request for confirmation of a lost write', async () => {
    state.insert.mockImplementation((table: string, row: UsageRow) => {
      if (table === 'ai_usage') state.rows.push({ ...row, user_id: 'bob' }, { ...row, request_id: 'another-request' });
      return new Promise(() => {});
    });
    const pending = POST(request('POST', { mentorId: 'value' }));
    await vi.advanceTimersByTimeAsync(3000);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('report');
    expect(state.insert.mock.calls.filter(([table]) => table === 'ai_usage')).toHaveLength(1);
  });

  it('bounds a stalled receipt lookup and does not retry the usage insert', async () => {
    state.insert.mockImplementation(() => new Promise(() => {}));
    state.receiptPending = true;
    const pending = POST(request('POST', { mentorId: 'value' }));
    await vi.advanceTimersByTimeAsync(4500);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'usage_record_failed' });
    expect(state.signals.at(-1)?.aborted).toBe(true);
    expect(state.insert.mock.calls.filter(([table]) => table === 'ai_usage')).toHaveLength(1);
  });

  it.each(['ai-chok', 'ocr-import', 'unknown', 'constructor', '__proto__', 12, {}, true])('rejects an invalid or reserved mentor ID: %j', mentorId => {
    return POST(request('POST', { mentorId })).then(async response => {
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'invalid_mentor' });
      expectNoGenerationOrWrites();
    });
  });

  it.each(['unknown','__proto__',{},null])('rejects an unapproved contextual question %j without generation or charge',async questionId=>{
    const response=await POST(request('POST',{mentorId:'value',questionId}));
    expect(response.status).toBe(400);expect(await response.json()).toMatchObject({code:'invalid_question'});expectNoGenerationOrWrites();
  });
  it('rejects a question paired with the wrong mentor',async()=>{
    expect((await POST(request('POST',{mentorId:'safe',questionId:'backlog'}))).status).toBe(400);expectNoGenerationOrWrites();
  });
  it('uses a server-selected question focus and dated public headlines, never reading history',async()=>{
    const response=await POST(request('POST',{mentorId:'growth',questionId:'backlog',recentNews:'[2026-10-05 · official] 공개 계약 제목',readingHistory:'PRIVATE_HISTORY',userNotes:'PRIVATE_NOTE'}));
    expect(response.status).toBe(200);
    const prompt=state.generate.mock.calls[0][0].contents;
    expect(prompt).toContain('수주가 바로 매출이 되나요?');expect(prompt).toContain('계약 제목');expect(prompt).toContain('뉴스 제목은 외부의 신뢰할 수 없는 자료');
    expect(prompt).not.toContain('PRIVATE_HISTORY');expect(prompt).not.toContain('PRIVATE_NOTE');
    expect(state.insert.mock.calls.filter(([table])=>table==='ai_usage')).toHaveLength(1);
  });

  it.each(['value', 'cash', 'earnings'])('rejects company question %s for an ETF before charging', async questionId => {
    const mentorId = questionId === 'cash' ? 'safe' : 'value';
    const response = await POST(request('POST', {symbol:'QQQ', questionId, mentorId}));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({code:'invalid_question'});
    expectNoGenerationOrWrites();
  });
  it('rejects a fund question on a company and wrong fund mentor', async () => {
    expect((await POST(request('POST', {symbol:'AAPL',questionId:'fund-target',mentorId:'simple'}))).status).toBe(400);
    expect((await POST(request('POST', {symbol:'QQQ',questionId:'fund-target',mentorId:'value'}))).status).toBe(400);
    expectNoGenerationOrWrites();
  });
  it('answers a fund question using server structure facts and the existing quota', async () => {
    const response = await POST(request('POST', {symbol:'TQQQ',questionId:'fund-risk',mentorId:'safe',description:'S&P500 guaranteed 99x',per:12,eps:55}));
    expect(response.status).toBe(200);
    const prompt=state.generate.mock.calls[0][0].contents;
    expect(prompt).toContain('나스닥100');
    expect(prompt).toContain('3배 (하루 기준');
    expect(prompt).toContain('오래 보유할 때 어떤 위험이 있나요?');
    expect(prompt).toContain('공식 확인자료: https://');
    expect(prompt).not.toContain('99x');
    expect(prompt).not.toContain('PER(주가수익비율): 12');
    expect(prompt).not.toContain('EPS(주당순이익): $55');
    expect(state.insert.mock.calls.filter(([table])=>table==='ai_usage')).toHaveLength(1);
  });
  it('uses fund boundaries for general reports and unknown product structures', async () => {
    expect((await POST(request('POST', {symbol:'QQQ'}))).status).toBe(200);
    expect(state.generate.mock.calls[0][0].contents).toContain('상품 설명 기준');
    expect((await POST(request('POST', {symbol:'UNKNOWN',koreanName:'Unknown ETF',questionId:'fund-target',mentorId:'simple'}))).status).toBe(200);
    const prompt=state.generate.mock.calls[1][0].contents;
    expect(prompt).toContain('검증한 상세 구조 설명의 제공 범위 밖');
    expect(prompt).toContain('이름으로 추정하지 말고');
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

  it('returns a retryable failure without charging usage for unusable answers', async () => {
    state.generate.mockResolvedValue({ text: 'not valid JSON' });
    const response = await POST(request('POST', { mentorId: 'safe' }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, code: 'invalid_ai_response', retryable: true, remaining: 3 });
    expect(body).not.toHaveProperty('report');
    expect(state.insert.mock.calls.filter(([table]) => table === 'ai_usage')).toHaveLength(0);
    expect(state.audit).not.toHaveBeenCalled();
    expect(state.cost).toHaveBeenCalledWith(expect.objectContaining({ success: false, errorCode: 'invalid_ai_response' }));
    expect(state.finalize).toHaveBeenCalledExactlyOnceWith(502, 'invalid_ai_response');
  });

  it('retries malformed output and charges exactly once for a usable answer', async () => {
    state.generate.mockResolvedValueOnce({ text: '{"currentStatus":' }).mockResolvedValueOnce(report);
    const response = await POST(request('POST', { mentorId: 'safe' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, remaining: 2 });
    expect(state.generate).toHaveBeenCalledTimes(2);
    expect(state.cost).toHaveBeenCalledTimes(2);
    expect(state.insert.mock.calls.filter(([table]) => table === 'ai_usage')).toHaveLength(1);
    expect(state.fallback).not.toHaveBeenCalled();
    expect(state.generate.mock.calls[0][0].config.responseJsonSchema.required).toContain('keyAdvice');
  });

  it.each(['null', '[]', '{"currentStatus":"hello","conclusion":null}'])('rejects valid JSON with the wrong UI shape: %s', async text => {
    state.generate.mockResolvedValue({ text });
    state.fallback.mockResolvedValue({ text, provider: 'claude', model: 'fixture' });
    expect((await POST(request('POST'))).status).toBe(502);
    expect(state.rows).toHaveLength(0);
  });

  it('accepts complete markdown JSON, but rejects truncated finish reasons', async () => {
    state.generate.mockResolvedValueOnce({ ...report, candidates: [{ finishReason: 'MAX_TOKENS' }] })
      .mockResolvedValueOnce({ text: '```json\n' + report.text + '\n```', candidates: [{ finishReason: 'STOP' }] });
    expect((await POST(request('POST'))).status).toBe(200);
    expect(state.generate).toHaveBeenCalledTimes(2);
    expect(state.rows).toHaveLength(1);
  });

  it('does not retry generation or charge usage if report auditing unexpectedly throws', async () => {
    state.audit.mockRejectedValue(new Error('audit fixture failure'));
    expect((await POST(request('POST'))).status).toBe(500);
    expect(state.generate).toHaveBeenCalledTimes(1);
    expect(state.fallback).not.toHaveBeenCalled();
    expect(state.rows).toHaveLength(0);
  });
});

describe('ask Joobi free questions', () => {
  const question = { questionId: 'ask-joobi', questionConsent: true, questionText: 'ETF는 주식과 뭐가 달라요?', symbol: 'GENERAL' };
  it('uses the existing quota and provider path without leaking client portfolio/public claims or auditing free text', async () => {
    const response = await POST(request('POST', { ...question, shares: 999, avgCost: 700, recentNews: 'untrusted-client-news', description: 'untrusted-company-claim', price: 777777, userNotes: 'private-note' }));
    expect(response.status).toBe(200);
    expect(state.generate).not.toHaveBeenCalled(); expect(state.fallback).not.toHaveBeenCalled();
    const prompt = state.claude.mock.calls[0][0];
    expect(prompt).toContain('ETF는 주식과 뭐가 달라요?');
    for (const privateValue of ['untrusted-client-news', 'untrusted-company-claim', '777777', 'private-note']) expect(prompt).not.toContain(privateValue);
    expect(state.business).not.toHaveBeenCalled();
    expect(state.intraday).not.toHaveBeenCalled();
    expect(state.audit).not.toHaveBeenCalled();
    expect(state.rows).toHaveLength(1);
    expect(state.cost).toHaveBeenCalledOnce();
    const data = await response.json();
    expect(data.remaining).toBe(2);
    expect(data.report._meta.sourceDetails.some((item: { name: string }) => item.name.includes('ETF'))).toBe(true);
    expect(data.report._meta.sourceDetails.some((item: { name: string }) => item.name === '시세')).toBe(false);
  });
  it('refuses absent consent and overlong questions before any provider cost', async () => {
    for (const patch of [{ questionConsent: false }, { questionText: 'x'.repeat(601) }]) {
      expect((await POST(request('POST', { ...question, ...patch }))).status).toBe(400);
    }
    expectNoGenerationOrWrites();
  });
  it('loads server business facts for selected stock and does not manufacture missing quotes', async () => {
    state.business.mockResolvedValue({ prompt: 'SERVER_VERIFIED_COMPANY', sources: [] });
    expect((await POST(request('POST', { ...question, symbol: '340810.KQ' }))).status).toBe(200);
    expect(state.business).toHaveBeenCalledWith('340810.KQ');
    expect(state.intraday).not.toHaveBeenCalled();
    expect(state.evidence).not.toHaveBeenCalled();
    expect(state.claude.mock.calls[0][0]).toContain('SERVER_VERIFIED_COMPANY');
    expect(state.claude.mock.calls[0][0]).not.toContain('현재가:');
  });
  it('keeps exhausted quota and adult consent gates on new free text entry', async () => {
    state.consent.mockResolvedValue({ status: 'required' });
    expect((await POST(request('POST', question))).status).toBe(403);
    state.consent.mockResolvedValue({ status: 'granted' });
    addUsage('simple'); addUsage('simple'); addUsage('simple');
    expect((await POST(request('POST', question))).status).toBe(429);
    expectNoGenerationOrWrites();
  });
  it('rejects oversized answers without charging user quota', async () => {
    state.claude.mockResolvedValue({ text: JSON.stringify({ currentStatus: 'x'.repeat(701), keyAdvice: ['설명'], conclusion: { label: '설명', signal: 'neutral', desc: '기준' } }) });
    expect((await POST(request('POST', question))).status).toBe(502);
    expect(state.rows).toHaveLength(0);
    expect(state.cost).toHaveBeenCalled();
  });
});

it.runIf(process.env.ASSISTANT_LIVE_TEST === '1')('checks two real Haiku beginner questions against public definition/company context', async () => {
  vi.useRealTimers(); vi.stubEnv('AI_ANALYSIS_PROVIDER', 'anthropic');
  const { callClaudeAnalysis: realClaude } = await vi.importActual<typeof import('@/lib/claudeAnalysis')>('@/lib/claudeAnalysis');
  const { formatCompanyAnalysisContext } = await vi.importActual<typeof import('@/lib/companyAnalysisContext')>('@/lib/companyAnalysisContext');
  const profileResponse = await fetch('https://joobi.kr/api/company-profile?symbol=340810.KQ', { signal: AbortSignal.timeout(15_000) });
  const profile = (await profileResponse.json()).data?.business;
  expect(profile?.summary).toBeTruthy();
  const { estimateAiCostUsd } = await vi.importActual<typeof import('@/lib/aiCostLedger')>('@/lib/aiCostLedger');
  let calls = 0, total = 0;
  const results: unknown[] = [];
  state.business.mockImplementation(async (symbol: string) => ({ prompt: formatCompanyAnalysisContext(symbol, profile), sources: profile.sources }));
  state.claude.mockImplementation(async (...args: Parameters<typeof realClaude>) => {
    if (++calls > 2) throw new Error('live_question_limit');
    const answer = await realClaude(...args); total += estimateAiCostUsd(answer.model, answer.usage); return answer;
  });
  for (const [symbol, questionText] of [['GENERAL', 'ETF는 주식과 뭐가 달라요?'], ['340810.KQ', 'SEEU ON은 어디에 쓰이는 제품이에요?']]) {
    state.rows = [];
    const response = await POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, symbol, questionText }));
    const data = await response.json();
    results.push({ symbol, questionText, status: response.status, report: data.report, error: data.error });
  }
  mkdirSync('artifacts/personal-learning-20261104', { recursive: true });
  writeFileSync('artifacts/personal-learning-20261104/live-answers.json', JSON.stringify({ calls, estimatedUsd: total, note: 'Real provider; synthetic auth/quota/cost stores; production public company profile plus maintained term definitions; no live stock prices in these two checks.', results }, null, 2));
  expect(calls).toBe(2); expect(total).toBeLessThan(.03);
  for (const result of results as { status: number }[]) expect(result.status).toBe(200);
}, 150_000);


describe('assistant evidence routing', () => {
  it('does not spend model calls or quota when market sources are all missing', async () => {
    const response = await POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: '왜 떨어져요?', symbol: 'MU' }));
    expect(response.status).toBe(503); expect(state.evidence).toHaveBeenCalledWith('MU', '1d', false, 'latest', []);
    expect(state.articles).toHaveBeenCalledOnce();
    expect(state.claude).not.toHaveBeenCalled(); expect(state.rows).toHaveLength(0);
  });
  it('routes a bounded follow-up through fresh evidence and never audits the conversation', async () => {
    state.evidence.mockResolvedValue({ version: 1, symbol: 'MU', period: '5d', checkedAt: new Date(NOW).toISOString(), comparisons: [], gaps: [],
      evidence: [{ id: 'P1', kind: 'price', title: '마이크론', text: 'SERVER_PRICE_EVIDENCE', url: 'https://finance.yahoo.com', publisher: 'Yahoo', publishedAt: new Date(NOW).toISOString(), checkedAt: new Date(NOW).toISOString() }] });
    const response = await POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: '그럼 시장 전체랑 비교하면요?', symbol: 'MU', questionPeriod: '5d', historySymbol: 'MU', questionHistory: [{ question: '왜 떨어졌나요?', answer: 'PREVIOUS_UNVERIFIED_ANSWER' }] }));
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(state.evidence).toHaveBeenCalledWith('MU', '5d', false, 'latest', []);
    const prompt = state.claude.mock.calls[0][0];
    expect(prompt).toContain('마이크론'); expect(state.articles).not.toHaveBeenCalled(); expect(prompt).toContain('PREVIOUS_UNVERIFIED_ANSWER');
    expect(state.audit).not.toHaveBeenCalled(); expect(state.rows).toHaveLength(1);
  });
  it.each([true, false])('uses fetched passages with quote availability %s while returning only metadata', async (hasPrice) => {
    state.evidence.mockResolvedValue({ version: 1, symbol: 'MU', period: '1d', checkedAt: new Date(NOW).toISOString(), comparisons: [], gaps: [], evidence: [], price: hasPrice ? { symbol: 'MU', label: '마이크론', day: '2026-10-05', baselineDay: '2026-10-02', at: new Date(NOW).toISOString(), price: 100, changePercent: 1, currency: 'USD' } : undefined });
    state.articles.mockResolvedValue([{ id: 'A1', kind: 'article', scope: 'company', title: '마이크론 기사', text: 'ARTICLE_BODY_FOR_MODEL_ONLY', url: 'https://finance.yahoo.com/news/micron', publisher: 'Yahoo', publishedAt: '2026-10-05', checkedAt: new Date(NOW).toISOString() }]);
    const response = await POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: '오늘 마이크론은 왜 올랐어요?', symbol: 'MU' }));
    expect(response.status).toBe(200); expect(state.claude.mock.calls[0][0]).toContain('ARTICLE_BODY_FOR_MODEL_ONLY');
    const data = await response.json(); expect(JSON.stringify(data)).not.toContain('ARTICLE_BODY_FOR_MODEL_ONLY');
    expect(data.report.assistantEvidence.evidence[0]).toMatchObject({ id: 'A1', kind: 'article', url: 'https://finance.yahoo.com/news/micron' });
    expect(state.rows).toHaveLength(1);
  });
  it('sends the confirmed price move ahead of the explanation, but not ahead of a buy or sell question', async () => {
    const price = { symbol: 'MU', label: '마이크론', day: '2026-10-05', baselineDay: '2026-10-02', at: new Date(NOW).toISOString(), price: 100, changePercent: -3.2, currency: 'USD', sessionState: 'closed' as const };
    state.evidence.mockResolvedValue({ version: 1, symbol: 'MU', period: '1d', checkedAt: new Date(NOW).toISOString(), gaps: [], evidence: [], price,
      comparisons: [{ ...price, symbol: '^GSPC', label: '미국 대형주 시장(S&P 500)', changePercent: -0.4 }] });
    state.articles.mockResolvedValue([{ id: 'A1', kind: 'article', scope: 'company', title: '마이크론 기사', text: '기사 본문', url: 'https://finance.yahoo.com/news/micron', publisher: 'Yahoo', publishedAt: '2026-10-05', checkedAt: new Date(NOW).toISOString() }]);
    const stream = async (questionText: string) => {
      const live = new NextRequest('https://joobi.test/api/ai-analysis', { method: 'POST', headers: { Authorization: 'Bearer alice-token', 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({ questionId: 'ask-joobi', questionConsent: true, questionText, symbol: 'MU' }) });
      return (await (await POST(live)).text()).trim().split('\n').map(line => JSON.parse(line));
    };
    const events = await stream('오늘 마이크론은 왜 떨어졌어요?');
    const preview = events.find(event => event.type === 'preview');
    // Only server price facts travel early: no article text and no generated prose.
    expect(preview.preview).toEqual({ day: '2026-10-05', baselineDay: '2026-10-02', sessionState: 'closed',
      prices: [{ symbol: 'MU', label: '마이크론', changePercent: -3.2 }, { symbol: '^GSPC', label: '미국 대형주 시장(S&P 500)', changePercent: -0.4 }] });
    expect(events.findIndex(event => event.type === 'preview')).toBeLessThan(events.findIndex(event => event.type === 'result'));
    expect(events.at(-1)).toMatchObject({ type: 'result', status: 200 });
    expect((await stream('지금 더 사도 될까요?')).some(event => event.type === 'preview')).toBe(false);
  });
  describe('a cause question with a price but no article', () => {
    const price = { symbol: 'MU', label: '마이크론', day: '2026-10-05', baselineDay: '2026-10-02', at: new Date(NOW).toISOString(), price: 100, changePercent: -3.2, currency: 'USD', sessionState: 'closed' as const };
    const headline = { id: 'N1', kind: 'headline', scope: 'company', title: 'HEADLINE_ONLY_마이크론 급락 배경', text: '본문 없음', url: 'https://finance.yahoo.com/news/example', publisher: 'Yahoo', publishedAt: '2026-10-05', checkedAt: new Date(NOW).toISOString() };
    const priceEvidence = { id: 'P1', kind: 'price', title: '마이크론', text: '2026-10-02 종가 대비 2026-10-05 마지막 정규장 가격의 변화 -3.2%.', url: 'https://finance.yahoo.com/quote/MU/history/', publisher: 'Yahoo Finance', publishedAt: new Date(NOW).toISOString(), checkedAt: new Date(NOW).toISOString() };
    const honest = { ...report, text: JSON.stringify({ ...JSON.parse(report.text), currentStatus: '마이크론은 전 거래일보다 내린 채 마감했어요.\n왜 내렸는지는 확인하지 못했어요.', keyAdvice: [] }), finishReason: 'STOP', provider: 'claude', model: 'claude-haiku-5-5', latencyMs: 100, usage: { inputTokens: 1000, outputTokens: 300 } };
    const guessing = { ...honest, text: JSON.stringify({ ...JSON.parse(honest.text), currentStatus: '마이크론은 전 거래일보다 내린 채 마감했어요.\n최근 많이 오른 뒤 차익 실현 매물 때문에 내렸어요.' }) };
    const ask = (questionText: string) => POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText, symbol: 'MU' }));
    beforeEach(() => {
      state.evidence.mockResolvedValue({ version: 1, symbol: 'MU', period: '1d', checkedAt: new Date(NOW).toISOString(), comparisons: [], gaps: ['가격 확인 후 나온 기사도 있어요.'], price, evidence: [priceEvidence, headline] });
      state.articles.mockResolvedValue([]);
      state.claude.mockResolvedValue(honest);
    });
    it('answers from the price comparison, keeps the headline away from the model and the reader, and charges once', async () => {
      const response = await ask('오늘 마이크론은 왜 떨어졌어요?');
      expect(response.status).toBe(200);
      const prompt = state.claude.mock.calls[0][0];
      expect(prompt).not.toContain('HEADLINE_ONLY'); expect(prompt).toContain('원인을 말하지 마세요');
      const data = await response.json();
      expect(JSON.stringify(data)).not.toContain('HEADLINE_ONLY');
      expect(data.report.assistantEvidence.evidence.map((item: { kind: string }) => item.kind)).toEqual(['price']);
      expect(data.report.assistantEvidence.gaps).toEqual(['이 움직임을 설명하는 기사 본문이나 발표 자료를 가져오지 못했어요. 그래서 이유는 확인하지 못했고, 가격 비교까지만 답했어요.']);
      expect(data.report.currentStatus).toContain('확인하지 못했어요');
      expect(state.claude).toHaveBeenCalledOnce(); expect(state.rows).toHaveLength(1); expect(data.remaining).toBe(2);
    });
    it('rewrites once when the answer states a cause, and delivers only the corrected answer', async () => {
      state.claude.mockResolvedValueOnce(guessing).mockResolvedValueOnce(honest);
      const response = await ask('오늘 마이크론은 왜 떨어졌어요?');
      expect(response.status).toBe(200); expect(state.claude).toHaveBeenCalledTimes(2);
      expect(state.claude.mock.calls[1][0]).toContain('원인을 말하거나');
      const data = await response.json();
      expect(data.report.currentStatus).not.toContain('차익 실현'); expect(state.rows).toHaveLength(1);
    });
    it('shows nothing and charges nothing when the rewrite still states a cause', async () => {
      state.claude.mockResolvedValue(guessing);
      const response = await ask('오늘 마이크론은 왜 떨어졌어요?');
      expect(response.status).toBe(502); expect(await response.json()).toMatchObject({ code: 'invalid_user_answer' });
      expect(state.claude).toHaveBeenCalledTimes(2); expect(state.rows).toHaveLength(0);
    });
    it('does not demand the disclosure from a follow-up that asks something else', async () => {
      state.claude.mockResolvedValue({ ...honest, text: JSON.stringify({ ...JSON.parse(honest.text), currentStatus: '마이크론은 정보를 저장하는 부품을 만드는 회사예요.' }) });
      const response = await POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: '그럼 이 회사는 뭘 만들어요?', symbol: 'MU', historySymbol: 'MU',
        questionHistory: [{ question: '오늘 마이크론은 왜 떨어졌어요?', answer: '전 거래일보다 내렸어요. 이유는 확인하지 못했어요.', symbol: 'MU' }] }));
      expect(response.status).toBe(200); expect(state.claude).toHaveBeenCalledOnce();
    });
    // 2026-11-12 배포 전 검토: '왜'가 없는 원인 질문과 이어지는 질문에서는 원인 문장 검사가 꺼져 있었다.
    it.each(['오늘 실적 때문에 떨어진 거야?', '오늘 주가에 영향 준 뉴스 있어?'])('guards a cause question that has no why-word: %s', async questionText => {
      state.claude.mockResolvedValueOnce(guessing).mockResolvedValueOnce(honest);
      const response = await ask(questionText);
      expect(response.status).toBe(200); expect(state.claude).toHaveBeenCalledTimes(2);
      expect((await response.json()).report.currentStatus).not.toContain('차익 실현');
      expect(state.rows).toHaveLength(1);
    });
    it('keeps an unsourced cause out of a follow-up that asks something else', async () => {
      const followUp = () => POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: '그럼 다른 반도체 회사들도 같이 내렸어요?', symbol: 'MU', historySymbol: 'MU',
        questionHistory: [{ question: '오늘 마이크론은 왜 떨어졌어요?', answer: '전 거래일보다 내렸어요. 이유는 확인하지 못했어요.', symbol: 'MU' }] }));
      const comparison = { ...honest, text: JSON.stringify({ ...JSON.parse(honest.text), currentStatus: '다른 반도체 회사의 가격은 이번 자료에 없어서 함께 내렸는지는 말할 수 없어요.' }) };
      state.claude.mockResolvedValueOnce({ ...honest, text: JSON.stringify({ ...JSON.parse(honest.text), currentStatus: '금리 인상 우려로 반도체 회사들이 함께 내렸어요.' }) }).mockResolvedValueOnce(comparison);
      const response = await followUp();
      expect(response.status).toBe(200); expect(state.claude).toHaveBeenCalledTimes(2);
      expect((await response.json()).report.currentStatus).not.toContain('우려');
      // The comparison itself needs no "reason unconfirmed" sentence.
      state.claude.mockReset().mockResolvedValue(comparison);
      expect((await followUp()).status).toBe(200); expect(state.claude).toHaveBeenCalledOnce();
    });
    it('answers a general principle without fetching prices or articles', async () => {
      const response = await ask('금리가 오르면 왜 채권 가격이 떨어져?');
      expect(response.status).toBe(200);
      expect(state.evidence).not.toHaveBeenCalled(); expect(state.articles).not.toHaveBeenCalled();
      expect(state.claude.mock.calls[0][0]).not.toContain('원인을 말하지 마세요');
    });
    it('takes a one-word reply to its own question as the next turn of that conversation', async () => {
      state.claude.mockResolvedValue({ ...honest, text: JSON.stringify({ ...JSON.parse(honest.text), currentStatus: '1년 안에 쓸 돈이라면 값이 내렸을 때 기다릴 시간이 짧아요. 최근 소식은 확인하지 못했어요.' }) });
      const response = await POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: '네', symbol: 'MU', historySymbol: 'MU',
        questionHistory: [{ question: '지금 더 사도 될까요?', answer: '더 사면 한 종목에 묶이는 돈이 늘어요. 이 돈을 1년 안에 써야 하나요?', symbol: 'MU' }] }));
      expect(response.status).toBe(200);
      // The buy question it answers decides the kind of answer, not the word "네".
      expect(state.claude.mock.calls[0][0]).toContain('최근 기사 본문이나 발표 자료를 구하지 못했어요');
      expect(state.claude.mock.calls[0][0]).not.toContain('원인을 말하지 마세요');
    });
    it('answers a buy question without pretending to know recent news', async () => {
      state.claude.mockResolvedValue({ ...honest, text: JSON.stringify({ ...JSON.parse(honest.text), currentStatus: '더 살지는 처음 산 이유가 그대로인지에 달려 있어요. 최근 소식은 확인하지 못했어요.' }) });
      const response = await ask('지금 더 사도 될까요?');
      expect(response.status).toBe(200);
      const prompt = state.claude.mock.calls[0][0];
      expect(prompt).not.toContain('HEADLINE_ONLY'); expect(prompt).toContain('최근 기사 본문이나 발표 자료를 구하지 못했어요');
      const data = await response.json();
      expect(data.report.assistantEvidence.gaps.at(-1)).toContain('최근 소식은 확인하지 못한 채로 답했어요');
    });
  });
  describe('an answer that fails a factual check', () => {
    const price = { symbol: 'MU', label: '마이크론', day: '2026-10-05', baselineDay: '2026-10-02', at: new Date(NOW).toISOString(), price: 100, changePercent: -3.2, currency: 'USD', sessionState: 'closed' as const };
    const article = { id: 'A1', kind: 'article', scope: 'company', title: '마이크론 기사', text: '마이크론 주가는 공장 가동 지연 소식 뒤 내렸다.', url: 'https://finance.yahoo.com/news/micron', publisher: 'Yahoo', publishedAt: '2026-10-05', checkedAt: new Date(NOW).toISOString() };
    const base = { ...report, finishReason: 'STOP', provider: 'claude', model: 'claude-haiku-5-5', latencyMs: 100, usage: { inputTokens: 1000, outputTokens: 300 } };
    const good = { ...base, text: JSON.stringify({ ...JSON.parse(report.text), currentStatus: '마이크론은 전 거래일보다 내린 채 마감했어요. Yahoo는 공장 가동 지연 소식을 전했어요.', keyAdvice: [] }) };
    const inventedPercent = { ...base, text: JSON.stringify({ ...JSON.parse(report.text), currentStatus: '마이크론은 나흘간 17.6% 내렸어요.', keyAdvice: [] }) };
    const ask = () => POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: '오늘 마이크론은 왜 떨어졌어요?', symbol: 'MU' }));
    beforeEach(() => {
      state.evidence.mockResolvedValue({ version: 1, symbol: 'MU', period: '1d', checkedAt: new Date(NOW).toISOString(), comparisons: [], gaps: [], price, evidence: [] });
      state.articles.mockResolvedValue([article]);
    });
    it('is rewritten once, and only the rewrite that passes every check is delivered and charged', async () => {
      state.claude.mockResolvedValueOnce(inventedPercent).mockResolvedValueOnce(good);
      const response = await ask();
      expect(response.status).toBe(200); expect(state.claude).toHaveBeenCalledTimes(2);
      expect(state.claude.mock.calls[1][0]).toContain('퍼센트(%) 숫자를 쓰지 마세요');
      const data = await response.json();
      expect(data.report.currentStatus).not.toContain('17.6'); expect(data.report.currentStatus).toContain('공장 가동 지연');
      expect(state.rows).toHaveLength(1); expect(data.remaining).toBe(2);
      // Both attempts are costed; only the accepted one counts as a success.
      expect(state.cost.mock.calls.map(([entry]) => entry.success)).toEqual([false, true]);
    });
    it('is withheld without a charge when the rewrite fails the same check', async () => {
      state.claude.mockResolvedValue(inventedPercent);
      const response = await ask();
      expect(response.status).toBe(502); expect(await response.json()).toMatchObject({ code: 'invalid_user_answer' });
      expect(state.claude).toHaveBeenCalledTimes(2); expect(state.rows).toHaveLength(0);
    });
    it('never delivers the first answer when a rewrite is not attempted', async () => {
      state.claude.mockResolvedValue(inventedPercent);
      state.budget.mockResolvedValueOnce({ allowed: true }).mockResolvedValue({ allowed: false });
      const response = await ask();
      expect(response.status).toBe(502); expect(state.claude).toHaveBeenCalledOnce(); expect(state.rows).toHaveLength(0);
    });
  });
  it('does not generate or charge a guessed reason when only headlines are available', async () => {
    state.evidence.mockResolvedValue({ version: 1, symbol: 'MU', period: '1d', checkedAt: new Date(NOW).toISOString(), comparisons: [], gaps: [],
      evidence: [{ id: 'N1', kind: 'headline', title: '마이크론 관련 제목', text: '본문 없음', url: 'https://finance.yahoo.com/news/example', publisher: 'Yahoo', publishedAt: '2026-10-05', checkedAt: new Date(NOW).toISOString() }] });
    const response = await POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: '오늘 왜 이렇게 떨어져요?', symbol: 'MU' }));
    expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ code: 'assistant_articles_unavailable', remaining: 3 });
    expect(state.claude).not.toHaveBeenCalled(); expect(state.rows).toHaveLength(0); expect(state.cost).not.toHaveBeenCalled();
  });
  it('rejects fabricated citations before recording user usage', async () => {
    const parsed = JSON.parse(report.text); parsed.assistantInsights = [{ kind: 'observation', text: '잘못된 근거', evidenceIds: ['made-up'] }];
    state.claude.mockResolvedValue({ text: JSON.stringify(parsed) });
    expect((await POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: 'ETF가 뭐예요?', symbol: 'GENERAL' }))).status).toBe(502);
    expect(state.rows).toHaveLength(0);
  });
});


describe('bounded direct answer recovery', () => {
 const question = { questionId: 'ask-joobi', questionConsent: true, questionText: 'ETF는 주식과 뭐가 달라요?', symbol: 'GENERAL' };
 const rejected = { ...report, text: JSON.stringify({ ...JSON.parse(report.text), currentStatus: '매수를 고려해 보세요.' }), finishReason: 'STOP', provider: 'claude', model: 'claude-haiku-5-5', latencyMs: 100, usage: { inputTokens: 100, outputTokens: 100 } };
 it.each(['질문의 전제와 달리 올랐어요.', '전날 미국 중간선거에서 민주당이 이겨 규제 걱정이 생겼어요.'])('repairs an invented premise or ambiguous event date once: %s', async currentStatus => {
  state.claude.mockResolvedValueOnce({ ...rejected, text: JSON.stringify({ ...JSON.parse(report.text), currentStatus }) });
  const response = await POST(request('POST', question));
  expect(response.status).toBe(200); expect(state.claude).toHaveBeenCalledTimes(2);
  expect(state.rows).toHaveLength(1);
  expect((await response.json()).report.currentStatus).not.toBe(currentStatus);
 });
 it('does not publish a repeated context error or charge user usage', async () => {
  state.claude.mockResolvedValue({ ...rejected, text: JSON.stringify({ ...JSON.parse(report.text), currentStatus: '질문의 전제와 달리 올랐어요.' }) });
  const response = await POST(request('POST', question));
  expect(response.status).toBe(502); expect(state.claude).toHaveBeenCalledTimes(2); expect(state.rows).toHaveLength(0);
 });
 it('repairs an election identity error from the original article, not the rejected answer', async () => {
  state.articles.mockResolvedValue([{ id:'A1',kind:'article',scope:'market',title:'중간선거 보도',text:'미국 중간선거 결과에 대한 우려를 다룬 공개 자료입니다.',url:'https://example.com/article',publisher:'test',publishedAt:'2026-10-05',checkedAt:'2026-10-05' }]);
  state.claude.mockResolvedValueOnce({ ...rejected, text: JSON.stringify({ ...JSON.parse(report.text), currentStatus: '미국 대선 결과가 영향을 주었어요.' }) });
  const response = await POST(request('POST', { ...question, symbol:'MU', questionText:'최근 주가가 움직인 이유는?' }));
  expect(response.status).toBe(200); expect(state.claude).toHaveBeenCalledTimes(2); expect(state.rows).toHaveLength(1);
  expect(state.claude.mock.calls[1][0]).toContain('중간선거를 대통령 선거로 바꾸지 마세요');
  expect(state.claude.mock.calls[1][0]).not.toContain('미국 대선 결과가 영향을 주었어요');
  expect(state.cost.mock.calls[0][0]).toMatchObject({success:false,errorCode:'invalid_ai_response'});
 });
 it('regenerates once with the same packet and charges quota once only for a valid answer', async () => {
  state.claude.mockResolvedValueOnce(rejected);
  const response = await POST(request('POST', question));
  expect(response.status).toBe(200);
  expect(state.claude).toHaveBeenCalledTimes(2);
  expect(state.claude.mock.calls[1][0]).toContain(state.claude.mock.calls[0][0]);
  expect(state.claude.mock.calls[1][0]).not.toContain(rejected.text);
  expect(state.rows).toHaveLength(1); expect(state.cost).toHaveBeenCalledTimes(2);
  expect(state.budget).toHaveBeenCalledTimes(2);
 });
 it('does not loop or charge usage when the second answer is still rejected', async () => {
  state.claude.mockResolvedValue(rejected);
  const response = await POST(request('POST', question));
  expect(response.status).toBe(502); expect((await response.json()).code).toBe('invalid_user_answer');
  expect(state.claude).toHaveBeenCalledTimes(2); expect(state.rows).toHaveLength(0);
  expect(state.cost).toHaveBeenLastCalledWith(expect.objectContaining({ success: false, errorCode: 'invalid_user_answer' }));
 });
 it('does not regenerate after the budget closes', async () => {
  state.claude.mockResolvedValue(rejected);
  state.budget.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false });
  expect((await POST(request('POST', question))).status).toBe(502);
  expect(state.claude).toHaveBeenCalledOnce(); expect(state.rows).toHaveLength(0);
 });
 it('rejects invented evidence in the regenerated answer', async () => {
  const forged = { ...JSON.parse(report.text), assistantInsights: [{kind:'observation',text:'근거를 만들었어요.',evidenceIds:['invented']}] };
  state.claude.mockResolvedValueOnce(rejected).mockResolvedValueOnce({ ...rejected, text: JSON.stringify(forged) });
  expect((await POST(request('POST', question))).status).toBe(502);
  expect(state.rows).toHaveLength(0); expect(state.claude).toHaveBeenCalledTimes(2);
 });
 it('does not start another call after the recovery time budget', async () => {
  let elapsed = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
  state.claude.mockImplementationOnce(async () => { elapsed = 36_000; return rejected; });
  expect((await POST(request('POST', question))).status).toBe(502);
  expect(state.claude).toHaveBeenCalledOnce(); expect(state.rows).toHaveLength(0);
 });
 it('does not turn a repair provider failure into a successful or charged answer', async () => {
  state.claude.mockResolvedValueOnce(rejected).mockRejectedValueOnce(new Error('provider unavailable'));
  expect((await POST(request('POST', question))).status).toBe(502);
  expect(state.claude).toHaveBeenCalledTimes(2); expect(state.rows).toHaveLength(0);
 });
});

describe('single-stock fund conversation regression', () => {
 it('keeps the validated direct answer instead of replacing it with a self-blocking legacy warning', async () => {
  vi.stubEnv('AI_ANALYSIS_PROVIDER','anthropic');
  const content=JSON.parse(report.text);content.currentStatus='MUU는 마이크론의 하루 주가 변화에 2배를 목표로 하는 ETF예요. 여러 날의 수익률이 두 배라는 뜻은 아니에요.';
  state.claude.mockResolvedValue({...report,text:JSON.stringify(content),finishReason:'STOP',usage:{inputTokens:100,outputTokens:100}});
  const response=await POST(request('POST',{questionId:'ask-joobi',questionText:'MUU는 어떤 상품이야?',questionConsent:true,symbol:'MUU'}));
  expect(response.status).toBe(200);expect((await response.json()).report.currentStatus).toBe(content.currentStatus);expect(state.rows).toHaveLength(1);
 });
 it('still rejects a trading instruction in a direct fund answer without charging quota', async () => {
  vi.stubEnv('AI_ANALYSIS_PROVIDER','anthropic');
  const content=JSON.parse(report.text);content.currentStatus='지금 매수하세요.';
  state.claude.mockResolvedValue({...report,text:JSON.stringify(content),finishReason:'STOP',usage:{inputTokens:100,outputTokens:100}});
  const response=await POST(request('POST',{questionId:'ask-joobi',questionText:'MUU는 어떤 상품이야?',questionConsent:true,symbol:'MUU'}));
  expect(response.status).toBe(502);expect(state.rows).toHaveLength(0);
 });
});

describe('request latency without skipping admission or accounting', () => {
  it('starts independent quota and budget reads together but waits for admission before generation', async () => {
    vi.useRealTimers();
    let releaseTier!: (tier: string) => void;
    state.getTier.mockImplementation(() => new Promise(resolve => { releaseTier = resolve; }));
    const pending = POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: 'ETF가 뭐예요?', symbol: 'GENERAL' }));
    await vi.waitFor(() => expect(state.budget).toHaveBeenCalled());
    expect(state.from).toHaveBeenCalledWith('ai_usage');
    expect(state.claude).not.toHaveBeenCalled();
    releaseTier('free');
    expect((await pending).status).toBe(200);
  });

  it.each([false, true])('retains provider accounting before finishing, including invalid=%s answers', async invalid => {
    vi.useRealTimers();
    let releaseCost!: () => void;
    state.cost.mockImplementation(() => new Promise<void>(resolve => { releaseCost = resolve; }));
    if (invalid) state.claude.mockResolvedValue({ ...report, finishReason: 'INCOMPLETE', usage: {} });
    let finished = false;
    const pending = POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: 'ETF가 뭐예요?', symbol: 'GENERAL' })).then(result => { finished = true; return result; });
    await vi.waitFor(() => expect(state.finalize).toHaveBeenCalled());
    expect(finished).toBe(false);
    expect(state.rows).toHaveLength(invalid ? 0 : 1);
    releaseCost();
    expect((await pending).status).toBe(invalid ? 502 : 200);
  });

  it('generates while a retrieval call is still finishing, answers without waiting for it, and completes its cost record after the response', async () => {
    vi.useRealTimers();
    let releaseCosts!: () => void;
    const costs = new Promise<void>(resolve => { releaseCosts = resolve; });
    state.evidence.mockResolvedValue({ version: 1, symbol: 'MU', period: '1d', checkedAt: new Date(NOW).toISOString(), comparisons: [], gaps: [], evidence: [], price: { symbol: 'MU', label: '마이크론', day: '2026-10-05', baselineDay: '2026-10-02', at: new Date(NOW).toISOString(), price: 100, changePercent: 1, currency: 'USD' } });
    state.articles.mockImplementation(async (_packet, _progress, _shared, track) => {
      track(costs);
      return [{ id: 'A1', kind: 'article', scope: 'company', title: '마이크론 기사', text: 'PUBLIC_ARTICLE', url: 'https://finance.yahoo.com/news/micron', publisher: 'Yahoo', publishedAt: '2026-10-05', checkedAt: new Date(NOW).toISOString() }];
    });
    // The retrieval call returns its articles as soon as they arrive and keeps running to report real usage.
    const response = await POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: '마이크론은 왜 올랐어요?', symbol: 'MU' }));
    expect(response.status).toBe(200);
    expect(state.claude).toHaveBeenCalledOnce(); expect(state.rows).toHaveLength(1);
    // The record is not skipped: it is finished by the work scheduled for after the response.
    expect(state.qualityAfter).toHaveLength(1);
    let recorded = false;
    const afterResponse = state.qualityAfter[0]().then(() => { recorded = true; });
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(recorded).toBe(false);
    releaseCosts();
    await afterResponse;
    expect(recorded).toBe(true);
  });
});

it('links fund references without a market lookup for a hypothetical calculation', async () => {
 const parsed = JSON.parse(report.text);
 parsed.currentStatus = '하루마다 달라진 금액을 기준으로 다시 계산해요.';
 parsed.assistantInsights = [{kind:'interpretation',text:'여러 날의 수익은 하루 목표 배수와 달라질 수 있어요.',evidenceIds:['R1']}];
 state.claude.mockResolvedValue({...report,text:JSON.stringify(parsed),finishReason:'STOP',provider:'claude',model:'claude-haiku-5-5'});
 const response = await POST(request('POST',{questionId:'ask-joobi',questionConsent:true,questionText:'만약 지수가 10% 내렸다가 10% 오르면 왜 원금이 달라져요?',symbol:'SOXL'}));
 expect(response.status).toBe(200);
 expect(state.evidence).not.toHaveBeenCalled(); expect(state.articles).not.toHaveBeenCalled();
 expect(state.claude.mock.calls[0][5]).toBe('medium');
 const data = await response.json();
 expect(data.report.assistantEvidence.evidence[0]).toMatchObject({id:'R1',kind:'reference'});
 expect(state.rows).toHaveLength(1);
});


describe('question quality boundary with collection enabled', () => {
  it('responds before writing metrics, without any conversation text in the write', async () => {
    vi.stubEnv('JOOBI_QUESTION_QUALITY_ENABLED', 'true');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-quality-signing-key');
    const response = await POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: 'ETF가 뭐예요?', symbol: 'GENERAL' }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.report.qualityReceipt).toEqual(expect.any(String));
    expect(state.qualityWrite).not.toHaveBeenCalled();
    expect(state.qualityAfter).toHaveLength(1);
    await state.qualityAfter[0]();
    const event = state.qualityWrite.mock.calls[0][0];
    expect(event).toMatchObject({ topic: 'definition', outcome: 'ready', failure: 'none', asset: 'market' });
    for (const key of ['question','answer','history','user_id','ip','symbol']) expect(event).not.toHaveProperty(key);
    expect(JSON.stringify(event)).not.toContain('ETF가');
  });
  it('records final validation failure without storing the rejected answer', async () => {
    vi.stubEnv('JOOBI_QUESTION_QUALITY_ENABLED', 'true');
    state.claude.mockResolvedValue({ ...report, finishReason: 'INCOMPLETE', usage: {} });
    const response = await POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: 'ETF가 뭐예요?', symbol: 'GENERAL' }));
    expect(response.status).toBe(502);
    await state.qualityAfter[0]();
    expect(state.qualityWrite).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'blocked', failure: 'validation' }));
    expect(JSON.stringify(state.qualityWrite.mock.calls)).not.toContain('기업 지표');
  });
  it('does not write an event for unauthenticated requests', async () => {
    vi.stubEnv('JOOBI_QUESTION_QUALITY_ENABLED', 'true');
    state.getUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(request('POST', { questionId: 'ask-joobi', questionConsent: true, questionText: 'ETF가 뭐예요?', symbol: 'GENERAL' }));
    expect(response.status).toBe(401);
    await state.qualityAfter[0]();
    expect(state.qualityWrite).not.toHaveBeenCalled();
  });
});
