import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { MENTOR_MAP } from '@/config/mentors';
import { SYSTEM_LAYER1, getMentorLayer2Rules } from '@/config/analysisPrompt';

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
].filter(Boolean) as string[];
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const DAILY_LIMIT_GUEST = parseInt(process.env.AI_DAILY_LIMIT_GUEST || '3', 10);
const DAILY_LIMIT_USER = parseInt(process.env.AI_DAILY_LIMIT_USER || '10', 10);
const DAILY_LIMIT_TOTAL = parseInt(process.env.AI_DAILY_LIMIT_TOTAL || '250', 10);

// Supabase server client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// 한국시간(KST) 기준 오늘 날짜
function getTodayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

async function getUsage(ip: string, userId?: string): Promise<{ userCount: number; totalCount: number }> {
  if (!supabase) return { userCount: 0, totalCount: 0 };
  const today = getTodayKST();
  try {
    const { count: totalCount } = await supabase
      .from('ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('date', today);

    // 로그인 사용자는 user_id로, 비로그인은 IP로 추적
    let userCount = 0;
    if (userId) {
      const { count } = await supabase
        .from('ai_usage')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)
        .eq('user_id', userId);
      userCount = count || 0;
    } else {
      const { count } = await supabase
        .from('ai_usage')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)
        .eq('ip', ip);
      userCount = count || 0;
    }

    return { userCount: userCount || 0, totalCount: totalCount || 0 };
  } catch { return { userCount: 0, totalCount: 0 }; }
}

async function recordUsage(ip: string, symbol: string, mentorId?: string, userId?: string) {
  if (!supabase) return;
  try {
    await supabase.from('ai_usage').insert({
      ip,
      user_id: userId || null,
      date: getTodayKST(),
      symbol: symbol || null,
      mentor_id: mentorId || null,
    });
  } catch { /* silent */ }
}

async function recordGeminiKeyUsage(keyIndex: number) {
  if (!supabase) return;
  try {
    await supabase.from('gemini_key_usage').insert({
      key_index: keyIndex,
      date: getTodayKST(),
    });
  } catch { /* silent */ }
}

async function sendSlackAlert(totalCount: number) {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    const msg = totalCount >= DAILY_LIMIT_TOTAL
      ? `🚨 *주비 AI 일일 한도 도달!*\n오늘 사용량: ${totalCount}/${DAILY_LIMIT_TOTAL}회\n유료 전환을 검토하세요.`
      : `⚠️ *주비 AI 사용량 경고*\n오늘 사용량: ${totalCount}/${DAILY_LIMIT_TOTAL}회 (${Math.round(totalCount / DAILY_LIMIT_TOTAL * 100)}%)`;

    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: msg }),
    });
  } catch { /* silent */ }
}

export async function POST(req: NextRequest) {
  if (!GEMINI_KEYS.length) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const body = await req.json();

  // Verify auth server-side (don't trust client userId)
  let userId: string | undefined;
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id;
    } catch { /* not logged in */ }
  }
  const isLoggedIn = !!userId;
  const perUserLimit = isLoggedIn ? DAILY_LIMIT_USER : DAILY_LIMIT_GUEST;

  const { userCount, totalCount } = await getUsage(ip, userId);

  if (totalCount >= DAILY_LIMIT_TOTAL) {
    return NextResponse.json({
      error: '오늘 AI 분석 서비스 이용량이 초과되었어요. 내일 다시 이용해주세요.',
      limitReached: true,
    }, { status: 429 });
  }

  if (userCount >= perUserLimit) {
    const msg = isLoggedIn
      ? `오늘 AI 분석 횟수를 모두 사용했어요 (${perUserLimit}회/일). 내일 다시 이용해주세요.`
      : `비로그인 사용자는 하루 ${perUserLimit}회까지 이용할 수 있어요. 로그인하면 ${DAILY_LIMIT_USER}회까지 사용 가능해요!`;
    return NextResponse.json({
      error: msg,
      limitReached: true,
      remaining: 0,
      loginForMore: !isLoggedIn,
    }, { status: 429 });
  }

  try {
    const { symbol, koreanName, price, change, changePercent, avgCost, shares, targetReturn,
            rsi, trend, cross, pattern, bollingerStatus, macdStatus, volRatio,
            recentNews, mentorId,
            per, eps, week52High, week52Low, sector } = body;

    // Mentor mode
    const mentor = mentorId ? MENTOR_MAP[mentorId] : null;

    // Layer 1 (공통) + Layer 2 (멘토/일반) 조합
    const baseRules = mentor
      ? `${SYSTEM_LAYER1}

${mentor.systemPrompt}

${getMentorLayer2Rules(mentor.nameKr, mentor.id)}`
      : `${SYSTEM_LAYER1}

당신은 한국인 주식 초보자를 위한 투자 분석 비서 "주비 AI"입니다.
친절하고 쉽게 설명하되, 정확한 정보만 제공하세요.
전문 용어는 반드시 괄호 안에 쉬운 설명을 추가하세요.`;

    const responseFormat = mentor
      ? `## 응답 형식 (반드시 JSON으로)
{
  "currentStatus": "${mentor.nameKr}의 관점에서 현재 상태를 2~3문장으로 설명 (이 투자자의 말투로)",
  "mentorScore": 1~5 사이 정수 (이 투자자의 기준으로 이 종목/포트폴리오가 얼마나 좋은지),
  "mentorVerdict": "${mentor.nameKr}의 관점에서 이 종목을 어떻게 볼지 한 줄 요약",
  "keyAdvice": [
    "${mentor.nameKr}의 철학에 기반한 구체적 조언 1",
    "${mentor.nameKr}의 철학에 기반한 구체적 조언 2",
    "${mentor.nameKr}의 철학에 기반한 구체적 조언 3"
  ],
  "quote": "이 멘토 철학에 맞는 투자 격언 1개 (출처 없이)",
  "conclusion": {
    "label": "긍정적/관망/주의 중 하나",
    "signal": "positive/neutral/negative",
    "desc": "${mentor.nameKr}의 관점에서 종합 판단 2~3문장"
  }
}`
      : `## 응답 형식 (반드시 JSON으로)
{
  "currentStatus": "현재 상태를 2~3문장으로 설명",
  "indicators": [
    { "name": "이동평균", "value": "20일선 위/아래 등", "signal": "positive/negative/neutral" },
    { "name": "RSI", "value": "수치와 해석", "signal": "positive/negative/neutral" },
    { "name": "볼린저밴드", "value": "위치와 해석", "signal": "positive/negative/neutral" },
    { "name": "MACD", "value": "상태와 해석", "signal": "positive/negative/neutral" },
    { "name": "거래량", "value": "수준과 해석", "signal": "positive/negative/neutral" }
  ],
  "historicalNote": "과거 유사 상황에서의 통계적 경향을 1~2문장으로",
  "newsContext": "최근 뉴스가 이 종목에 미칠 수 있는 영향을 1~2문장으로. 뉴스가 없으면 '최근 24시간 내 관련 뉴스가 없어요'라고만 말하세요.",
  "conclusion": {
    "label": "긍정적/관망/주의 중 하나",
    "signal": "positive/neutral/negative",
    "desc": "종합 판단을 2~3문장으로, 초보자가 이해할 수 있게"
  }
}`;

    const prompt = `${baseRules}

## 분석 대상
종목: ${symbol} (${koreanName || symbol})
현재가: $${price}
오늘 등락: ${changePercent > 0 ? '+' : ''}${changePercent?.toFixed(2)}% ($${change?.toFixed(2)})
${avgCost ? `평균 매수가: $${avgCost} (${shares}주 보유)` : '미보유'}
${targetReturn ? `목표 수익률: ${targetReturn}%` : ''}

## 기술적 지표
- RSI: ${rsi || '데이터 없음'}${rsi ? (rsi < 30 ? ' (과매도 구간)' : rsi > 70 ? ' (과매수 구간)' : ' (적정)') : ''}
- 추세: ${trend || '데이터 없음'}
- 이동평균 교차: ${cross || '없음'}
- 차트 패턴: ${pattern || '없음'}
- 볼린저 밴드: ${bollingerStatus || '데이터 없음'}
- MACD: ${macdStatus || '데이터 없음'}
- 거래량: 평균 대비 ${volRatio ? (volRatio * 100).toFixed(0) + '%' : '데이터 없음'}

## 기본 지표 (Fundamentals)
${per != null ? `- PER(주가수익비율): ${per.toFixed(1)}` : '- PER: 데이터 없음'}
${eps != null ? `- EPS(주당순이익): $${eps.toFixed(2)}` : '- EPS: 데이터 없음'}
${week52High != null && week52Low != null ? `- 52주 고가/저가: $${week52High} / $${week52Low}` : ''}
${sector ? `- 섹터: ${sector}` : ''}

## 최근 뉴스
${recentNews || '관련 뉴스 없음'}

${responseFormat}`;

    // 키 로테이션: 실패 시 다른 키로 재시도
    const shuffledKeys = [...GEMINI_KEYS].sort(() => Math.random() - 0.5);
    let lastError: unknown;
    for (const apiKey of shuffledKeys) {
      const keyIndex = GEMINI_KEYS.indexOf(apiKey);
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json', temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } },
        });

        const text = response.text || '';

        // 성공: 사용량 기록 (병렬)
        await Promise.all([
          recordUsage(ip, symbol, mentorId, userId),
          recordGeminiKeyUsage(keyIndex),
        ]);
        const newTotal = totalCount + 1;
        const remaining = perUserLimit - userCount - 1;

        if (newTotal === Math.floor(DAILY_LIMIT_TOTAL * 0.8) || newTotal >= DAILY_LIMIT_TOTAL) {
          sendSlackAlert(newTotal);
        }

        try {
          const parsed = JSON.parse(text);
          return NextResponse.json({ success: true, report: parsed, remaining });
        } catch {
          return NextResponse.json({ success: true, report: { currentStatus: text, indicators: [], historicalNote: '', newsContext: '', conclusion: { label: '분석 완료', signal: 'neutral', desc: text } }, remaining });
        }
      } catch (e) {
        lastError = e;
        continue;
      }
    }

    // 모든 키 실패
    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    let parsedCode: unknown = null;
    let parsedMsg: unknown = null;
    let parsedStatus: unknown = null;
    try {
      const parsed = JSON.parse(errorMessage) as { error?: { code?: unknown; message?: unknown; status?: unknown } };
      parsedCode = parsed?.error?.code;
      parsedMsg = parsed?.error?.message;
      parsedStatus = parsed?.error?.status;
    } catch { /* not JSON */ }
    console.error('[주비 AI] all keys failed:', parsedCode, '|', parsedStatus, '|', parsedMsg || errorMessage);
    return NextResponse.json({ error: 'AI 분석에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  } catch (e: unknown) {
    console.error('[주비 AI] unexpected error:', e);
    return NextResponse.json({ error: 'AI 분석에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
