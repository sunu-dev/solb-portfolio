import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { MENTOR_MAP } from '@/config/mentors';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { symbol, koreanName, price, change, changePercent, avgCost, shares, targetReturn,
            rsi, trend, cross, pattern, bollingerStatus, macdStatus, volRatio,
            recentNews, mentorId } = body;

    // Mentor mode
    const mentor = mentorId ? MENTOR_MAP[mentorId] : null;

    const baseRules = mentor
      ? `${mentor.systemPrompt}

## 중요 규칙
- 반드시 ${mentor.nameKr}(${mentor.name})의 말투와 철학으로 분석하세요
- 한국어로 "~에요", "~해요" 체로 설명하되, 해당 투자자의 개성이 드러나야 합니다
- 절대 "사세요", "파세요", "추천합니다" 같은 투자 권유 금지
- "~일 수 있어요", "~가능성이 있어요" 등 가능성으로만 표현
- 확률이나 퍼센트를 제시할 때는 반드시 "제공된 데이터 기준"이라고 명시하세요
- 근거 없는 확률은 절대 사용하지 마세요
- 이 투자자가 실제로 했던 명언을 1개 자연스럽게 인용하세요`
      : `당신은 한국인 주식 초보자를 위한 투자 분석 비서입니다.

## 중요 규칙
- "~에요", "~해요" 체로 친근하게 설명
- 전문 용어는 반드시 괄호 안에 쉬운 설명 추가
- 절대 "사세요", "파세요", "추천합니다" 같은 투자 권유 금지
- "~일 수 있어요", "~가능성이 있어요" 등 가능성으로만 표현
- 사실과 통계만 제시
- 확률이나 퍼센트를 제시할 때는 반드시 "최근 N일 기준" 또는 "제공된 데이터 기준"이라고 명시하세요
- 근거 없는 확률("70% 확률로 반등")은 절대 사용하지 마세요
- 대신 "반등 가능성이 있어요" 같은 가능성 표현을 사용하세요`;

    const responseFormat = mentor
      ? `## 응답 형식 (반드시 JSON으로)
{
  "currentStatus": "${mentor.nameKr}의 관점에서 현재 상태를 2~3문장으로 설명 (이 투자자의 말투로)",
  "mentorScore": 1~5 사이 정수 (이 투자자의 기준으로 이 종목/포트폴리오가 얼마나 좋은지),
  "mentorVerdict": "${mentor.nameKr}이라면 어떻게 할지 한 줄 요약",
  "keyAdvice": [
    "${mentor.nameKr}의 철학에 기반한 구체적 조언 1",
    "${mentor.nameKr}의 철학에 기반한 구체적 조언 2",
    "${mentor.nameKr}의 철학에 기반한 구체적 조언 3"
  ],
  "quote": "이 투자자의 실제 명언 1개 (영어 원문 + 한국어 번역)",
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

## 최근 뉴스
${recentNews || '관련 뉴스 없음'}

${responseFormat}`;

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const text = response.text || '';

    // Parse JSON from response
    try {
      const parsed = JSON.parse(text);
      return NextResponse.json({ success: true, report: parsed });
    } catch {
      // If JSON parsing fails, return raw text
      return NextResponse.json({ success: true, report: { currentStatus: text, indicators: [], historicalNote: '', newsContext: '', conclusion: { label: '분석 완료', signal: 'neutral', desc: text } } });
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error('Gemini API error:', errorMessage);
    return NextResponse.json({ error: 'AI 분석에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
