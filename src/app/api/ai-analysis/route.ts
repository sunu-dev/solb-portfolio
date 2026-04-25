import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { MENTOR_MAP } from '@/config/mentors';
import { SYSTEM_LAYER1, getMentorLayer2Rules, buildPersonalizationLayer, buildUserTypeContext } from '@/config/analysisPrompt';
import { DEFAULT_INVESTOR_TYPE, type InvestorType } from '@/config/investorTypes';
import { enforceRateLimit, POLICIES } from '@/lib/rateLimiter';
import { checkCircuit, CIRCUIT_POLICIES, circuitOpenResponse } from '@/lib/circuitBreaker';
import { callAiJson, AiProviderError } from '@/lib/aiProvider';

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

  // Sliding-window rate limit (시간당 버스트 차단) — 기존 일일 limit과 별개
  const gate = await enforceRateLimit(req, '/api/ai-analysis', POLICIES.aiAnalysis);
  if (!gate.ok) return gate.response;

  // Circuit breaker — Gemini 장애 감지 시 503
  const circuit = await checkCircuit('/api/ai-analysis', CIRCUIT_POLICIES.aiStrict);
  if (circuit.open) {
    console.warn('[CIRCUIT OPEN] /api/ai-analysis:', circuit.reason);
    await gate.finalize(503, 'circuit_open');
    return circuitOpenResponse(circuit, '/api/ai-analysis');
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
    await gate.finalize(429, 'daily_total_limit');
    return NextResponse.json({
      error: '오늘 AI 분석 서비스 이용량이 초과되었어요. 내일 다시 이용해주세요.',
      limitReached: true,
    }, { status: 429 });
  }

  if (userCount >= perUserLimit) {
    const msg = isLoggedIn
      ? `오늘 AI 분석 횟수를 모두 사용했어요 (${perUserLimit}회/일). 내일 다시 이용해주세요.`
      : `비로그인 사용자는 하루 ${perUserLimit}회까지 이용할 수 있어요. 로그인하면 ${DAILY_LIMIT_USER}회까지 사용 가능해요!`;
    await gate.finalize(429, 'daily_user_limit');
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
            per, eps, week52High, week52Low, sector,
            stopLoss, stopLossPct, weight, buyBelow, purchaseRate, currentUsdKrw, category,
            investorType = DEFAULT_INVESTOR_TYPE,
            userNotes = [] as string[] } = body as typeof body & { investorType?: InvestorType; userNotes?: string[] };

    // 개인화 계산
    const currentPLPct = (avgCost && price && avgCost > 0)
      ? ((price - avgCost) / avgCost * 100)
      : null;
    const targetProgress = (targetReturn && currentPLPct != null)
      ? (currentPLPct / targetReturn * 100)
      : null;
    const stopLossDistance = (stopLoss && price && stopLoss > 0)
      ? ((price - stopLoss) / price * 100)
      : null;

    const personalizationBlock = buildPersonalizationLayer({
      category,
      currentPLPct,
      targetReturn,
      targetProgress,
      stopLoss,
      stopLossPct,
      stopLossDistance,
      weight,
      buyBelow,
      purchaseRate,
      currentUsdKrw,
    });

    // Mentor mode
    const mentor = mentorId ? MENTOR_MAP[mentorId] : null;

    // 유저 투자 유형 블록 (LAYER 0)
    const userTypeContext = buildUserTypeContext(investorType);
    const layer1WithType = SYSTEM_LAYER1.replace('{USER_TYPE_CONTEXT}', userTypeContext);

    // Layer 1 (공통) + Layer 2 (멘토/일반) 조합
    const baseRules = mentor
      ? `${layer1WithType}

${mentor.systemPrompt}

${getMentorLayer2Rules(mentor.nameKr, mentor.id)}`
      : `${layer1WithType}

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
  "newsAnalysis": [뉴스가 있을 경우: {"headline": "기사 제목 그대로", "impact": "${mentor.nameKr} 관점에서 이 뉴스가 종목에 미칠 영향 1문장"} 형태로 최대 3개. 뉴스가 없으면 빈 배열 []],
  "newsContext": "뉴스 없을 때만: '최근 24시간 내 관련 뉴스가 없어요'",
  "scenarios": {
    "bull": "상승 시나리오: 뉴스/지표가 긍정적으로 전개된다면 어떤 상황이 될 수 있는지 1~2문장. ${mentor.nameKr}의 말투로.",
    "bear": "하락 시나리오: 리스크가 현실화된다면 어떤 상황이 될 수 있는지 1~2문장. ${mentor.nameKr}의 말투로."
  },
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
  "newsAnalysis": [뉴스가 있을 경우: {"headline": "기사 제목 그대로", "impact": "이 뉴스가 종목에 미칠 영향 1문장. 초보자 눈높이로"} 형태로 최대 3개. 뉴스가 없으면 빈 배열 []],
  "newsContext": "뉴스 없을 때만: '최근 24시간 내 관련 뉴스가 없어요'",
  "scenarios": {
    "bull": "상승 시나리오: 뉴스/지표가 긍정적으로 전개된다면 어떤 상황이 될 수 있는지 1~2문장. 초보자도 이해할 수 있게.",
    "bear": "하락 시나리오: 리스크가 현실화된다면 어떤 상황이 될 수 있는지 1~2문장. 초보자도 이해할 수 있게."
  },
  "conclusion": {
    "label": "긍정적/관망/주의 중 하나",
    "signal": "positive/neutral/negative",
    "desc": "종합 판단을 2~3문장으로, 초보자가 이해할 수 있게"
  }
}`;

    const prompt = `${baseRules}

${personalizationBlock}

## 분석 대상
종목: ${symbol} (${koreanName || symbol})
현재가: $${price}
오늘 등락: ${changePercent > 0 ? '+' : ''}${changePercent?.toFixed(2)}% ($${change?.toFixed(2)})
${avgCost ? `평균 매수가: $${avgCost} (${shares}주 보유, 현재 수익률 ${currentPLPct != null ? (currentPLPct >= 0 ? '+' : '') + currentPLPct.toFixed(1) + '%' : '계산 불가'})` : '미보유'}
${targetReturn ? `목표 수익률: ${targetReturn}% (달성률: ${targetProgress != null ? targetProgress.toFixed(0) + '%' : '-'})` : ''}
${stopLoss ? `손절가: $${stopLoss}${stopLossDistance != null ? ` (현재가 대비 ${stopLossDistance.toFixed(1)}% 여유)` : ''}` : ''}
${weight ? `포트폴리오 비중: ${weight}%` : ''}

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

${(userNotes as string[]).length > 0 ? `## 사용자가 남긴 결정 메모 (중요)
이 사용자가 이 종목에 대해 매수/매도/조정 시 직접 작성한 한 줄 메모입니다. **반드시 분석에 반영하여**, 사용자의 원래 매수 논리가 여전히 유효한지·바뀌었는지 짚어주세요.
${(userNotes as string[]).map((n: string, i: number) => `${i + 1}. "${n}"`).join('\n')}` : ''}

${responseFormat}`;

    // 키 × 모델 로테이션: 2.5-flash 실패 시 2.5-flash-lite로 fallback
    const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    const shuffledKeys = [...GEMINI_KEYS].sort(() => Math.random() - 0.5);
    let lastError: unknown;
    for (const model of MODELS) {
      for (const apiKey of shuffledKeys) {
      const keyIndex = GEMINI_KEYS.indexOf(apiKey);
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model,
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
          await gate.finalize(200);
          return NextResponse.json({ success: true, report: parsed, remaining });
        } catch {
          await gate.finalize(200, 'parse_fallback');
          return NextResponse.json({ success: true, report: { currentStatus: text, indicators: [], historicalNote: '', newsContext: '', conclusion: { label: '분석 완료', signal: 'neutral', desc: text } }, remaining });
        }
      } catch (e) {
        lastError = e;
        continue;
      }
      } // end keys loop
    } // end models loop

    // 모든 키/모델 실패 — Claude Haiku fallback 시도 (일일 상한 내)
    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    console.warn('[주비 AI] all Gemini failed, trying Claude fallback:', errorMessage.slice(0, 120));

    try {
      const aiRes = await callAiJson({ prompt, temperature: 0.3, maxTokens: 4096 });
      // aiProvider 내부가 Gemini 먼저 재시도 후 Claude — 방금 전 실패했으니 Claude로 갈 확률 높음
      try {
        const parsed = JSON.parse(aiRes.text);
        await Promise.all([
          recordUsage(ip, symbol, mentorId, userId),
        ]);
        const newTotal = totalCount + 1;
        const remaining = perUserLimit - userCount - 1;
        if (newTotal === Math.floor(DAILY_LIMIT_TOTAL * 0.8) || newTotal >= DAILY_LIMIT_TOTAL) {
          sendSlackAlert(newTotal);
        }
        await gate.finalize(200, `fallback_${aiRes.provider}`);
        return NextResponse.json({ success: true, report: parsed, remaining, provider: aiRes.provider });
      } catch {
        // fallback 응답도 파싱 실패
        await gate.finalize(200, 'fallback_parse_fail');
        return NextResponse.json({
          success: true,
          report: { currentStatus: aiRes.text, indicators: [], historicalNote: '', newsContext: '', conclusion: { label: '분석 완료', signal: 'neutral', desc: aiRes.text } },
          remaining: perUserLimit - userCount - 1,
          provider: aiRes.provider,
        });
      }
    } catch (fallbackErr) {
      if (fallbackErr instanceof AiProviderError) {
        console.error('[주비 AI] all providers failed:', fallbackErr.causes);
      }
    }

    // Gemini + Claude 모두 실패 — 최종 에러 분류
    let parsedCode: unknown = null;
    let parsedStatus: unknown = null;
    try {
      const parsed = JSON.parse(errorMessage) as { error?: { code?: unknown; message?: unknown; status?: unknown } };
      parsedCode = parsed?.error?.code;
      parsedStatus = parsed?.error?.status;
    } catch { /* not JSON */ }
    console.error('[주비 AI] all keys failed:', parsedCode, '|', parsedStatus, '|', errorMessage);

    const isQuotaExhausted = parsedCode === 429 || String(parsedStatus) === 'RESOURCE_EXHAUSTED';
    const isServerBusy = parsedCode === 503 || String(parsedStatus) === 'UNAVAILABLE';

    const userMsg = isQuotaExhausted
      ? '오늘 AI 분석 한도를 모두 소진했어요. 내일 다시 이용해주세요.'
      : isServerBusy
        ? 'AI 서버가 혼잡해요. 잠시 후 다시 시도해주세요.'
        : 'AI 분석에 실패했어요. 잠시 후 다시 시도해주세요.';

    const finalCode = isQuotaExhausted ? 'gemini_quota' : isServerBusy ? 'gemini_busy' : 'gemini_failed';
    await gate.finalize(500, finalCode);
    return NextResponse.json({ error: userMsg }, { status: 500 });
  } catch (e: unknown) {
    console.error('[주비 AI] unexpected error:', e);
    await gate.finalize(500, 'unexpected');
    return NextResponse.json({ error: 'AI 분석에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
