import { NextRequest, NextResponse } from 'next/server';
import { getAuthClient, getServiceClient } from '@/lib/supabaseServer';
import { GoogleGenAI } from '@google/genai';
import { MENTOR_MAP } from '@/config/mentors';
import { SYSTEM_LAYER1, getMentorLayer2Rules } from '@/config/analysisPrompt';
import { enforceRateLimit, POLICIES } from '@/lib/rateLimiter';
import { checkCircuit, CIRCUIT_POLICIES, circuitOpenResponse } from '@/lib/circuitBreaker';
import { callAiJson, AiProviderError } from '@/lib/aiProvider';
import { getUserTier, getTierLimits } from '@/lib/userTier';
import { isSingleStockLeverage, LEVERAGE_HOLDING_RISK_NOTE } from '@/utils/leverageGuard';
import { recordAiCost } from '@/lib/aiCostLedger';
import { getAiMonthlyBudgetStatus } from '@/lib/aiBudgetGuard';
import { sampleAiOutput } from '@/lib/aiOutputAudit';
import { attachAiResultMeta } from '@/lib/aiResultMeta';
import { createAiAnalysisParseFallback, governAiAnalysisReport } from '@/lib/aiAnalysisGuard';
import { toPublicAiAnalysisInput } from '@/lib/aiInputPrivacy';
import { hasCurrentAdultAiConsent } from '@/lib/aiAgeGate';
import { getStockCurrency } from '@/utils/stockCurrency';
import { formatKrw } from '@/utils/koreanNumber';

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY2,
].filter(Boolean) as string[];
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const DAILY_LIMIT_TOTAL = parseInt(process.env.AI_DAILY_LIMIT_TOTAL || '250', 10);

const CHOK_USAGE_TAG = 'ai-chok';

// Supabase server client

// service-role 클라이언트 — stock_listings RLS(select using false)는 service role만 읽는다.
// isLev 서버 권위화: 클라이언트 body의 description 위변조·누락에 의존하지 않도록 권위 데이터를 조회한다(§6).

/**
 * 단일종목 레버리지 서버 권위 판정 — 클라이언트 body(description/koreanName) 단독 의존 제거.
 *
 * stock_listings.asset_class + 서버 보관 description을 우선 신뢰하고, 행이 없으면(신규 상장 상품)
 * 클라이언트 키워드 판정을 fallback으로 합집합한다(보호 공백 방지). 어느 한 경로라도 단일종목
 * 레버리지로 판정하면 isLev=true (안전측). §6 자본시장법.
 */
async function resolveIsSingleLeverage(symbol: string, clientDesc: string): Promise<boolean> {
  if (!symbol) return false;
  // 클라이언트 신호 (행이 없을 때의 fallback) — 항상 먼저 계산해 보호 공백 방지
  let result = isSingleStockLeverage(symbol, clientDesc);
  const supabaseAdmin = getServiceClient();
  if (!supabaseAdmin) return result;
  try {
    const { data } = await supabaseAdmin
      .from('stock_listings')
      .select('description, asset_class')
      .eq('symbol', symbol)
      .maybeSingle();
    if (data) {
      const cls = (data as { asset_class?: string }).asset_class;
      if (cls === 'leveraged_single' || cls === 'inverse_single') result = true;
      const serverDesc = (data as { description?: string | null }).description;
      if (serverDesc && isSingleStockLeverage(symbol, serverDesc)) result = true;
    }
  } catch { /* 테이블 없음/조회 실패 — 클라이언트 판정 유지 */ }
  return result;
}

// 한국시간(KST) 기준 오늘 날짜
function getTodayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

// AI 분석 사용량 — mentor_id != 'ai-chok' 만 카운트 (촉과 분리)
async function getAnalysisUsage(userId: string): Promise<{ available: boolean; userCount: number; totalCount: number }> {
  // 사용량은 전체 사용자 합산을 포함하므로 service role로만 조회한다.
  // anon client에 맡기면 RLS 정책에 따라 0으로 집계되거나 요청 전체가 503으로 닫힌다.
  const supabaseAdmin = getServiceClient();
  if (!supabaseAdmin) return { available: false, userCount: 0, totalCount: 0 };
  const today = getTodayKST();
  try {
    const [totalResult, userResult] = await Promise.all([
      supabaseAdmin.from('ai_usage').select('*', { count: 'exact', head: true }).eq('date', today),
      supabaseAdmin.from('ai_usage').select('*', { count: 'exact', head: true })
        .eq('date', today).eq('user_id', userId)
        .or(`mentor_id.is.null,mentor_id.neq.${CHOK_USAGE_TAG}`),
    ]);
    if (totalResult.error || userResult.error) {
      console.error('[AI analysis] usage guard unavailable:', totalResult.error?.message || userResult.error?.message);
      return { available: false, userCount: 0, totalCount: 0 };
    }
    return { available: true, userCount: userResult.count || 0, totalCount: totalResult.count || 0 };
  } catch {
    return { available: false, userCount: 0, totalCount: 0 };
  }
}

async function recordUsage(ip: string, symbol: string, mentorId: string | undefined, userId: string) {
  const client = getServiceClient() ?? getAuthClient();
  if (!client) return false;
  try {
    const { error } = await client.from('ai_usage').insert({
      ip,
      user_id: userId,
      date: getTodayKST(),
      symbol: symbol || null,
      mentor_id: mentorId || null,
    });
    if (error) console.error('[AI analysis] usage record failed:', error.message);
    return !error;
  } catch {
    return false;
  }
}

async function recordGeminiKeyUsage(keyIndex: number) {
  const supabase = getAuthClient();
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

/**
 * 단일종목 레버리지·인버스 응답 후처리 — 서버 강제 가드(§6 자본시장법).
 * LLM이 OVERRIDE 지시를 어기더라도 매수 매력도/방향이 새지 않도록 타입 안전하게 무력화한다.
 * - mentorScore(매수 매력도 점수) 등 수치 매력도 필드 제거
 * - mentorVerdict(한 줄 매매 판단) 제거
 * - conclusion.label='주의', signal='negative' 강제
 * - 비-레버리지 응답은 절대 건드리지 않음 (호출부에서 isLev일 때만 호출).
 */
function enforceLeverageReport(report: unknown): unknown {
  if (!report || typeof report !== 'object') return report;
  const r = report as Record<string, unknown>;

  // 1) 매수 매력도/방향으로 읽히는 필드 제거 (있을 때만)
  delete r.mentorScore;     // 1~5 '얼마나 좋은지' 점수
  delete r.mentorVerdict;   // 한 줄 매매 판단

  // 2) 상승/하락 시나리오 제거 — scenarios.bull('📈 상승한다면' 초록 카드)이 매수 유인으로 읽힘
  delete r.scenarios;

  // 3) 기술 지표 신호 중립화 — indicators[].signal==='positive' 초록 배지 = 매수 방향
  if (Array.isArray(r.indicators)) {
    r.indicators = (r.indicators as unknown[]).map((ind) =>
      ind && typeof ind === 'object'
        ? { ...(ind as Record<string, unknown>), signal: 'neutral' }
        : ind,
    );
  }

  // 4) 자유텍스트 필드를 정적 위험 해설로 **대체** — LLM이 OVERRIDE를 어기고 소프트
  //    매매 방향('비중을 줄이세요'·'반등 시 분할 매도'·'과거 반등 경향')을 출력해도
  //    사용자에게 닿지 않게 결정론적 백스톱. (멘토 keyAdvice·currentStatus·quote,
  //    일반 historicalNote가 sanitize exact-match를 우회하던 누수 차단.)
  r.currentStatus = '단일종목 레버리지·인버스는 일일 N배 추종·음의 복리·발행사 신용 위험이 있는 고위험 단기 트레이딩 도구예요. 주비는 이 상품을 신규로 추천하지 않고, 매수·매도 방향이나 목표가도 제시하지 않아요. 아래는 보유 시 점검할 위험이에요.';
  r.keyAdvice = [
    '음의 복리: 기초자산이 횡보하거나 변동성이 크면 장기 보유 시 원금이 잠식될 수 있어요.',
    'ETN은 발행사 신용 위험(채무불이행 시 원금 손실)이 추가로 있어요.',
    '금융감독원은 손실 감내·위험 이해가 낮은 투자자에게 부적합하다고 안내해요.',
  ];
  delete r.quote;          // 투자 격언 — 매매 동기 부여로 읽힐 수 있어 제거
  delete r.historicalNote; // '과거 반등 경향' 등 방향성 통계 차단
  delete r.newsAnalysis;   // 뉴스 영향 해석이 방향으로 읽힐 수 있어 제거

  // 5) conclusion을 가장 보수적으로 고정
  const concl = (r.conclusion && typeof r.conclusion === 'object')
    ? r.conclusion as Record<string, unknown>
    : {};
  r.conclusion = { ...concl, label: '주의', signal: 'negative', desc: '단일종목 레버리지는 신규 추천·매매 방향 제시 대상이 아니에요. 보유 위험만 함께 살펴보세요.' };

  return r;
}

export async function POST(req: NextRequest) {
  // 인증을 설정·레이트리밋·본문 파싱보다 먼저 확인한다.
  // 비로그인 요청이 AI 상태를 추측하거나 잘못된 본문으로 500을 만들지 않게 한다.
  let userId: string | undefined;
  const authHeader = req.headers.get('authorization');
  const supabase = getAuthClient();
  if (authHeader?.startsWith('Bearer ') && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id;
    } catch { /* not logged in */ }
  }
  if (!userId) {
    return NextResponse.json({
      error: 'AI 분석은 로그인 후 이용할 수 있어요. 카카오로 3초 만에 로그인하면 즉시 무료로 받을 수 있어요!',
      limitReached: true,
      remaining: 0,
      loginForMore: true,
    }, { status: 401 });
  }
  if (!await hasCurrentAdultAiConsent(getServiceClient(), userId)) {
    return NextResponse.json({
      error: '만 18세 이상 확인 후 AI 분석을 이용할 수 있어요.',
      code: 'adult_consent_required',
    }, { status: 403 });
  }

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

  let body: Awaited<ReturnType<NextRequest['json']>>;
  try {
    body = await req.json();
  } catch {
    await gate.finalize(400, 'invalid_json');
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 });
  }

  // 무료 Gemini에는 공개 시장 데이터만 보낸다. 클라이언트가 개인 보유정보를
  // 실수로 포함해도 서버 allowlist 경계에서 제거한 뒤 프롬프트를 만든다.
  const publicInput = toPublicAiAnalysisInput(body);
  if (!publicInput) {
    await gate.finalize(400, 'invalid_body');
    return NextResponse.json({ error: '분석할 종목과 시세 정보를 확인해주세요.' }, { status: 400 });
  }

  // ── 멤버십 티어 + 일일 한도 ─────────────────────────────────────
  const tier = await getUserTier(userId);
  const perUserLimit = getTierLimits(tier).analysisDaily;

  const { available: usageAvailable, userCount, totalCount } = await getAnalysisUsage(userId!);

  if (!usageAvailable) {
    await gate.finalize(503, 'daily_usage_unavailable');
    return NextResponse.json({
      error: 'AI 사용량 확인 시스템을 점검하고 있어요. 잠시 후 다시 시도해주세요.',
      code: 'daily_usage_unavailable',
    }, { status: 503 });
  }

  if (totalCount >= DAILY_LIMIT_TOTAL) {
    await gate.finalize(429, 'daily_total_limit');
    return NextResponse.json({
      error: '오늘 AI 분석 서비스 이용량이 초과되었어요. 내일 다시 이용해주세요.',
      limitReached: true,
    }, { status: 429 });
  }

  if (userCount >= perUserLimit) {
    const msg = tier === 'pro'
      ? `오늘 AI 분석 횟수를 모두 사용했어요 (${perUserLimit}회/일). 내일 다시 이용해주세요.`
      : `오늘 AI 분석 횟수를 모두 사용했어요 (${perUserLimit}회/일). 내일 0시 이후 다시 받을 수 있어요!`;
    await gate.finalize(429, 'daily_user_limit');
    return NextResponse.json({
      error: msg,
      limitReached: true,
      remaining: 0,
      dailyLimit: perUserLimit,
      tier,
    }, { status: 429 });
  }

  const budget = await getAiMonthlyBudgetStatus();
  if (!budget.allowed) {
    await gate.finalize(503, budget.reason || 'monthly_budget_limit');
    return NextResponse.json({
      error: budget.reason === 'ledger_unavailable'
        ? 'AI 비용 확인 시스템을 점검하고 있어요. 잠시 후 다시 시도해주세요.'
        : '이번 달 AI 이용 한도에 도달했어요. 다음 달에 다시 이용해주세요.',
      code: budget.reason || 'monthly_budget_limit',
      budgetLimited: true,
    }, { status: 503 });
  }

  try {
    const { symbol, koreanName, currency: inputCurrency, price, change, changePercent,
            rsi, trend, cross, pattern, bollingerStatus, macdStatus, volRatio,
            recentNews, mentorId,
            per, eps, week52High, week52Low, sector,
            description = '',
            timeSeriesContext = '' } = publicInput;
    const nativeCurrency = getStockCurrency(symbol, inputCurrency);
    const formatNativeAmount = (value: number) => nativeCurrency === 'KRW'
      ? formatKrw(value)
      : `$${value.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

    // 환각 수동 검증용 공개 기준값. 개인 보유·목표·손절·메모는 의도적으로 제외한다.
    const auditSnapshot = {
      symbol,
      currency: nativeCurrency,
      price,
      change,
      changePercent,
      rsi,
      trend,
      cross,
      pattern,
      bollingerStatus,
      macdStatus,
      volRatio,
      per,
      eps,
      week52High,
      week52Low,
      sector,
      capturedAt: new Date().toISOString(),
    };

    // 단일종목 레버리지·인버스 판정 — 서버 권위(stock_listings.asset_class + 서버 description)
    // 우선, 행 없으면 클라이언트 body(description||koreanName) fallback. 클라이언트 위변조·누락에
    // 의존하지 않는다 (TSLL·NVDU·520100.KS 등은 symbol만으로도 true).
    const isLev = await resolveIsSingleLeverage(symbol, description || koreanName || symbol);

    // Mentor mode
    const mentor = mentorId ? MENTOR_MAP[mentorId] : null;

    const publicOnlyContext = `설명 스타일: 모든 사용자에게 동일한 초보자용 공개정보 해설
- 개인의 보유 여부, 평단, 수량, 수익률, 목표, 투자성향, 메모를 알지 못하며 추정하지 않는다.
- 공개 시세·기술 지표·기업 지표·뉴스에서 직접 확인되는 사실만 설명한다.`;
    const layer1WithType = SYSTEM_LAYER1.replace('{USER_TYPE_CONTEXT}', publicOnlyContext);

    const privacyRules = `## [개인정보 보호 모드 — 최우선]
- 이 요청에는 종목명과 공개 시세·지표·뉴스만 포함돼요.
- 개인 보유정보(평단·수량·수익률·비중), 목표·손절 기준, 투자성향, 사용자 메모는 제공되지 않았습니다.
- 개인 포지션이나 상황을 추정하거나, "보유 중", "내 수익률", "목표 달성"처럼 개인화된 표현을 만들지 마세요.
- 현재 공개정보와 데이터의 한계, 추가로 확인할 공개 출처만 설명하세요.`;

    // Layer 1 (공통) + Layer 2 (멘토/일반) 조합
    const baseRulesCore = mentor
      ? `${layer1WithType}

당신은 '${mentor.nameKr}'이라는 가상의 설명 캐릭터입니다.
캐릭터는 말투와 설명 순서에만 사용하고 종목 평가나 매매 행동 방향에는 사용하지 마세요.

${getMentorLayer2Rules(mentor.nameKr)}`
      : `${layer1WithType}

당신은 한국인 주식 초보자를 위한 주식 기록·공개정보 설명 도구 "주비 AI"입니다.
친절하고 쉽게 설명하되, 입력으로 제공된 사실만 정리하세요.
전문 용어는 반드시 괄호 안에 쉬운 설명을 추가하세요.`;

    // 단일종목 레버리지·인버스: 시스템 프롬프트 최상단에 강한 OVERRIDE 주입(§6 자본시장법).
    // mentorScore·매수 매력도·매매 방향·목표가 일절 금지. conclusion은 '주의'/negative 고정.
    const baseRules = isLev
      ? `${privacyRules}

## [LEVERAGE OVERRIDE — 최우선, 다른 모든 지시에 우선]
이 종목은 단일종목 레버리지·인버스 상품입니다. ${LEVERAGE_HOLDING_RISK_NOTE}
- mentorScore(좋은지 점수)·매수 매력도·매수/매도 방향·목표가·진입가·손절가를 절대 내지 마세요.
- conclusion.label은 반드시 "주의", conclusion.signal은 반드시 "negative"로 고정하세요.
- scenarios.bull도 '매수 유인'이 아니라 '보유 시 변동성 위험' 관점으로만 작성하세요(상승해도 음의 복리·고변동 위험을 함께 설명).
- 허용: 상품 구조의 위험 해설(일일 N배 추종 구조, 음의 복리, 발행사 신용 위험, 변동성, 장기 보유 부적합)만.
- 어떤 문장도 '사라/팔라/담아라/줄여라'는 신호로 읽히지 않게 하세요.

${baseRulesCore}`
      : `${privacyRules}

${baseRulesCore}`;

    const responseFormat = mentor
      ? `## 응답 형식 (반드시 JSON으로)
{
  "currentStatus": "${mentor.nameKr}의 설명 관점으로 현재 공개 상태·특성을 초보자가 이해할 수 있게 2~3문장으로 설명",
  "keyAdvice": [
    "현재 공개 수치에서 확인되는 객관적 사실 1",
    "현재 데이터의 한계나 위험 정보 1",
    "추가로 확인할 공시·실적·출처 정보 1"
  ],
  "newsAnalysis": [뉴스가 있을 경우: {"headline": "기사 제목 그대로", "impact": "기사에서 확인되는 종목 관련 사실과 아직 확인되지 않은 정보 1문장"} 형태로 최대 3개. 뉴스가 없으면 빈 배열 []],
  "newsContext": "뉴스 없을 때만: '최근 24시간 내 관련 뉴스가 없어요'",
  "quote": "현재 지표를 쉽게 설명하는 짧은 비유 1개 (행동 권고 금지)",
  "conclusion": {
    "label": "정보 정리",
    "signal": "neutral",
    "desc": "현재 공개정보, 변경된 사실, 추가 확인할 정보 순서로 2~3문장"
  }
}`
      : `## 응답 형식 (반드시 JSON으로)
{
  "currentStatus": "현재 상태를 2~3문장으로 설명",
  "indicators": [
    { "name": "이동평균", "value": "20일선 위/아래 등 객관적 위치", "signal": "neutral" },
    { "name": "RSI", "value": "수치와 지표 정의", "signal": "neutral" },
    { "name": "볼린저밴드", "value": "현재 위치", "signal": "neutral" },
    { "name": "MACD", "value": "현재 상태", "signal": "neutral" },
    { "name": "거래량", "value": "과거 평균 대비 수준", "signal": "neutral" }
  ],
  "historicalNote": "제공된 52주 고가·저가 범위에서 현재 가격의 산술적 위치를 1~2문장으로",
  "newsAnalysis": [뉴스가 있을 경우: {"headline": "기사 제목 그대로", "impact": "기사에서 확인되는 종목 관련 사실과 아직 확인되지 않은 정보 1문장"} 형태로 최대 3개. 뉴스가 없으면 빈 배열 []],
  "newsContext": "뉴스 없을 때만: '최근 24시간 내 관련 뉴스가 없어요'",
  "conclusion": {
    "label": "정보 정리",
    "signal": "neutral",
    "desc": "현재 공개정보, 변경된 사실, 추가 확인할 정보 순서로 2~3문장"
  }
}`;

    const rsiNumber = Number(rsi);
    const hasRsi = Number.isFinite(rsiNumber);
    const prompt = `${baseRules}

## 분석 대상
종목: ${symbol} (${koreanName || symbol})
현재가: ${formatNativeAmount(price)}
오늘 등락: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}% (${change != null ? formatNativeAmount(change) : '금액 데이터 없음'})
개인 보유정보·목표·메모: 전송하지 않음

## 기술적 지표
- RSI: ${hasRsi ? rsiNumber : '데이터 없음'}${hasRsi ? (rsiNumber < 30 ? ' (과매도 구간)' : rsiNumber > 70 ? ' (과매수 구간)' : ' (중립 범위)') : ''}
- 추세: ${trend || '데이터 없음'}
- 이동평균 교차: ${cross || '없음'}
- 차트 패턴: ${pattern || '없음'}
- 볼린저 밴드: ${bollingerStatus || '데이터 없음'}
- MACD: ${macdStatus || '데이터 없음'}
- 거래량: 평균 대비 ${volRatio ? (volRatio * 100).toFixed(0) + '%' : '데이터 없음'}

## 기본 지표 (Fundamentals)
${per != null ? `- PER(주가수익비율): ${per.toFixed(1)}` : '- PER: 데이터 없음'}
${eps != null ? `- EPS(주당순이익): ${formatNativeAmount(eps)}` : '- EPS: 데이터 없음'}
${week52High != null && week52Low != null ? `- 52주 고가/저가: ${formatNativeAmount(week52High)} / ${formatNativeAmount(week52Low)}` : ''}
${sector ? `- 섹터: ${sector}` : ''}

${timeSeriesContext ? timeSeriesContext + '\n\n' : ''}## 최근 뉴스
${recentNews || '관련 뉴스 없음'}

${responseFormat}`;

    // 키 × 모델 로테이션: 2.5-flash 실패 시 2.5-flash-lite로 fallback
    const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    const shuffledKeys = [...GEMINI_KEYS].sort(() => Math.random() - 0.5);
    let lastError: unknown;
    for (const model of MODELS) {
      for (const apiKey of shuffledKeys) {
      const keyIndex = GEMINI_KEYS.indexOf(apiKey);
      try {
        const startedAt = Date.now();
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: 'application/json', temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } },
        });

        const latencyMs = Date.now() - startedAt;
        const metadata = response.usageMetadata;
        await recordAiCost({
          feature: 'ai-analysis',
          provider: 'gemini',
          model,
          userId: userId!,
          inputTokens: metadata?.promptTokenCount ?? 0,
          outputTokens: metadata?.candidatesTokenCount ?? 0,
          cachedInputTokens: metadata?.cachedContentTokenCount ?? 0,
          reasoningTokens: metadata?.thoughtsTokenCount ?? 0,
          latencyMs,
        });

        const text = response.text || '';

        // 성공: 사용량 기록 (병렬)
        const [usageRecorded] = await Promise.all([
          recordUsage(ip, symbol, mentorId, userId!),
          recordGeminiKeyUsage(keyIndex),
        ]);
        const newTotal = totalCount + 1;
        const remaining = perUserLimit - userCount - 1;

        if (newTotal === Math.floor(DAILY_LIMIT_TOTAL * 0.8) || newTotal >= DAILY_LIMIT_TOTAL) {
          sendSlackAlert(newTotal);
        }

        try {
          const parsed = JSON.parse(text);
          const structurallySafe = isLev ? enforceLeverageReport(parsed) : parsed;
          const { report: governedReport, blockedCount } = governAiAnalysisReport(structurallySafe);
          if (blockedCount > 0) console.warn(`[AI analysis] ${blockedCount} directional text field(s) blocked`);
          const finalReport = attachAiResultMeta(governedReport, 'ai-analysis', { symbol, aiProvider: 'gemini', aiModel: model });
          await sampleAiOutput({ feature: 'ai-analysis', symbol, output: finalReport, sourceSnapshot: auditSnapshot });
          await gate.finalize(200, usageRecorded ? undefined : 'usage_record_failed');
          return NextResponse.json({ success: true, report: finalReport, remaining, dailyLimit: perUserLimit, tier });
        } catch {
          await gate.finalize(200, usageRecorded ? 'parse_fallback' : 'usage_record_failed');
          const fbReport = attachAiResultMeta(createAiAnalysisParseFallback(isLev), 'ai-analysis', { symbol, aiProvider: 'gemini', aiModel: model });
          await sampleAiOutput({ feature: 'ai-analysis', symbol, output: fbReport, sourceSnapshot: auditSnapshot });
          return NextResponse.json({ success: true, report: fbReport, remaining, dailyLimit: perUserLimit, tier });
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
      const aiRes = await callAiJson({
        prompt,
        temperature: 0.3,
        maxTokens: 4096,
        feature: 'ai-analysis',
        userId: userId!,
      });
      try {
        const parsed = JSON.parse(aiRes.text);
        const structurallySafe = isLev ? enforceLeverageReport(parsed) : parsed;
        const { report: governedReport, blockedCount } = governAiAnalysisReport(structurallySafe);
        if (blockedCount > 0) console.warn(`[AI analysis] ${blockedCount} directional text field(s) blocked`);
        const finalReport = attachAiResultMeta(governedReport, 'ai-analysis', { symbol, aiProvider: aiRes.provider, aiModel: aiRes.model });
        await sampleAiOutput({ feature: 'ai-analysis', symbol, output: finalReport, sourceSnapshot: auditSnapshot });
        const usageRecorded = await recordUsage(ip, symbol, mentorId, userId!);
        const newTotal = totalCount + 1;
        const remaining = perUserLimit - userCount - 1;
        if (newTotal === Math.floor(DAILY_LIMIT_TOTAL * 0.8) || newTotal >= DAILY_LIMIT_TOTAL) {
          sendSlackAlert(newTotal);
        }
        await gate.finalize(200, usageRecorded ? `fallback_${aiRes.provider}` : 'usage_record_failed');
        return NextResponse.json({ success: true, report: finalReport, remaining, dailyLimit: perUserLimit, tier, provider: aiRes.provider });
      } catch {
        const usageRecorded = await recordUsage(ip, symbol, mentorId, userId!);
        await gate.finalize(200, usageRecorded ? 'fallback_parse_fail' : 'usage_record_failed');
        const fbReport = attachAiResultMeta(createAiAnalysisParseFallback(isLev), 'ai-analysis', { symbol, aiProvider: aiRes.provider, aiModel: aiRes.model });
        await sampleAiOutput({ feature: 'ai-analysis', symbol, output: fbReport, sourceSnapshot: auditSnapshot });
        return NextResponse.json({
          success: true,
          report: fbReport,
          remaining: perUserLimit - userCount - 1,
          dailyLimit: perUserLimit,
          tier,
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
