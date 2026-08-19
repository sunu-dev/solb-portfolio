import { NextRequest, NextResponse } from 'next/server';
import { getAuthClient, getServiceClient } from '@/lib/supabaseServer';
import { GoogleGenAI } from '@google/genai';
import { enforceRateLimit, getUserIdFromAuth, POLICIES } from '@/lib/rateLimiter';
import { checkCircuit, CIRCUIT_POLICIES, circuitOpenResponse } from '@/lib/circuitBreaker';
import { recordAiCost } from '@/lib/aiCostLedger';
import { getAiMonthlyBudgetStatus } from '@/lib/aiBudgetGuard';
import { isOcrProviderEnabled } from '@/lib/ocrAvailability';
import { hasCurrentAdultAiConsent } from '@/lib/aiAgeGate';
import { getStockCurrency } from '@/utils/stockCurrency';

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY2,
].filter(Boolean) as string[];

const DAILY_LIMIT_TOTAL = Number.parseInt(process.env.AI_DAILY_LIMIT_TOTAL || '250', 10);
const OCR_DAILY_LIMIT_USER = Number.parseInt(process.env.OCR_DAILY_LIMIT_USER || '5', 10);

function getTodayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

async function recordOcrUsage(ip: string, stockCount: number, source: string, userId?: string) {
  const client = getServiceClient() ?? getAuthClient();
  if (!client) return false;
  try {
    const { error } = await client.from('ai_usage').insert({
      ip,
      user_id: userId || null,
      date: getTodayKST(),
      symbol: `ocr:${stockCount}stocks`,
      mentor_id: 'ocr-import',
    });
    if (error) console.error('[OCR] usage record failed:', error.message);
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

async function getOcrDailyUsage(userId: string) {
  // 전체 사용량과 사용자별 사용량은 RLS 영향 없이 동일한 기준으로 집계해야 한다.
  const supabaseAdmin = getServiceClient();
  if (!supabaseAdmin) return { available: false, requesterCount: 0, totalCount: 0 };
  try {
    const requesterQuery = supabaseAdmin
      .from('ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('date', getTodayKST())
      .eq('mentor_id', 'ocr-import');

    const [requesterResult, totalResult] = await Promise.all([
      requesterQuery.eq('user_id', userId),
      supabaseAdmin.from('ai_usage').select('*', { count: 'exact', head: true }).eq('date', getTodayKST()),
    ]);

    if (requesterResult.error || totalResult.error) {
      console.error('[OCR] usage guard unavailable:', requesterResult.error?.message || totalResult.error?.message);
      return { available: false, requesterCount: 0, totalCount: 0 };
    }
    return {
      available: true,
      requesterCount: requesterResult.count || 0,
      totalCount: totalResult.count || 0,
    };
  } catch {
    return { available: false, requesterCount: 0, totalCount: 0 };
  }
}

const PROMPT = `이 이미지는 증권사 앱(MTS/HTS)의 보유종목 화면 스크린샷입니다.
화면에서 보유 종목 정보를 모두 추출해주세요.

반환 형식 (JSON만 반환, 설명 없이):
{
  "stocks": [
    {
      "symbol": "종목코드 또는 티커 (예: 005930, AAPL, TSLA). 코드가 없으면 아래 한국어 종목명→티커 변환표 참고",
      "name": "종목명 (예: 삼성전자, Apple)",
      "avgCost": 평균매수가 (숫자, 통화기호/쉼표 제거. 없으면 null),
      "shares": 보유수량 (숫자, 소수점 허용. 예: 0.068422, 1.5, 10),
      "currency": "KRW 또는 USD (한국주식이면 KRW, 미국주식이면 USD)"
    }
  ],
  "source": "증권사명 추정 (예: 키움증권, 삼성증권, 미래에셋, 한국투자, 토스증권, Interactive Brokers, 알 수 없음)",
  "brokerKey": "증권사 enum 키 — 다음 중 하나로만 응답: 'toss' | 'kiwoom' | 'mirae' | 'kis' | 'samsung' | 'nh' | 'kb' | 'shinhan' | 'meritz' | 'hana' | 'daishin' | 'yuanta' | 'sk' | 'eugene' | 'kakaopay' | 'other' | '' (확실하지 않으면 빈 문자열)"
}

증권사 enum 키 매핑 가이드:
- 토스증권 → toss
- 키움증권 / 키움 → kiwoom
- 미래에셋증권 / 미래에셋대우 → mirae
- 한국투자증권 / 한투 → kis
- 삼성증권 → samsung
- NH투자증권 / 농협 → nh
- KB증권 / 국민 → kb
- 신한투자증권 / 신한금융투자 → shinhan
- 메리츠증권 → meritz
- 하나증권 / 하나금융투자 → hana
- 대신증권 → daishin
- 유안타증권 → yuanta
- SK증권 → sk
- 유진투자증권 → eugene
- 카카오페이증권 → kakaopay
- 그 외 한국 증권사 → other
- 미국 증권사 (Robinhood, IBKR 등) → '' (빈 문자열, broker 필드 미지정)

주의사항:
- avgCost는 '평균매수가', '평균단가', '매입가', 'Avg Cost', 'Average Price' 등에 해당하는 값. 화면에 없으면 null
- shares는 '보유수량', '주수', '수량', 'Qty', 'Shares' 등에 해당하는 값. 소수점 그대로 유지 (반올림/정수 변환 금지)
- 현재가, 평가금액, 수익률은 추출하지 않음 (avgCost와 혼동 주의: 평가금액≠평균매수가)
- 종목코드가 보이면 그대로 사용 (6자리 숫자면 한국주식)
- 이미지에서 읽을 수 없는 값은 null로 반환
- stocks 배열이 비어있으면 [] 반환

한국어 종목명→미국 티커 변환표 (symbol란에 사용):
인텔→INTC, 애플→AAPL, 엔비디아→NVDA, 마이크로소프트→MSFT, 테슬라→TSLA,
아마존→AMZN, 구글→GOOGL, 알파벳→GOOGL, 메타→META, 넷플릭스→NFLX,
팔란티어→PLTR, AMD→AMD, 브로드컴→AVGO, TSMC→TSM, 암→ARM,
버크셔해서웨이→BRK.B, 비자→V, 마스터카드→MA, JP모건→JPM, 뱅크오브아메리카→BAC,
코카콜라→KO, 펩시→PEP, 존슨앤존슨→JNJ, 화이자→PFE, 일라이릴리→LLY,
월마트→WMT, 홈디포→HD, 나이키→NKE, 맥도날드→MCD, 스타벅스→SBUX,
스포티파이→SPOT, 스냅→SNAP, 트위터→X, 로빈후드→HOOD, 코인베이스→COIN,
마이크론→MU, 퀄컴→QCOM, 텍사스인스트루먼트→TXN, 어플라이드머티리얼즈→AMAT,
유나이티드헬스→UNH, CVS→CVS, 모더나→MRNA, 길리어드→GILD,
엑슨모빌→XOM, 셰브론→CVX, 코노코필립스→COP,
보잉→BA, 록히드마틴→LMT, 레이시온→RTX, 캐터필러→CAT,
리비안→RIVN, 루시드→LCID, 니오→NIO, BYD→BYDDY,
아크이노베이션→ARKK, SPY→SPY, QQQ→QQQ, IWM→IWM`;

export interface OcrStock {
  symbol: string;
  name: string;
  avgCost: number | null;
  shares: number | null;
  currency: 'KRW' | 'USD';
}

export interface OcrResult {
  stocks: OcrStock[];
  brokerKey?: string;  // Phase B-1 — 증권사 자동 추정 (Broker enum 키 또는 '')
  source: string;
}

function normalizeOcrStock(value: unknown): OcrStock | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const symbol = typeof row.symbol === 'string'
    ? row.symbol.trim().toUpperCase()
    : '';
  if (!/^[A-Z0-9.^-]{1,20}$/.test(symbol)) return null;

  const parsedCurrency = row.currency === 'KRW' || row.currency === 'USD'
    ? row.currency
    : null;
  if (!parsedCurrency) return null;
  const currency = getStockCurrency(symbol, parsedCurrency);

  const numberOrNull = (input: unknown, max: number): number | null =>
    typeof input === 'number'
      && Number.isFinite(input)
      && input > 0
      && input <= max
      ? input
      : null;
  const avgCost = numberOrNull(row.avgCost, 1_000_000_000_000_000);
  const shares = numberOrNull(row.shares, 1_000_000_000_000);
  if (avgCost === null && shares === null) return null;

  const name = typeof row.name === 'string'
    ? row.name.replace(/[\r\n\t]/g, ' ').trim().slice(0, 80)
    : '';
  return { symbol, name, avgCost, shares, currency };
}

const VALID_BROKER_KEYS = new Set([
  'toss', 'kiwoom', 'mirae', 'kis', 'samsung', 'nh', 'kb', 'shinhan',
  'meritz', 'hana', 'daishin', 'yuanta', 'sk', 'eugene', 'kakaopay', 'other',
]);

// 에러 코드 정의 (클라이언트가 UI 분기에 사용)
type OcrErrorCode =
  | 'no_file' | 'too_large' | 'bad_type' | 'service_down'
  | 'rate_limit' | 'daily_limit' | 'parse_failed' | 'image_empty'
  | 'unauthorized' | 'disabled' | 'unknown';

function errJson(code: OcrErrorCode, error: string, hint: string, status: number) {
  return NextResponse.json({ error, code, hint }, { status });
}

export async function POST(req: NextRequest) {
  // 무료 Gemini 서비스에는 개인정보가 포함될 수 있는 증권사 이미지를 보내지 않는다.
  // UI 플래그와 유료 서비스 확인 플래그가 모두 true여야만 아래 처리로 진입한다.
  if (!isOcrProviderEnabled()) {
    return errJson(
      'disabled',
      '스크린샷 가져오기는 준비 중이에요.',
      '개인정보 보호 기준을 충족한 AI 처리 환경을 준비하고 있어요. 지금은 종목을 직접 추가해주세요.',
      503,
    );
  }

  // OCR 이미지는 외부 AI 처리로 전달되므로 개인정보처리방침에 동의한
  // 로그인 사용자만 사용할 수 있다. 클라이언트 상태를 신뢰하지 않고 서버에서 검증한다.
  const userId = await getUserIdFromAuth(req);
  if (!userId) {
    return errJson(
      'unauthorized',
      '이미지 인식은 로그인 후 이용할 수 있어요.',
      '로그인한 뒤 다시 시도해주세요.',
      401,
    );
  }
  if (!await hasCurrentAdultAiConsent(getServiceClient(), userId)) {
    return errJson(
      'unauthorized',
      '만 18세 이상 확인 후 이용할 수 있어요.',
      '성인 확인과 필수 동의를 마친 뒤 다시 시도해주세요.',
      403,
    );
  }

  // Rate limit 게이트 (OCR은 이미지 토큰 비용이 가장 큼 → 시간당 로그인 5회)
  const gate = await enforceRateLimit(req, '/api/portfolio/ocr', POLICIES.ocr);
  if (!gate.ok) return gate.response;

  // Circuit breaker — Gemini 장애 감지 시 503
  const circuit = await checkCircuit('/api/portfolio/ocr', CIRCUIT_POLICIES.aiStrict);
  if (circuit.open) {
    console.warn('[CIRCUIT OPEN] /api/portfolio/ocr:', circuit.reason);
    await gate.finalize(503, 'circuit_open');
    return circuitOpenResponse(circuit, '/api/portfolio/ocr');
  }

  // 모든 에러 exit에서 자동 finalize (내부는 errJson 호출)
  const fail = async (code: OcrErrorCode, error: string, hint: string, status: number) => {
    await gate.finalize(status, code);
    return errJson(code, error, hint, status);
  };

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const dailyLimit = OCR_DAILY_LIMIT_USER;
    const { available: usageAvailable, requesterCount, totalCount } = await getOcrDailyUsage(userId);

    if (!usageAvailable) {
      return await fail(
        'service_down',
        'AI 사용량 확인 시스템을 점검하고 있어요.',
        '직접 입력을 이용하거나 잠시 후 다시 시도해주세요.',
        503,
      );
    }

    if (totalCount >= DAILY_LIMIT_TOTAL) {
      return await fail(
        'daily_limit',
        '오늘 전체 AI 이용량이 한도에 도달했어요.',
        '종목을 직접 입력하거나 내일 다시 시도해주세요.',
        429,
      );
    }

    if (requesterCount >= dailyLimit) {
      return await fail(
        'daily_limit',
        `오늘 이미지 인식 횟수를 모두 사용했어요 (${dailyLimit}회/일).`,
        '종목을 직접 입력하거나 내일 다시 시도해주세요.',
        429,
      );
    }

    const contentType = req.headers.get('content-type')?.toLowerCase() || '';
    if (!contentType.startsWith('multipart/form-data')) {
      return await fail('no_file', '이미지가 첨부되지 않았어요.', '스크린샷 이미지를 선택하거나 드래그해서 올려주세요.', 400);
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return await fail('no_file', '이미지가 첨부되지 않았어요.', '스크린샷 이미지를 다시 선택해서 올려주세요.', 400);
    }
    const file = formData.get('image') as File | null;

    if (!file) {
      return await fail('no_file', '이미지가 첨부되지 않았어요.', '스크린샷 이미지를 선택하거나 드래그해서 올려주세요.', 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return await fail('too_large', '파일이 너무 커요.', `현재 ${(file.size / 1024 / 1024).toFixed(1)}MB · 10MB 이하로 압축하거나 다시 캡처해주세요.`, 400);
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return await fail('bad_type', '지원하지 않는 이미지 형식이에요.', 'JPG, PNG, WEBP로 변환 후 다시 시도해주세요.', 400);
    }

    if (!GEMINI_KEYS.length) {
      return await fail('service_down', 'AI 분석 서비스가 준비 중이에요.', '잠시 후 다시 시도해주세요.', 503);
    }

    const budget = await getAiMonthlyBudgetStatus();
    if (!budget.allowed) {
      return await fail(
        'service_down',
        'AI 이미지 인식 사용량을 점검하고 있어요.',
        '직접 입력을 이용하거나 잠시 후 다시 시도해주세요.',
        503,
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    // 키 로테이션: 실패 시 다른 키로 재시도
    const shuffledKeys = [...GEMINI_KEYS].sort(() => Math.random() - 0.5);
    let lastError: unknown;
    let rateLimitHit = false;

    for (const apiKey of shuffledKeys) {
      const keyIndex = GEMINI_KEYS.indexOf(apiKey);
      try {
        const startedAt = Date.now();
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: PROMPT },
                {
                  inlineData: {
                    mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                    data: base64,
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        const metadata = response.usageMetadata;
        await recordAiCost({
          feature: 'portfolio-ocr',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          inputTokens: metadata?.promptTokenCount ?? 0,
          outputTokens: metadata?.candidatesTokenCount ?? 0,
          cachedInputTokens: metadata?.cachedContentTokenCount ?? 0,
          reasoningTokens: metadata?.thoughtsTokenCount ?? 0,
          latencyMs: Date.now() - startedAt,
        });

        const raw = response.text || '';
        const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

        if (!text) {
          return await fail('parse_failed', 'AI가 이미지를 읽지 못했어요.', '이미지가 흐릿하거나 글자가 너무 작은지 확인 후 고화질로 다시 캡처해주세요.', 422);
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return await fail('parse_failed', '이미지에서 종목 정보를 찾지 못했어요.', '보유종목 목록이 선명하게 보이도록 캡처 후 다시 시도해주세요.', 422);
        }

        if (!parsed || typeof parsed !== 'object') {
          return await fail('parse_failed', '이미지 분석 결과를 확인하지 못했어요.', '보유종목 화면을 선명하게 다시 캡처해주세요.', 422);
        }
        const result = parsed as Record<string, unknown>;
        if (!Array.isArray(result.stocks) || result.stocks.length === 0) {
          return await fail('image_empty', '보유 종목을 인식하지 못했어요.', '증권앱의 "보유종목" 또는 "계좌" 화면을 전체 캡처해주세요. 종목명과 수량이 모두 보여야 해요.', 422);
        }

        const valid = result.stocks
          .slice(0, 100)
          .map(normalizeOcrStock)
          .filter((stock): stock is OcrStock => stock !== null);

        if (valid.length === 0) {
          return await fail('image_empty', '인식된 종목이 있지만 정보가 부족해요.', '종목명·보유수량이 잘리지 않도록 전체 화면을 캡처해주세요.', 422);
        }

        // 성공: 사용량 기록 (병렬)
        const [usageRecorded] = await Promise.all([
          recordOcrUsage(
            ip,
            valid.length,
            typeof result.source === 'string' ? result.source.slice(0, 80) : 'unknown',
            userId || undefined,
          ),
          recordGeminiKeyUsage(keyIndex),
        ]);
        await gate.finalize(200, usageRecorded ? undefined : 'usage_record_failed');

        return NextResponse.json({
          stocks: valid,
          brokerKey: typeof result.brokerKey === 'string' && VALID_BROKER_KEYS.has(result.brokerKey)
            ? result.brokerKey
            : '',
          source: typeof result.source === 'string'
            ? result.source.replace(/[\r\n\t]/g, ' ').trim().slice(0, 80) || '알 수 없음'
            : '알 수 없음',
          total: valid.length,
        });
      } catch (e) {
        lastError = e;
        const msg = e instanceof Error ? e.message : String(e);
        // Gemini rate limit / quota 감지
        if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg)) {
          rateLimitHit = true;
        }
        console.error('[SOLB OCR] key failed:', msg.slice(0, 200));
        continue;
      }
    }

    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    console.error('[SOLB OCR] all keys failed:', errMsg.slice(0, 300));

    if (rateLimitHit) {
      return await fail('rate_limit', 'AI 분석 사용량을 초과했어요.', '오늘 할당량이 모두 소진됐어요. 내일 다시 시도하거나 종목을 직접 추가해주세요.', 429);
    }
    return await fail('unknown', '분석 중 오류가 발생했어요.', '잠시 후 다시 시도해주세요. 계속 실패하면 다른 스크린샷으로 시도해보세요.', 500);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[SOLB OCR] unexpected:', msg.slice(0, 300));
    return await fail('unknown', '분석 중 오류가 발생했어요.', '잠시 후 다시 시도해주세요.', 500);
  }
}
