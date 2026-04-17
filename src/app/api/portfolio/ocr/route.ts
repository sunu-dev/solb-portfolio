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
      "symbol": "종목코드 또는 티커 (예: 005930, AAPL, TSLA). 코드가 없으면 종목명으로 대체",
      "name": "종목명 (예: 삼성전자, Apple)",
      "avgCost": 평균매수가 (숫자, 통화기호/쉼표 제거),
      "shares": 보유수량 (숫자, 정수),
      "currency": "KRW 또는 USD (한국주식이면 KRW, 미국주식이면 USD)"
    }
  ],
  "source": "증권사명 추정 (예: 키움증권, 삼성증권, 미래에셋, 한국투자, 토스증권, Interactive Brokers, 알 수 없음)"
}

주의사항:
- avgCost는 '평균매수가', '평균단가', '매입가', 'Avg Cost', 'Average Price' 등에 해당하는 값
- shares는 '보유수량', '주수', '수량', 'Qty', 'Shares' 등에 해당하는 값
- 현재가, 평가금액, 수익률은 추출하지 않음
- 종목코드가 보이면 그대로 사용 (6자리 숫자면 한국주식)
- 이미지에서 읽을 수 없는 값은 null로 반환
- stocks 배열이 비어있으면 [] 반환`;

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: '이미지 파일이 없습니다.' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'JPG, PNG, WEBP 이미지만 지원합니다.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // 키 로테이션: 실패 시 다른 키로 재시도
    const shuffledKeys = [...GEMINI_KEYS].sort(() => Math.random() - 0.5);
    let lastError: unknown;

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

        const text = response.text || '{}';

        let result: OcrResult;
        try {
          result = JSON.parse(text);
        } catch {
          return NextResponse.json({ error: '이미지에서 종목 정보를 찾지 못했어요.' }, { status: 422 });
        }

        if (!result.stocks || result.stocks.length === 0) {
          return NextResponse.json({ error: '보유 종목이 없거나 인식하지 못했어요. 보유종목 화면을 캡처해주세요.' }, { status: 422 });
        }

        const valid = result.stocks.filter(s => s.symbol && (s.avgCost !== null || s.shares !== null));

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
        continue;
      }
    }

    console.error('OCR all keys failed:', lastError);
    return NextResponse.json({ error: '분석 중 오류가 발생했어요. 다시 시도해주세요.' }, { status: 500 });
  } catch (e) {
    console.error('OCR error:', e);
    return NextResponse.json({ error: '분석 중 오류가 발생했어요. 다시 시도해주세요.' }, { status: 500 });
  }
}
