import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
].filter(Boolean) as string[];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function getTodayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

async function recordOcrUsage(ip: string, stockCount: number, source: string, userId?: string) {
  if (!supabase) return;
  try {
    await supabase.from('ai_usage').insert({
      ip,
      user_id: userId || null,
      date: getTodayKST(),
      symbol: `ocr:${stockCount}stocks`,
      mentor_id: 'ocr-import',
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
  "source": "증권사명 추정 (예: 키움증권, 삼성증권, 미래에셋, 한국투자, 토스증권, Interactive Brokers, 알 수 없음)"
}

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
  source: string;
}

// 에러 코드 정의 (클라이언트가 UI 분기에 사용)
type OcrErrorCode =
  | 'no_file' | 'too_large' | 'bad_type' | 'service_down'
  | 'rate_limit' | 'parse_failed' | 'image_empty' | 'unknown';

function errJson(code: OcrErrorCode, error: string, hint: string, status: number) {
  return NextResponse.json({ error, code, hint }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return errJson('no_file', '이미지가 첨부되지 않았어요.', '스크린샷 이미지를 선택하거나 드래그해서 올려주세요.', 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return errJson('too_large', '파일이 너무 커요.', `현재 ${(file.size / 1024 / 1024).toFixed(1)}MB · 10MB 이하로 압축하거나 다시 캡처해주세요.`, 400);
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return errJson('bad_type', '지원하지 않는 이미지 형식이에요.', 'JPG, PNG, WEBP로 변환 후 다시 시도해주세요.', 400);
    }

    if (!GEMINI_KEYS.length) {
      return errJson('service_down', 'AI 분석 서비스가 준비 중이에요.', '잠시 후 다시 시도해주세요.', 503);
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // 키 로테이션: 실패 시 다른 키로 재시도
    const shuffledKeys = [...GEMINI_KEYS].sort(() => Math.random() - 0.5);
    let lastError: unknown;
    let rateLimitHit = false;

    for (const apiKey of shuffledKeys) {
      const keyIndex = GEMINI_KEYS.indexOf(apiKey);
      try {
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

        const raw = response.text || '';
        const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

        if (!text) {
          return errJson('parse_failed', 'AI가 이미지를 읽지 못했어요.', '이미지가 흐릿하거나 글자가 너무 작은지 확인 후 고화질로 다시 캡처해주세요.', 422);
        }

        let result: OcrResult;
        try {
          result = JSON.parse(text);
        } catch {
          return errJson('parse_failed', '이미지에서 종목 정보를 찾지 못했어요.', '보유종목 목록이 선명하게 보이도록 캡처 후 다시 시도해주세요.', 422);
        }

        if (!result.stocks || result.stocks.length === 0) {
          return errJson('image_empty', '보유 종목을 인식하지 못했어요.', '증권앱의 "보유종목" 또는 "계좌" 화면을 전체 캡처해주세요. 종목명과 수량이 모두 보여야 해요.', 422);
        }

        const valid = result.stocks.filter(s => s.symbol && (s.avgCost !== null || s.shares !== null));

        if (valid.length === 0) {
          return errJson('image_empty', '인식된 종목이 있지만 정보가 부족해요.', '종목명·보유수량이 잘리지 않도록 전체 화면을 캡처해주세요.', 422);
        }

        // 성공: 사용량 기록 (병렬)
        await Promise.all([
          recordOcrUsage(ip, valid.length, result.source || 'unknown'),
          recordGeminiKeyUsage(keyIndex),
        ]);

        return NextResponse.json({
          stocks: valid,
          source: result.source || '알 수 없음',
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
      return errJson('rate_limit', 'AI 분석 사용량을 초과했어요.', '오늘 할당량이 모두 소진됐어요. 내일 다시 시도하거나 종목을 직접 추가해주세요.', 429);
    }
    return errJson('unknown', '분석 중 오류가 발생했어요.', '잠시 후 다시 시도해주세요. 계속 실패하면 다른 스크린샷으로 시도해보세요.', 500);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[SOLB OCR] unexpected:', msg.slice(0, 300));
    return errJson('unknown', '분석 중 오류가 발생했어요.', '잠시 후 다시 시도해주세요.', 500);
  }
}
