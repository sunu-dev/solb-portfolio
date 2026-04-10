import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { CHOK_UNIVERSE } from '@/config/chokUniverse';
import { CHOK_SYSTEM_PROMPT } from '@/config/analysisPrompt';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const DAILY_LIMIT_GUEST = 1;
const DAILY_LIMIT_USER = 3;

function getTodayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

async function getCachedPicks(userKey: string, today: string) {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('ai_chok_cache')
      .select('picks, use_count')
      .eq('user_key', userKey)
      .eq('date', today)
      .maybeSingle();
    return data as { picks: unknown; use_count: number } | null;
  } catch { return null; }
}

async function upsertCache(userKey: string, today: string, picks: unknown, useCount: number) {
  if (!supabase) return;
  try {
    await supabase.from('ai_chok_cache').upsert(
      { user_key: userKey, date: today, picks, use_count: useCount },
      { onConflict: 'user_key,date' }
    );
  } catch { /* silent — table may not exist yet */ }
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'AI 서비스가 준비 중이에요.' }, { status: 503 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Verify auth server-side
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
  const today = getTodayKST();
  const limit = isLoggedIn ? DAILY_LIMIT_USER : DAILY_LIMIT_GUEST;

  const body = await req.json() as { portfolioSymbols?: string[]; forceRefresh?: boolean };
  const { portfolioSymbols = [], forceRefresh = false } = body;

  // Try cache first (unless force refresh)
  const cached = await getCachedPicks(userKey, today);
  if (!forceRefresh && cached?.picks) {
    return NextResponse.json({
      picks: (cached.picks as { picks: unknown }).picks ?? cached.picks,
      context: (cached.picks as { context: string }).context ?? '',
      cached: true,
      remaining: Math.max(0, limit - (cached.use_count || 1)),
    });
  }

  // Rate limit check
  const currentCount = cached?.use_count || 0;
  if (currentCount >= limit) {
    const msg = isLoggedIn
      ? `오늘 AI 촉 횟수를 모두 사용했어요 (${limit}회/일). 내일 다시 이용해주세요.`
      : `비로그인 사용자는 하루 ${limit}회까지 이용할 수 있어요. 로그인하면 ${DAILY_LIMIT_USER}회까지 가능해요!`;
    return NextResponse.json({
      error: msg,
      limitReached: true,
      loginForMore: !isLoggedIn,
    }, { status: 429 });
  }

  // Build allowed list
  const excluded = new Set(portfolioSymbols.map(s => s.toUpperCase()));
  const allowed = CHOK_UNIVERSE.filter(s => !excluded.has(s.symbol));
  const allowedSymbols = allowed.map(s => `${s.symbol}(${s.krName}/${s.sector})`).join(', ');
  const excludeSymbols = portfolioSymbols.length ? portfolioSymbols.join(', ') : '없음';

  const prompt = CHOK_SYSTEM_PROMPT
    .replace('{ALLOWED_SYMBOLS}', allowedSymbols)
    .replace('{EXCLUDE_SYMBOLS}', excludeSymbols)
    + `\n\n## 사용자 포트폴리오\n현재 보유/관심 종목: ${excludeSymbols}\n\n위 종목과 겹치지 않게, 서로 다른 섹터 3개에 촉을 잡아주세요.`;

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.8 },
    });

    const text = response.text || '';
    const parsed = JSON.parse(text) as { picks: Array<{ symbol: string }>; context: string };

    // Validate: only universe symbols, not in portfolio
    const validPicks = (parsed.picks || [])
      .filter(p => CHOK_UNIVERSE.some(u => u.symbol === p.symbol) && !excluded.has(p.symbol))
      .slice(0, 3);

    const result = { picks: validPicks, context: parsed.context || '' };
    const newCount = currentCount + 1;

    await upsertCache(userKey, today, result, newCount);

    return NextResponse.json({
      ...result,
      cached: false,
      remaining: Math.max(0, limit - newCount),
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    let parsedMsg: unknown = null;
    try {
      const p = JSON.parse(errorMessage) as { error?: { message?: unknown } };
      parsedMsg = p?.error?.message;
    } catch { /* not JSON */ }
    console.error('[SOLB CHOK] error:', parsedMsg || errorMessage);
    return NextResponse.json({ error: 'AI 촉 서비스에 잠시 문제가 생겼어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
