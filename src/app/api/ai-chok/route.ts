import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CHOK_UNIVERSE, CHOK_SECTOR_MAP, sectorLabel } from '@/config/chokUniverse';
import { CHOK_SYSTEM_PROMPT, buildUserTypeContext } from '@/config/analysisPrompt';
import { DEFAULT_INVESTOR_TYPE, type InvestorType } from '@/config/investorTypes';
import { enforceRateLimit, POLICIES } from '@/lib/rateLimiter';
import { checkCircuit, CIRCUIT_POLICIES, circuitOpenResponse } from '@/lib/circuitBreaker';
import { callAiJson, AiProviderError, getProviderStatus } from '@/lib/aiProvider';
import { enrichUniverse, formatStockLine } from '@/utils/chokDataEnricher';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const SESSION_LIMIT = 3; // 세션당 수동 새로고침 횟수 (로그인 유저)
const DAILY_LIMIT_GUEST = 1;

// ─── 세션 계산 (KST 기준) ────────────────────────────────────────────────────
// day  세션: 09:00 ~ 22:29 KST (미장 개장 전)
// night세션: 22:30 ~ 08:59 KST (미장 개장 후)
function getSessionKey(): { date: string; session: 'day' | 'night' } {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dateStr = kst.toISOString().split('T')[0];
  const hour = kst.getUTCHours();
  const minute = kst.getUTCMinutes();
  const totalMin = hour * 60 + minute;
  // 22:30 = 1350분 / 09:00 = 540분
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

// ─── 캐시 (세션 단위) ────────────────────────────────────────────────────────
async function getCachedPicks(userKey: string, dateKey: string) {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('ai_chok_cache')
      .select('picks, use_count')
      .eq('user_key', userKey)
      .eq('date', dateKey)
      .maybeSingle();
    return data as { picks: unknown; use_count: number } | null;
  } catch { return null; }
}

async function upsertCache(userKey: string, dateKey: string, picks: unknown, useCount: number) {
  if (!supabase) return;
  try {
    await supabase.from('ai_chok_cache').upsert(
      { user_key: userKey, date: dateKey, picks, use_count: useCount },
      { onConflict: 'user_key,date' }
    );
  } catch { /* silent */ }
}

// ─── 추천 로깅 (백테스트용) ─────────────────────────────────────────────────
interface PickRecord {
  symbol: string; krName: string; sector: string; reason: string; keyMetric: string;
}
async function logRecommendations(opts: {
  userId?: string;
  ip: string;
  investorType: string;
  picks: PickRecord[];
  vixBucketStr: string;
  enrichedMap: Map<string, { currentPrice: number | null; peRatio: number | null; week52Position: number | null }>;
}) {
  if (!supabase) return;
  try {
    const rows = opts.picks.map(p => {
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
    await supabase.from('ai_chok_recommendations').insert(rows);
  } catch { /* 테이블 없으면 silent — backtest는 옵션 */ }
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
  if (authHeader?.startsWith('Bearer ') && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id;
    } catch { /* not logged in */ }
  }

  const isLoggedIn = !!userId;
  const userKey = userId || ip;
  const { date, session } = getSessionKey();
  const limit = isLoggedIn ? SESSION_LIMIT : DAILY_LIMIT_GUEST;

  const body = await req.json() as {
    portfolioSymbols?: string[];
    forceRefresh?: boolean;
    macroContext?: string;
    currentEvent?: string;
    sectorConcentration?: string;
    investorType?: InvestorType;
    holdingsContext?: string;
  };
  const {
    portfolioSymbols = [],
    forceRefresh = false,
    macroContext,
    currentEvent,
    sectorConcentration,
    investorType = DEFAULT_INVESTOR_TYPE,
    holdingsContext,
  } = body;

  // 캐시 키 — VIX bucket까지 포함해 macro regime 변동 시 자동 invalidate
  const vixBucketStr = vixBucket(macroContext || '');
  const cacheDateKey = `${date}_${session}_${vixBucketStr}`;
  const userKeyWithType = `${userKey}:${investorType}`;
  const cached = await getCachedPicks(userKeyWithType, cacheDateKey);

  // ── 2. 캐시 히트 → 레이트 리밋 소비 없이 즉시 반환 ──────────────
  if (!forceRefresh && cached?.picks) {
    return NextResponse.json({
      picks: (cached.picks as { picks: unknown }).picks ?? cached.picks,
      context: (cached.picks as { context: string }).context ?? '',
      cached: true,
      sessionLabel: sessionLabel(session),
      remaining: Math.max(0, limit - (cached.use_count || 1)),
    });
  }

  // ── 3. 여기부터는 실제 AI 호출 경로 → 레이트/서킷/세션 한도 체크 ─
  const gate = await enforceRateLimit(req, '/api/ai-chok', POLICIES.aiAnalysis);
  if (!gate.ok) return gate.response;

  const circuit = await checkCircuit('/api/ai-chok', CIRCUIT_POLICIES.aiStrict);
  if (circuit.open) {
    console.warn('[CIRCUIT OPEN] /api/ai-chok:', circuit.reason);
    await gate.finalize(503, 'circuit_open');
    return circuitOpenResponse(circuit, '/api/ai-chok');
  }

  // 세션 한도
  const currentCount = cached?.use_count || 0;
  if (currentCount >= limit) {
    const nextSession = session === 'day' ? '오후 10시 30분(미장 개장)' : '오전 9시';
    const msg = isLoggedIn
      ? `이번 세션 AI 촉 횟수를 모두 사용했어요 (${limit}회). ${nextSession} 이후 새 촉이 준비돼요!`
      : `비로그인 사용자는 세션당 ${limit}회까지 이용할 수 있어요. 로그인하면 ${SESSION_LIMIT}회까지 가능해요!`;
    await gate.finalize(429, 'session_limit');
    return NextResponse.json({ error: msg, limitReached: true, loginForMore: !isLoggedIn }, { status: 429 });
  }

  // ── Finnhub로 universe 객관 데이터 enrich (캐시 24h)
  const enriched = await enrichUniverse();
  const enrichedMap = new Map(enriched.map(e => [e.symbol, e]));

  const excluded = new Set(portfolioSymbols.map(s => s.toUpperCase()));
  const allowedUniverse = CHOK_UNIVERSE.filter(s => !excluded.has(s.symbol));

  // 객관 수치 블록 — 한 종목 1줄
  const enrichedBlock = allowedUniverse.map(u => {
    const e = enrichedMap.get(u.symbol);
    if (!e) return `${u.symbol}(${u.krName}/${sectorLabel(u.sector)}) · 데이터 없음`;
    return formatStockLine(e, u.krName, u.sector, sectorLabel(u.sector));
  }).join('\n');

  const excludeSymbols = portfolioSymbols.length ? portfolioSymbols.join(', ') : '없음';

  const prompt = CHOK_SYSTEM_PROMPT
    .replace('{USER_TYPE_CONTEXT}', buildUserTypeContext(investorType))
    .replace('{MACRO_CONTEXT}', macroContext || '데이터 없음')
    .replace('{CURRENT_EVENT}', currentEvent || '없음')
    .replace('{SECTOR_CONCENTRATION}', sectorConcentration || '데이터 없음')
    .replace('{ENRICHED_UNIVERSE}', enrichedBlock)
    .replace('{EXCLUDE_SYMBOLS}', excludeSymbols)
    + (holdingsContext
        ? `\n\n${holdingsContext}\n\n사용자가 위 핵심 종목들에 어떤 비중·신호·메모를 갖고 있는지 인지하고, 추천 종목이 사용자 포트폴리오의 약점(누락 섹터, 분산 부족, 고베타 편중 등)을 보완하거나 사용자 메모/관심 흐름에 자연스럽게 이어지도록 골라주세요.`
        : '')
    + `\n\n위 객관 수치 표와 시장 컨텍스트를 종합하여, 서로 다른 섹터 3개에 촉을 잡아주세요.`;

  // ── AI 호출 + 검증 + 재시도 (서로 다른 섹터 3개 강제)
  async function callAndValidate(extraInstruction = ''): Promise<{ picks: PickRecord[]; context: string } | null> {
    const finalPrompt = prompt + extraInstruction;
    const aiRes = await callAiJson({ prompt: finalPrompt, temperature: 0.4, maxTokens: 2048 });
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
      // sector 필드를 universe 기준으로 정규화
      diverse.push({ ...p, sector: sectorLabel(realSec) });
      if (diverse.length >= 3) break;
    }

    if (diverse.length < 3) return null; // 재시도 신호
    return { picks: diverse, context: parsed.context || '' };
  }

  try {
    let result = await callAndValidate();
    if (!result) {
      // 1회 재시도 — 더 강한 sector 다양성 지시
      result = await callAndValidate(
        '\n\n중요: 위 표에서 *섹터(괄호 안 한국어 라벨)가 모두 다른* 종목 3개를 반드시 골라주세요. 같은 섹터 중복 금지.'
      );
    }
    if (!result) {
      // 그래도 실패 → 폴백: universe sector 다양성 보장하는 결정론적 선택
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

    const newCount = currentCount + 1;

    await Promise.all([
      upsertCache(userKeyWithType, cacheDateKey, result, newCount),
      Promise.resolve(supabase?.from('ai_usage').insert({
        ip,
        user_id: userId || null,
        date,
        symbol: null,
        mentor_id: 'ai-chok',
      })).catch(() => {}),
      logRecommendations({
        userId, ip, investorType,
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

    await gate.finalize(200);
    return NextResponse.json({
      ...result,
      cached: false,
      sessionLabel: sessionLabel(session),
      remaining: Math.max(0, limit - newCount),
    });
  } catch (e) {
    if (e instanceof AiProviderError) {
      console.error('[SOLB CHOK] all providers failed:', e.causes);
      const isQuota = e.causes.some(c => /quota|429|RESOURCE_EXHAUSTED/i.test(c.message));
      await gate.finalize(503, isQuota ? 'ai_quota' : 'ai_failed');
      return NextResponse.json({
        error: isQuota
          ? 'AI 서비스 오늘 할당량을 모두 사용했어요. 내일 다시 시도해주세요.'
          : 'AI 촉 서비스에 잠시 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
      }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[SOLB CHOK] parse/unknown error:', msg.slice(0, 200));
    await gate.finalize(500, 'parse_failed');
    return NextResponse.json({ error: 'AI 응답 처리 중 오류가 발생했어요.' }, { status: 500 });
  }
}
