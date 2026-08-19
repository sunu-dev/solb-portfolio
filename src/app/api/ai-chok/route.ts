import { NextRequest, NextResponse } from 'next/server';
import { getAuthClient, getServiceClient } from '@/lib/supabaseServer';
import { CHOK_UNIVERSE, CHOK_SECTOR_MAP, sectorLabel } from '@/config/chokUniverse';
import { isBlockedLeverage } from '@/utils/leverageGuard';
import { CHOK_SYSTEM_PROMPT } from '@/config/analysisPrompt';
import { enforceRateLimit, POLICIES } from '@/lib/rateLimiter';
import { checkCircuit, CIRCUIT_POLICIES, circuitOpenResponse } from '@/lib/circuitBreaker';
import { callAiJson, AiProviderError, getProviderStatus } from '@/lib/aiProvider';
import { enrichUniverse, formatStockLine } from '@/utils/chokDataEnricher';
import { generateFallbackPicks, deterministicSlice } from '@/utils/chokFallback';
import { getUserTier, getTierLimits } from '@/lib/userTier';
import { sanitizeAiObject } from '@/utils/alertCompliance';
import { getAiMonthlyBudgetStatus } from '@/lib/aiBudgetGuard';
import { sampleAiOutput } from '@/lib/aiOutputAudit';
import { attachAiResultMeta, type AiResultMeta } from '@/lib/aiResultMeta';
import { analyzeMarketFlow, type MarketFlowResult } from '@/utils/marketFlow';
import { hasCurrentAdultAiConsent } from '@/lib/aiAgeGate';

// auth.getUser는 anon client로 (token 검증)
// ai_chok_cache(RLS: service-only) / ai_chok_recommendations(INSERT policy 없음) 등 RLS-보호 테이블은
// service-role admin client로 접근해야 캐시 hit / 백테스트 누적이 실제 작동함.

const CHOK_USAGE_TAG = 'ai-chok';
const DAILY_LIMIT_TOTAL = parseInt(process.env.AI_DAILY_LIMIT_TOTAL || '250', 10);

// ─── 세션 라벨 (UX용 — 카운팅과 무관) ────────────────────────────────────────
// day  세션: 09:00 ~ 22:29 KST (미장 개장 전)
// night세션: 22:30 ~ 08:59 KST (미장 개장 후)
function getSessionKey(): { date: string; session: 'day' | 'night' } {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dateStr = kst.toISOString().split('T')[0];
  const hour = kst.getUTCHours();
  const minute = kst.getUTCMinutes();
  const totalMin = hour * 60 + minute;
  const isNight = totalMin >= 1350 || totalMin < 540;
  return { date: dateStr, session: isNight ? 'night' : 'day' };
}

function sessionLabel(session: 'day' | 'night'): string {
  return session === 'night' ? '밤(미장) 기준' : '낮 기준';
}

// ─── VIX 양자화 (캐시 키 안정화 — 같은 regime 내에선 cache 히트) ─────────────
function vixBucket(macroContext: string): string {
  const m = macroContext.match(/VIX\s+([\d.]+)/);
  if (!m) return 'unknown';
  const v = Number(m[1]);
  if (v > 30) return 'panic';
  if (v > 25) return 'fear';
  if (v > 20) return 'unease';
  if (v < 15) return 'calm';
  return 'normal';
}

// ─── 일별 AI 촉 사용량 (ai_usage 테이블, mentor_id='ai-chok' 만) ─────────────
function getTodayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

async function getDailyChokUsage(userId: string): Promise<{ available: boolean; userCount: number; totalCount: number }> {
  const supabaseAdmin = getServiceClient();
  if (!supabaseAdmin) return { available: false, userCount: 0, totalCount: 0 };
  try {
    const [userResult, totalResult] = await Promise.all([
      supabaseAdmin.from('ai_usage').select('*', { count: 'exact', head: true })
        .eq('date', getTodayKST()).eq('user_id', userId).eq('mentor_id', CHOK_USAGE_TAG),
      supabaseAdmin.from('ai_usage').select('*', { count: 'exact', head: true })
        .eq('date', getTodayKST()),
    ]);
    if (userResult.error || totalResult.error) {
      console.error('[AI chok] usage guard unavailable:', userResult.error?.message || totalResult.error?.message);
      return { available: false, userCount: 0, totalCount: 0 };
    }
    return { available: true, userCount: userResult.count || 0, totalCount: totalResult.count || 0 };
  } catch {
    return { available: false, userCount: 0, totalCount: 0 };
  }
}

// ─── 캐시 (다양성 트래킹용 — 한도 카운팅과 분리) ────────────────────────────
async function getCachedPicks(userKey: string, dateKey: string) {
  const supabaseAdmin = getServiceClient();
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
      .from('ai_chok_cache')
      .select('picks, use_count, excluded_recent')
      .eq('user_key', userKey)
      .eq('date', dateKey)
      .maybeSingle();
    return data as { picks: unknown; use_count: number; excluded_recent: string[] | null } | null;
  } catch { return null; }
}

/**
 * 24h 이내 가장 최근 캐시 (정확 키 매칭 실패 시 fallback lookup).
 * 새 세션 진입 직후에도 어제 캐시 그대로 표시 가능 → 빈 화면 방지.
 */
async function getRecentCachedPicks(userKey: string) {
  const supabaseAdmin = getServiceClient();
  if (!supabaseAdmin) return null;
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from('ai_chok_cache')
      .select('picks, use_count, created_at')
      .eq('user_key', userKey)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as { picks: unknown; use_count: number; created_at: string } | null;
  } catch { return null; }
}

async function upsertCache(userKey: string, dateKey: string, picks: unknown, useCount: number, excludedRecent: string[]) {
  const supabaseAdmin = getServiceClient();
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from('ai_chok_cache').upsert(
      {
        user_key: userKey,
        date: dateKey,
        picks,
        use_count: useCount,
        excluded_recent: excludedRecent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_key,date' }
    );
  } catch { /* silent */ }
}

// ─── 추천 로깅 (백테스트용) ─────────────────────────────────────────────────
interface PickRecord {
  symbol: string; krName: string; sector: string; reason: string; keyMetric: string;
}
interface ChokResult {
  picks: PickRecord[];
  context: string;
  marketFlow?: MarketFlowResult;
  _meta?: AiResultMeta;
  _provider?: string;
  _model?: string;
}
async function logRecommendations(opts: {
  userId?: string;
  ip: string;
  investorType: string;
  picks: PickRecord[];
  vixBucketStr: string;
  enrichedMap: Map<string, { currentPrice: number | null; peRatio: number | null; week52Position: number | null }>;
}) {
  const supabaseAdmin = getServiceClient();
  if (!supabaseAdmin) return;
  try {
    // 단일종목 레버리지·인버스 ETF/ETN은 백테스트 통계 왜곡 위험(생존편향) — 누적 차단 (P1, leverageGuard SSOT)
    const rows = opts.picks
      .filter(p => !isBlockedLeverage(p.symbol))
      .map(p => {
        const e = opts.enrichedMap.get(p.symbol);
        return {
          user_id: opts.userId || null,
          ip: opts.ip,
          investor_type: opts.investorType,
          symbol: p.symbol,
          sector: p.sector,
          reason: p.reason,
          key_metric: p.keyMetric,
          vix_bucket: opts.vixBucketStr,
          current_price: e?.currentPrice ?? null,
          pe_ratio: e?.peRatio ?? null,
          week52_position: e?.week52Position ?? null,
        };
      });
    if (rows.length === 0) return;
    await supabaseAdmin.from('ai_chok_recommendations').insert(rows);
  } catch (e) {
    // 백테스트 데이터 손실은 운영 가시화 필수
    console.error('[ai-chok] logRecommendations failed:', e);
  }
}

// ─── handler ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const provider = getProviderStatus();
  if (!provider.geminiKeys && !provider.claudeAvailable) {
    return NextResponse.json({ error: 'AI 서비스가 준비 중이에요.' }, { status: 503 });
  }

  // ── 1. 인증/요청 파싱 (캐시 키 빌드 위해 우선 처리) ─────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  let userId: string | undefined;
  const authHeader = req.headers.get('authorization');
  const supabase = getAuthClient();
  const supabaseAdmin = getServiceClient();
  if (authHeader?.startsWith('Bearer ') && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id;
    } catch { /* not logged in */ }
  }

  const isLoggedIn = !!userId;

  // ── 비로그인 차단 (정책: AI 촉은 로그인 사용자 전용) ─────────────
  if (!isLoggedIn) {
    return NextResponse.json({
      error: '시장 관찰판은 로그인 후 이용할 수 있어요.',
      limitReached: true,
      loginForMore: true,
    }, { status: 401 });
  }
  if (!await hasCurrentAdultAiConsent(supabaseAdmin, userId!)) {
    return NextResponse.json({
      error: '만 18세 이상 확인 후 시장 관찰판을 이용할 수 있어요.',
      code: 'adult_consent_required',
    }, { status: 403 });
  }

  // ── 멤버십 티어 + 일일 한도 ─────────────────────────────────────
  const tier = await getUserTier(userId);
  const dailyLimit = getTierLimits(tier).chokDaily;

  const { date, session } = getSessionKey();

  const body = await req.json() as {
    forceRefresh?: boolean;
    intent?: 'fetch' | 'generate';
    macroContext?: string;
    currentEvent?: string;
  };
  const {
    forceRefresh = false,
    // 호환: intent 미지정 시 forceRefresh로 추정 — 신규 클라이언트는 intent 명시 권장
    intent = forceRefresh ? 'generate' : 'fetch',
    macroContext,
    currentEvent,
  } = body;

  // 캐시 키 — VIX bucket까지 포함해 macro regime 변동 시 자동 invalidate
  const vixBucketStr = vixBucket(macroContext || '');
  const cacheDateKey = `${date}_${session}_${vixBucketStr}`;
  // 시장 관찰판 결과는 사용자별로 달라지지 않는다. 같은 시장 세션에는 같은 캐시·목록을 사용한다.
  const sharedMarketKey = 'shared-market-observation';
  const cached = await getCachedPicks(sharedMarketKey, cacheDateKey);
  const enriched = await enrichUniverse();
  const marketFlow = analyzeMarketFlow(enriched);

  // 일일 사용량 조회 (캐시 히트 분기에서도 잔여 횟수 응답에 사용)
  const { available: usageAvailable, userCount: dailyCount, totalCount } = await getDailyChokUsage(userId!);
  const remaining = Math.max(0, dailyLimit - dailyCount);

  // ── 2-A. intent='fetch' → AI 호출 절대 X (마운트/타입변경 시) ───
  //         정책: 사용자 명시 동작이 없으면 한도/quota 차감 금지.
  if (intent === 'fetch') {
    // 정확 키 매칭
    if (cached?.picks) {
      return NextResponse.json({
        picks: (cached.picks as { picks: unknown }).picks ?? cached.picks,
        context: (cached.picks as { context: string }).context ?? '',
        marketFlow: (cached.picks as { marketFlow?: MarketFlowResult }).marketFlow ?? marketFlow,
        _meta: (cached.picks as { _meta?: AiResultMeta })._meta,
        cached: true,
        fallback: false,
        sessionLabel: sessionLabel(session),
        remaining,
        dailyLimit,
        tier,
      });
    }
    // 24h 이내 가장 최근 캐시 (다른 session/vix bucket이라도 사용)
    const recent = await getRecentCachedPicks(sharedMarketKey);
    if (recent?.picks) {
      return NextResponse.json({
        picks: (recent.picks as { picks: unknown }).picks ?? recent.picks,
        context: (recent.picks as { context: string }).context ?? '',
        marketFlow: (recent.picks as { marketFlow?: MarketFlowResult }).marketFlow ?? marketFlow,
        _meta: (recent.picks as { _meta?: AiResultMeta })._meta,
        cached: true,
        fallback: false,
        stale: true,
        sessionLabel: sessionLabel(session),
        remaining,
        dailyLimit,
        tier,
      });
    }
    // 폴백 — 객관 수치 기반 결정론적 선택 (AI 호출 X)
    const fbPicks = generateFallbackPicks({ enriched, excludedSymbols: new Set() });
    return NextResponse.json({
      picks: fbPicks,
      context: '모든 사용자에게 동일한 PER·52주 위치 기준을 적용한 시장 관찰 목록이에요.',
      marketFlow,
      cached: false,
      fallback: true,
      sessionLabel: sessionLabel(session),
      remaining,
      dailyLimit,
      tier,
    });
  }

  // ── 2-B. intent='generate' but 캐시 히트 → 정확 키이고 forceRefresh 아니면 캐시 반환 ──
  if (intent === 'generate' && !forceRefresh && cached?.picks) {
    return NextResponse.json({
      picks: (cached.picks as { picks: unknown }).picks ?? cached.picks,
      context: (cached.picks as { context: string }).context ?? '',
      marketFlow: (cached.picks as { marketFlow?: MarketFlowResult }).marketFlow ?? marketFlow,
      _meta: (cached.picks as { _meta?: AiResultMeta })._meta,
      cached: true,
      fallback: false,
      sessionLabel: sessionLabel(session),
      remaining,
      dailyLimit,
      tier,
    });
  }

  // ── 3. 여기부터는 실제 AI 호출 경로 → 레이트/서킷/일일 한도 체크 ─
  const gate = await enforceRateLimit(req, '/api/ai-chok', POLICIES.aiAnalysis);
  if (!gate.ok) return gate.response;

  const circuit = await checkCircuit('/api/ai-chok', CIRCUIT_POLICIES.aiStrict);
  if (circuit.open) {
    console.warn('[CIRCUIT OPEN] /api/ai-chok:', circuit.reason);
    await gate.finalize(503, 'circuit_open');
    return circuitOpenResponse(circuit, '/api/ai-chok');
  }

  if (!usageAvailable) {
    await gate.finalize(503, 'daily_usage_unavailable');
    return NextResponse.json({
      error: 'AI 사용량 확인 시스템을 점검하고 있어요. 잠시 후 다시 시도해주세요.',
      code: 'daily_usage_unavailable',
    }, { status: 503 });
  }

  // 일일 한도 (tier 기반)
  if (totalCount >= DAILY_LIMIT_TOTAL) {
    await gate.finalize(429, 'daily_total_limit');
    return NextResponse.json({
      error: '오늘 전체 AI 이용량이 한도에 도달했어요. 내일 다시 이용해주세요.',
      limitReached: true,
      remaining: 0,
    }, { status: 429 });
  }

  if (dailyCount >= dailyLimit) {
    const msg = `오늘 시장 관찰판 갱신 횟수를 모두 사용했어요 (${dailyLimit}회/일). 내일 다시 이용해주세요.`;
    await gate.finalize(429, 'daily_limit');
    return NextResponse.json({
      error: msg,
      limitReached: true,
      remaining: 0,
      dailyLimit,
      tier,
    }, { status: 429 });
  }

  const budget = await getAiMonthlyBudgetStatus();
  if (!budget.allowed) {
    // 새 추론 대신 24시간 내 캐시를 우선 제공한다.
    const recent = await getRecentCachedPicks(sharedMarketKey);
    if (recent?.picks) {
      await gate.finalize(200, 'monthly_budget_cache_fallback');
      return NextResponse.json({
        picks: (recent.picks as { picks: unknown }).picks ?? recent.picks,
        context: (recent.picks as { context: string }).context ?? '',
        marketFlow: (recent.picks as { marketFlow?: MarketFlowResult }).marketFlow ?? marketFlow,
        _meta: (recent.picks as { _meta?: AiResultMeta })._meta,
        cached: true,
        stale: true,
        budgetLimited: true,
        sessionLabel: sessionLabel(session),
        remaining,
        dailyLimit,
        tier,
      });
    }

    await gate.finalize(503, budget.reason || 'monthly_budget_limit');
    return NextResponse.json({
      error: budget.reason === 'ledger_unavailable'
        ? 'AI 비용 확인 시스템을 점검하고 있어요. 잠시 후 다시 시도해주세요.'
        : '이번 달 AI 이용 한도에 도달했어요. 다음 달에 다시 이용해주세요.',
      code: budget.reason || 'monthly_budget_limit',
      budgetLimited: true,
    }, { status: 503 });
  }

  // ── Finnhub로 universe 객관 데이터 enrich (캐시 24h)
  const enrichedMap = new Map(enriched.map(e => [e.symbol, e]));

  const excluded = new Set<string>();
  // chokUniverse는 미국 우량주 + 글로벌 ETF만 하드코딩되어 단일종목 레버리지 없음 (영구 안전).
  // 보강: 향후 chokUniverse에 실수로 추가되어도 leverageGuard SSOT가 차단.
  const allowedUniverse = CHOK_UNIVERSE.filter(
    s => !excluded.has(s.symbol) && !isBlockedLeverage(s.symbol, s.krName),
  );

  // G안 — universe deterministic slice: 매 호출마다 다른 35종 풀 노출
  const sliceSeed = `${cacheDateKey}:${cached?.use_count ?? 0}`;
  const slicedUniverse = deterministicSlice(allowedUniverse, 35, sliceSeed);

  // 객관 수치 블록 — 한 종목 1줄 (slice된 풀만)
  const enrichedBlock = slicedUniverse.map(u => {
    const e = enrichedMap.get(u.symbol);
    if (!e) return `${u.symbol}(${u.krName}/${sectorLabel(u.sector)}) · 데이터 없음`;
    return formatStockLine(e, u.krName, u.sector, sectorLabel(u.sector));
  }).join('\n');

  // 오늘 universe movers 한 줄 컨텍스트 (B — AI 모멘텀 인지)
  const todayMovers = (() => {
    const withDp = slicedUniverse
      .map(u => ({ u, e: enrichedMap.get(u.symbol) }))
      .filter(x => x.e?.todayChangePct !== null && x.e?.todayChangePct !== undefined);
    if (withDp.length === 0) return '';
    const sorted = [...withDp].sort((a, b) => (b.e!.todayChangePct! - a.e!.todayChangePct!));
    const gainers = sorted.slice(0, 3).map(x => `${x.u.symbol} ${x.e!.todayChangePct! >= 0 ? '+' : ''}${x.e!.todayChangePct!.toFixed(1)}%`).join(', ');
    const losers = sorted.slice(-3).reverse().map(x => `${x.u.symbol} ${x.e!.todayChangePct!.toFixed(1)}%`).join(', ');
    return `\n\n## 오늘 universe 내 변동 상위 (참고용)\n상승 TOP 3: ${gainers}\n하락 TOP 3: ${losers}\n단기 변동을 그대로 보여주는 공개 시장 정보이며 종목 평가나 선정 기준으로 사용하지 않아요.`;
  })();

  const prompt = CHOK_SYSTEM_PROMPT
    .replace('{MACRO_CONTEXT}', macroContext || '데이터 없음')
    .replace('{CURRENT_EVENT}', currentEvent || '없음')
    .replace('{ENRICHED_UNIVERSE}', enrichedBlock)
    + todayMovers
    + `\n\n위 객관 수치 표와 시장 컨텍스트만 사용해 서로 다른 섹터 3개의 관찰 항목을 고르세요. 이 결과는 모든 사용자에게 동일해야 합니다.`;

  // ── AI 호출 + 검증 + 재시도 (서로 다른 섹터 3개 강제)
  async function callAndValidate(extraInstruction = ''): Promise<ChokResult | null> {
    const finalPrompt = prompt + extraInstruction;
    const aiRes = await callAiJson({
      prompt: finalPrompt,
      temperature: 0.6,
      maxTokens: 2048,
      feature: 'ai-chok',
      userId,
    });
    const parsed = JSON.parse(aiRes.text) as { picks: Array<PickRecord>; context: string };

    // universe 필터 + 제외 필터
    const inUniverse = (parsed.picks || []).filter(
      p => CHOK_UNIVERSE.some(u => u.symbol === p.symbol) && !excluded.has(p.symbol)
    );

    // sector 다양성 강제 (universe sector 기준 — AI가 보낸 sector 필드 신뢰 안 함)
    const seenSectors = new Set<string>();
    const diverse: PickRecord[] = [];
    for (const p of inUniverse) {
      const realSec = CHOK_SECTOR_MAP[p.symbol];
      if (!realSec || seenSectors.has(realSec)) continue;
      seenSectors.add(realSec);
      diverse.push({ ...p, sector: sectorLabel(realSec) });
      if (diverse.length >= 3) break;
    }

    if (diverse.length < 3) return null;
    return {
      picks: diverse,
      context: parsed.context || '',
      _provider: aiRes.provider,
      _model: aiRes.model,
    };
  }

  try {
    let result = await callAndValidate();
    if (!result) {
      result = await callAndValidate(
        '\n\n중요: 위 표에서 *섹터(괄호 안 한국어 라벨)가 모두 다른* 종목 3개를 반드시 골라주세요. 같은 섹터 중복 금지.'
      );
    }
    if (!result) {
      const pickedSectors = new Set<string>();
      const fallback: PickRecord[] = [];
      for (const u of allowedUniverse) {
        if (pickedSectors.has(u.sector)) continue;
        pickedSectors.add(u.sector);
        fallback.push({
          symbol: u.symbol,
          krName: u.krName,
          sector: sectorLabel(u.sector),
          reason: '대표 종목',
          keyMetric: '데이터 부족으로 보수적 선택',
        });
        if (fallback.length >= 3) break;
      }
      result = { picks: fallback, context: 'AI 응답이 부족해 보수적 폴백을 선택했어요.' };
    }

    // AI 응답 컴플라이언스 후처리 (FORBIDDEN_PHRASES 자동 교체)
    const { result: sanitized } = sanitizeAiObject(result);
    const { _provider, _model, ...publicResult } = sanitized;
    result = attachAiResultMeta({ ...publicResult, marketFlow }, 'ai-chok', {
      aiProvider: _provider || 'deterministic',
      aiModel: _model || 'rule-based-fallback',
    });
    const auditSnapshot = {
      capturedAt: new Date().toISOString(),
      marketContext: macroContext || null,
      currentEvent: currentEvent || null,
      picks: result.picks.map(pick => {
        const source = enrichedMap.get(pick.symbol);
        return {
          symbol: pick.symbol,
          currentPrice: source?.currentPrice ?? null,
          todayChangePct: source?.todayChangePct ?? null,
          peRatio: source?.peRatio ?? null,
          week52Position: source?.week52Position ?? null,
          sector: pick.sector,
        };
      }),
    };
    await sampleAiOutput({ feature: 'ai-chok', output: result, sourceSnapshot: auditSnapshot });

    const newCount = (cached?.use_count || 0) + 1;

    // A안 — excluded_recent 누적: 같은 캐시 row 내에서 새로고침마다 직전 picks symbol 추가
    const newExcludedRecent = Array.from(new Set([
      ...(cached?.excluded_recent || []),
      ...result.picks.map(p => p.symbol),
    ]));

    const [, usageResult] = await Promise.all([
      upsertCache(sharedMarketKey, cacheDateKey, result, newCount, newExcludedRecent),
      supabaseAdmin
        ? supabaseAdmin.from('ai_usage').insert({
            ip,
            user_id: userId || null,
            date,
            symbol: null,
            mentor_id: CHOK_USAGE_TAG,
          })
        : Promise.resolve({ error: new Error('Supabase admin client unavailable') }),
      logRecommendations({
        userId, ip, investorType: 'balanced',
        picks: result.picks,
        vixBucketStr,
        enrichedMap: new Map(
          Array.from(enrichedMap.entries()).map(([k, v]) => [
            k,
            { currentPrice: v.currentPrice, peRatio: v.peRatio, week52Position: v.week52Position },
          ])
        ),
      }),
    ]);

    if (usageResult.error) console.error('[AI chok] usage record failed:', usageResult.error.message);
    await gate.finalize(200, usageResult.error ? 'usage_record_failed' : undefined);
    return NextResponse.json({
      ...result,
      cached: false,
      sessionLabel: sessionLabel(session),
      remaining: Math.max(0, dailyLimit - dailyCount - 1),
      dailyLimit,
      tier,
    });
  } catch (e) {
    if (e instanceof AiProviderError) {
      console.error('[SOLB CHOK] all providers failed:', e.causes);
      const isQuota = e.causes.some(c => /quota|429|RESOURCE_EXHAUSTED/i.test(c.message));
      await gate.finalize(503, isQuota ? 'ai_quota' : 'ai_failed');
      return NextResponse.json({
        error: isQuota
          ? 'AI 서비스 오늘 할당량을 모두 사용했어요. 내일 다시 시도해주세요.'
          : '시장 관찰판에 잠시 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
      }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[SOLB CHOK] parse/unknown error:', msg.slice(0, 200));
    await gate.finalize(500, 'parse_failed');
    return NextResponse.json({ error: 'AI 응답 처리 중 오류가 발생했어요.' }, { status: 500 });
  }
}
