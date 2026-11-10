import { FORBIDDEN_PHRASES } from '@/utils/alertCompliance';

export const NEUTRALIZED_ANALYSIS_TEXT =
  '매매 방향으로 해석될 수 있는 내용은 표시하지 않았어요. 현재 수치와 공개 정보만 확인해주세요.';

const PARSE_FALLBACK_TEXT =
  'AI 응답 형식을 확인하지 못해 분석 내용을 표시하지 않았어요. 잠시 후 다시 시도해주세요.';
// A specific factual regression seen in a real API answer. IFRS 15 recognizes
// supplied goods/services, not simply cash received. This is not general fact verification.
export const REVENUE_CASH_EXPLANATION = '계약은 상품이나 서비스를 공급하기로 한 약속이에요. 매출은 상품·서비스를 제공해 회계에 기록한 판매 금액이고, 실제 돈이 들어오는 시점과는 다를 수 있어요.';
const REVENUE_AS_CASH = /매출(?:은|이란)\s*(?:실제(?:로)?\s*)?(?:받은|입금된)\s*(?:돈|금액)(?:이에요|입니다|을\s*뜻해요|을\s*말해요)/;

/**
 * 표현을 다른 투자 표현으로 순화하지 않고 문장 전체를 숨긴다.
 * 목표 수익률·평균 매수가처럼 사용자가 입력한 산술 기록은 보존하되,
 * 매매 행동·가격 목표·전망·가치 평가는 사용자에게 전달하지 않는다.
 */
const DIRECTIONAL_PATTERNS: readonly RegExp[] = [
  /(?:지금|즉시|현재).{0,10}(?:사세요|파세요|매수|매도|진입|청산|손절|익절|수익\s*실현)/,
  /(?:매수|매도|진입|청산|보유|관망|손절|익절|수익\s*실현|추가\s*매수|물타기|갈아타기|리밸런싱).{0,14}(?:권장|추천|고려|하세요|해야|좋(?:아요|습니다)|유리|적기|타이밍|기회|적합)/,
  /(?:권장|추천|고려).{0,12}(?:매수|매도|진입|청산|보유|관망|손절|익절|비중)/,
  /(?:비중|포지션).{0,10}(?:늘리|줄이|확대|축소|조정|높이|낮추)/,
  /(?:목표가|적정가|진입가|매수가|매도가|손절가|익절가|지지선|저항선)\s*[:：]?\s*(?:[$₩]\s*)?[\d,.]+/,
  /(?:반등|상승|하락|조정|급등|급락|추세\s*전환).{0,12}(?:가능성|확률|예상|전망|임박|유력)/,
  /(?:가능성|확률|예상|전망).{0,12}(?:반등|상승|하락|조정|급등|급락|추세\s*전환)/,
  /(?:저평가|고평가|과대평가|과소평가|매력도|투자\s*매력|매수\s*기회|매도\s*기회)/,
];

function directionalIssue(value: string, educationalQuestion: boolean): string | undefined {
  // Preserve this narrow explanatory negation; it is not a valuation claim.
  // All remaining text still goes through the recommendation/forecast checks.
  const checked = educationalQuestion
    ? value.replace(/저평가라는\s*(?:뜻|의미)(?:은|는|가|이)?\s*아니/g, '그런 뜻은 아니')
    : value;
  // A direct question may name averaging down to explain its meaning/risks.
  // Recommendations containing that term still match DIRECTIONAL_PATTERNS.
  const phrase = FORBIDDEN_PHRASES.findIndex((phrase) => !(educationalQuestion && phrase === '물타기') && checked.includes(phrase));
  if (phrase >= 0) return `phrase_${phrase}`;
  const pattern = DIRECTIONAL_PATTERNS.findIndex((pattern) => pattern.test(checked));
  return pattern >= 0 ? `pattern_${pattern}` : undefined;
}

export interface GovernedAiAnalysis {
  report: Record<string, unknown>;
  blockedCount: number;
  blockedFields: { field: string; rule: string }[];
}

export function governAiAnalysisReport(input: unknown, options: { educationalQuestion?: boolean } = {}): GovernedAiAnalysis {
  let blockedCount = 0;
  const blockedFields: GovernedAiAnalysis['blockedFields'] = [];
  const fields = new Set(['currentStatus','keyAdvice','assistantInsights','followUps','conclusion','indicators','historicalNote','newsAnalysis','newsContext','chartViews']);

  function walk(value: unknown, field = 'other'): unknown {
    if (typeof value === 'string') {
      const rule = directionalIssue(value, options.educationalQuestion === true);
      if (rule) {
        if (blockedFields.length < 20) blockedFields.push({ field, rule });
        blockedCount += 1;
        return NEUTRALIZED_ANALYSIS_TEXT;
      }
      if (REVENUE_AS_CASH.test(value)) { blockedCount += 1; if (blockedFields.length < 20) blockedFields.push({ field, rule: 'revenue_as_cash' }); return REVENUE_CASH_EXPLANATION; }
      return value;
    }
    if (Array.isArray(value)) return value.map(item => walk(item, field));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, walk(item, fields.has(key) ? key : field)]),
      );
    }
    return value;
  }

  const walked = walk(input);
  const report = walked && typeof walked === 'object' && !Array.isArray(walked)
    ? walked as Record<string, unknown>
    : {};

  delete report.mentorScore;
  delete report.mentorVerdict;
  delete report.scenarios;

  if (Array.isArray(report.indicators)) {
    report.indicators = report.indicators.map((indicator) =>
      indicator && typeof indicator === 'object' && !Array.isArray(indicator)
        ? { ...(indicator as Record<string, unknown>), signal: 'neutral' }
        : indicator,
    );
  }

  const conclusion = report.conclusion && typeof report.conclusion === 'object' && !Array.isArray(report.conclusion)
    ? report.conclusion as Record<string, unknown>
    : {};
  report.conclusion = { ...conclusion, label: '정보 정리', signal: 'neutral' };

  return { report, blockedCount, blockedFields };
}

/** 모델 원문을 인자로 받지 않는 결정론적 파싱 실패 응답. */
export function createAiAnalysisParseFallback(isLeverage = false): Record<string, unknown> {
  const message = isLeverage
    ? 'AI 응답 형식을 확인하지 못해 위험 해설을 표시하지 않았어요. 이 상품은 일일 수익률을 배수로 추종해 변동성과 복리 손실 위험이 커요.'
    : PARSE_FALLBACK_TEXT;

  return {
    currentStatus: message,
    indicators: [],
    historicalNote: '',
    newsAnalysis: [],
    newsContext: '',
    conclusion: {
      label: isLeverage ? '주의' : '표시 보류',
      signal: isLeverage ? 'negative' : 'neutral',
      desc: message,
    },
  };
}
