import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CHOK_UNIVERSE } from '@/config/chokUniverse';
import { CHOK_SYSTEM_PROMPT, buildUserTypeContext } from '@/config/analysisPrompt';
import { DEFAULT_INVESTOR_TYPE, type InvestorType } from '@/config/investorTypes';
import { enforceRateLimit, POLICIES } from '@/lib/rateLimiter';
import { checkCircuit, CIRCUIT_POLICIES, circuitOpenResponse } from '@/lib/circuitBreaker';
import { callAiJson, AiProviderError, getProviderStatus } from '@/lib/aiProvider';

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

// ─── 캐시 (세션 단위) ────────────────────────────────────────────────────────
async function getCachedPicks(userKey: string, date: string, session: string) {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('ai_chok_cache')
      .select('picks, use_count')
      .eq('user_key', userKey)
      .eq('date', `${date}_${session}`)
      .maybeSingle();
    return data as { picks: unknown; use_count: number } | null;
  } catch { return null; }
}

async function upsertCache(userKey: string, date: string, session: string, picks: unknown, useCount: number) {
  if (!supabase) return;
  try {
    await supabase.from('ai_chok_cache').upsert(
      { user_key: userKey, date: `${date}_${session}`, picks, use_count: useCount },
      { onConflict: 'user_key,date' }
    );
  } catch { /* silent */ }
}

// ─── handler ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const provider = getProviderStatus();
  if (!provider.geminiKeys && !provider.claudeAvailable) {
    return NextResponse.json({ error: 'AI 서비스가 준비 중이에요.' }, { status: 503 });
  }

  // Rate limit gate — 시간당 로그인 15회 / 비로그인 3회
  const gate = await enforceRateLimit(req, '/api/ai-chok', POLICIES.aiAnalysis);
  if (!gate.ok) return gate.response;

  // Circuit breaker — Gemini 장애 감지 시 503 + Retry-After
  const circuit = await checkCircuit('/api/ai-chok', CIRCUIT_POLICIES.aiStrict);
  if (circuit.open) {
    console.warn('[CIRCUIT OPEN] /api/ai-chok:', circuit.reason);
    await gate.finalize(503, 'circuit_open');
    return circuitOpenResponse(circuit, '/api/ai-chok');
  }

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
  };
  const { portfolioSymbols = [], forceRefresh = false, macroContext, currentEvent, sectorConcentration, investorType = DEFAULT_INVESTOR_TYPE } = body;

  // 캐시 키에 investorType 포함 (같은 유저라도 유형 바뀌면 다른 캐시)
  const userKeyWithType = `${userKey}:${investorType}`;
  const cached = await getCachedPicks(userKeyWithType, date, session);

  // 캐시 히트
  if (!forceRefresh && cached?.picks) {
    await gate.finalize(200);
    return NextResponse.json({
      picks: (cached.picks as { picks: unknown }).picks ?? cached.picks,
      context: (cached.picks as { context: string }).context ?? '',
      cached: true,
      sessionLabel: sessionLabel(session),
      remaining: Math.max(0, limit - (cached.use_count || 1)),
    });
  }

  // 레이트 리밋
  const currentCount = cached?.use_count || 0;
  if (currentCount >= limit) {
    const nextSession = session === 'day' ? '오후 10시 30분(미장 개장)' : '오전 9시';
    const msg = isLoggedIn
      ? `이번 세션 AI 촉 횟수를 모두 사용했어요 (${limit}회). ${nextSession} 이후 새 촉이 준비돼요!`
      : `비로그인 사용자는 세션당 ${limit}회까지 이용할 수 있어요. 로그인하면 ${SESSION_LIMIT}회까지 가능해요!`;
    await gate.finalize(429, 'session_limit');
    return NextResponse.json({ error: msg, limitReached: true, loginForMore: !isLoggedIn }, { status: 429 });
  }

  // AI 호출 (Gemini → Claude Haiku fallback)
  const excluded = new Set(portfolioSymbols.map(s => s.toUpperCase()));
  const allowed = CHOK_UNIVERSE.filter(s => !excluded.has(s.symbol));
  const allowedSymbols = allowed.map(s => `${s.symbol}(${s.krName}/${s.sector})`).join(', ');
  const excludeSymbols = portfolioSymbols.length ? portfolioSymbols.join(', ') : '없음';

  const prompt = CHOK_SYSTEM_PROMPT
    .replace('{USER_TYPE_CONTEXT}', buildUserTypeContext(investorType))
    .replace('{MACRO_CONTEXT}', macroContext || '데이터 없음')
    .replace('{CURRENT_EVENT}', currentEvent || '없음')
    .replace('{SECTOR_CONCENTRATION}', sectorConcentration || '데이터 없음')
    .replace('{ALLOWED_SYMBOLS}', allowedSymbols)
    .replace('{EXCLUDE_SYMBOLS}', excludeSymbols)
    + `\n\n위 기준과 시장 컨텍스트를 종합하여, 서로 다른 섹터 3개에 촉을 잡아주세요.`;

  try {
    const aiRes = await callAiJson({ prompt, temperature: 0.8, maxTokens: 2048 });
    const parsed = JSON.parse(aiRes.text) as { picks: Array<{ symbol: string }>; context: string };

    const validPicks = (parsed.picks || [])
      .filter(p => CHOK_UNIVERSE.some(u => u.symbol === p.symbol) && !excluded.has(p.symbol))
      .slice(0, 3);

    const result = { picks: validPicks, context: parsed.context || '' };
    const newCount = currentCount + 1;

    await Promise.all([
      upsertCache(userKeyWithType, date, session, result, newCount),
      // ai_usage 기록 (어드민 per-user 추적용)
      Promise.resolve(supabase?.from('ai_usage').insert({
        ip: ip,
        user_id: userId || null,
        date: date,
        symbol: null,
        mentor_id: 'ai-chok',
      })).catch(() => {}),
    ]);

    await gate.finalize(200);
    return NextResponse.json({
      ...result,
      cached: false,
      sessionLabel: sessionLabel(session),
      remaining: Math.max(0, limit - newCount),
      provider: aiRes.provider,
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
    // JSON.parse 실패 등
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[SOLB CHOK] parse/unknown error:', msg.slice(0, 200));
    await gate.finalize(500, 'parse_failed');
    return NextResponse.json({ error: 'AI 응답 처리 중 오류가 발생했어요.' }, { status: 500 });
  }
}
