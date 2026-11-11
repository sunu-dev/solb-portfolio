import { it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { NextRequest } from 'next/server';

// 서버 경로 전체를 실제 모델·실제 시세·실제 기사 수집으로 호출해 보는 검수 도구(로그인 없이 확인할 수 있는 가장 운영에 가까운 형태).
// 대체하는 것: 로그인 확인, 연령 동의, 요청 한도, 이용 횟수 기록, 비용 기록, 월 예산 확인, 응답 뒤 작업 등록. 그 밖의 경로는 실제 코드다.
// 실행: JOOBI_ROUTE_LIVE=1 JOOBI_ROUTE_OUT=<결과 json> npx vitest run 이 파일. 실제 AI 비용이 든다. 실제 사용자 대화는 넣지 않는다.
const live = process.env.JOOBI_ROUTE_LIVE === '1';
const state = vi.hoisted(() => {
  if (process.env.JOOBI_ROUTE_LIVE === '1') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    for (const line of (require('node:fs') as typeof import('node:fs')).readFileSync('.env.local', 'utf8').split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
    process.env.JOOBI_QUESTION_QUALITY_ENABLED = 'false';
  }
  return { noArticles: false, usageWrites: 0, costs: [] as Record<string, unknown>[], after: [] as (() => unknown)[] };
});
vi.mock('next/server', async original => ({ ...await original<typeof import('next/server')>(), after: (work: () => unknown) => { state.after.push(work); } }));
vi.mock('next/cache', () => ({ unstable_cache: (work: () => unknown) => work }));
vi.mock('@/lib/rateLimiter', async original => ({ ...await original<typeof import('@/lib/rateLimiter')>(),
  getAuthOutcome: async () => ({ status: 'authenticated', userId: 'synthetic-review-user' }),
  enforceRateLimit: async () => ({ ok: true, finalize: async () => {} }) }));
vi.mock('@/lib/circuitBreaker', async original => ({ ...await original<typeof import('@/lib/circuitBreaker')>(), checkCircuit: async () => ({ open: false }) }));
vi.mock('@/lib/aiAgeGate', () => ({ checkCurrentAdultAiConsent: async () => ({ status: 'granted' }) }));
vi.mock('@/lib/userTier', async original => ({ ...await original<typeof import('@/lib/userTier')>(), getUserTier: async () => 'free' }));
vi.mock('@/lib/analysisUsage', () => ({ getAnalysisUsage: async () => ({ available: true, day: '2026-11-12', userCount: 0, totalCount: 0 }) }));
vi.mock('@/lib/aiBudgetGuard', () => ({ getAiMonthlyBudgetStatus: async () => ({ allowed: true }) }));
vi.mock('@/lib/aiCostLedger', async original => ({ ...await original<typeof import('@/lib/aiCostLedger')>(), recordAiCost: async (entry: Record<string, unknown>) => { state.costs.push(entry); } }));
vi.mock('@/lib/assistantArticleSources', async original => {
  const actual = await original<typeof import('@/lib/assistantArticleSources')>();
  return { ...actual, collectAssistantArticles: (...args: Parameters<typeof actual.collectAssistantArticles>) => state.noArticles ? Promise.resolve([]) : actual.collectAssistantArticles(...args) };
});
// Real reads (market watch, company business); the usage ledger write is replaced so nothing is written for the synthetic user.
vi.mock('@/lib/supabaseServer', async original => {
  const actual = await original<typeof import('@/lib/supabaseServer')>();
  const usageTable = { insert: () => ({ abortSignal: async () => { state.usageWrites++; return { error: null }; } }) };
  const wrap = <T extends object | null>(client: T): T => client && new Proxy(client, { get(target, property, receiver) {
    if (property === 'from') return (table: string) => table === 'ai_usage' ? usageTable : (target as { from: (name: string) => unknown }).from(table);
    const value = Reflect.get(target, property, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  } }) as T;
  return { ...actual, getServiceClient: (...args: Parameters<typeof actual.getServiceClient>) => wrap(actual.getServiceClient(...args)), requireServiceClient: () => wrap(actual.requireServiceClient()) };
});

interface Turn { question: string; answer: string; symbol?: string; market?: 'kr' | 'us'; period?: string }
it.skipIf(!live)('runs real questions through the whole server path', async () => {
  const { POST } = await import('@/app/api/ai-analysis/route');
  const scenarios: { name: string; symbol: string; market: 'kr' | 'us'; noArticles?: boolean; turns: string[] }[] = JSON.parse(readFileSync(process.env.JOOBI_ROUTE_SCENARIOS!, 'utf8'));
  const out: unknown[] = [];
  // The route explains a withheld answer only in its server log (codes, never text). Keep those lines with each record.
  const serverNotes: string[] = [];
  const note = (...args: unknown[]) => { if (typeof args[0] === 'string' && /joobi-validation|AI analysis\]|joobi-step-timing/.test(args[0])) serverNotes.push(args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ')); };
  vi.spyOn(console, 'warn').mockImplementation(note); vi.spyOn(console, 'info').mockImplementation(note);
  for (const scenario of scenarios) {
    const history: Turn[] = [];
    for (const questionText of scenario.turns) {
      state.noArticles = !!scenario.noArticles; state.after.length = 0; state.costs.length = 0; serverNotes.length = 0;
      const usageBefore = state.usageWrites, started = Date.now();
      const request = new NextRequest('https://joobi.test/api/ai-analysis', { method: 'POST',
        headers: { Authorization: 'Bearer synthetic', 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({ questionId: 'ask-joobi', questionConsent: true, questionText, symbol: scenario.symbol, questionPeriod: '1d', questionMarket: scenario.market,
          historySymbol: scenario.symbol, questionHistory: history.slice(-3), unclearTerms: [] }) });
      const response = await POST(request);
      const reader = response.body!.getReader(), decoder = new TextDecoder();
      const events: { atMs: number; type: string; stage?: string; status?: number; preview?: unknown; body?: Record<string, unknown> }[] = [];
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) { events.push({ atMs: Date.now() - started, ...JSON.parse(buffer.slice(0, newline)) }); buffer = buffer.slice(newline + 1); }
      }
      const answeredMs = Date.now() - started;
      const afterStarted = Date.now();
      await Promise.all(state.after.map(work => work()));
      const result = events.find(event => event.type === 'result'), body = result?.body ?? {}, report = (body.report ?? {}) as Record<string, unknown>;
      const evidence = (report.assistantEvidence as { evidence?: { id: string; kind: string }[]; gaps?: string[] } | undefined);
      const record = { scenario: scenario.name, question: questionText, status: result?.status, code: body.code, error: body.error, answeredMs,
        timeline: events.map(event => `${event.atMs}ms ${event.type}${event.stage ? ':' + event.stage : ''}`), preview: events.find(event => event.type === 'preview')?.preview,
        afterResponse: { callbacks: state.after.length, settledAfterMs: Date.now() - afterStarted }, usageCharged: state.usageWrites - usageBefore,
        costRecords: state.costs.map(cost => `${cost.feature}:${cost.model}:${cost.success ? 'ok' : cost.errorCode}`), serverNotes: [...serverNotes],
        evidenceKinds: evidence?.evidence?.map(item => `${item.id}:${item.kind}`), gaps: evidence?.gaps,
        currentStatus: report.currentStatus, keyAdvice: report.keyAdvice, insights: (report.assistantInsights as { text: string }[] | undefined)?.map(item => item.text), followUps: report.followUps,
        subject: body.subject, sourceCount: (report._meta as { sourceDetails?: unknown[] } | undefined)?.sourceDetails?.length };
      out.push(record);
      writeFileSync(process.env.JOOBI_ROUTE_OUT!, JSON.stringify(out, null, 2));
      if (result?.status === 200 && typeof report.currentStatus === 'string') {
        const subject = (body.subject ?? {}) as { symbol?: string; market?: 'kr' | 'us'; period?: string };
        history.push({ question: questionText, symbol: subject.symbol ?? scenario.symbol, market: subject.market, period: subject.period,
          answer: [report.currentStatus, ...((report.keyAdvice as string[]) ?? []), ...((report.assistantInsights as { text: string }[] | undefined) ?? []).map(item => item.text), (report.conclusion as { desc?: string } | undefined)?.desc ?? ''].join('\n').slice(0, 1800) });
      }
    }
  }
}, 900_000);
