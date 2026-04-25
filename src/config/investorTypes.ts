/**
 * 투자자 유형 시스템
 *
 * 유저의 선호 투자 스타일을 5가지로 분류.
 * AI 촉/분석이 이 유형에 맞춰 톤·관점·추천 기준을 조정.
 *
 * PortfolioDNA(현재 보유 기반 자동 분류)와 구분:
 * - DNA = 지금 있는 당신 (descriptive)
 * - Type = 되고 싶은 당신 (prescriptive)
 */

export type InvestorType = 'value' | 'growth' | 'income' | 'momentum' | 'diversified';

export interface InvestorTypeMeta {
  id: InvestorType;
  emoji: string;
  nameKr: string;
  tagline: string;
  description: string;
  keyTraits: string[];
  /** AI 프롬프트용 baseline 가이드 (시스템 레이어 삽입) */
  aiGuide: string;
  /** AI 촉 종목 선택 시 우선 키워드 (서버측 가중치) */
  chokPreference: string[];
  /** UI 색상 (CSS var or hex) */
  accentColor: string;
  /**
   * 코호트 참조용 — "같은 유형 투자자들이 자주 보는 종목" (큐레이션, 추천 아님)
   * 자본시장법: 단순 정보 제공 / 추천·권유 금지. UI에서 "관찰" 프레이밍 사용.
   */
  referencePicks: Array<{ symbol: string; reason: string }>;
  /** 코호트 평균 섹터 분포 (0~1, 합 1) — 본인 분포 비교용 */
  referenceSectors: Record<string, number>;
}

export const INVESTOR_TYPES: Record<InvestorType, InvestorTypeMeta> = {
  value: {
    id: 'value',
    emoji: '🏛️',
    nameKr: '가치 투자자',
    tagline: '저평가와 해자를 찾아요',
    description: '펀더멘털과 장기 가치에 기반해 투자하는 스타일. 시장이 흔들려도 "10년 뒤 이 회사는 더 좋아질까?"를 기준으로 판단해요. 워런 버핏 · 벤 그레이엄의 철학.',
    keyTraits: ['5년+ 장기 보유', '저PER·저PBR 선호', '경제적 해자·배당 중시', '단기 등락 무관심'],
    aiGuide: `장기 가치 투자 관점으로 답변하세요.
- 시간 축: 5~10년 관점. 단기 등락에 대한 반응 최소화
- 핵심 지표: PER, PBR, ROE, 배당수익률, FCF, 경제적 해자
- 권장 톤: 차분하고 담백. 숫자와 펀더멘털 중심. "시장 심리"는 부수적
- 회피: 단기 모멘텀·급등락 중심 코멘트, "지금 사야 한다"식 조급함`,
    chokPreference: ['대형주 배당', '저평가 블루칩', '필수소비재', '경제적 해자 뚜렷한 섹터'],
    accentColor: '#8B7355',
    referencePicks: [
      { symbol: 'BRK-B', reason: '버핏 직접 운용 · 다각화 지주' },
      { symbol: 'JNJ',   reason: '60년 연속 배당 인상' },
      { symbol: 'KO',    reason: '경제적 해자의 교과서' },
      { symbol: 'PG',    reason: '필수소비재 + 안정 배당' },
      { symbol: 'V',     reason: '결제 네트워크 해자' },
      { symbol: 'MSFT',  reason: '클라우드 + 안정 배당' },
    ],
    referenceSectors: { '금융': 0.30, '헬스케어': 0.25, '소비재': 0.25, 'IT': 0.20 },
  },

  growth: {
    id: 'growth',
    emoji: '🚀',
    nameKr: '성장 투자자',
    tagline: '내일의 대장주를 미리 봐요',
    description: '매출과 수익이 빠르게 성장하는 기업에 투자하는 스타일. 높은 밸류에이션을 허용하며 미래 잠재력을 중시. 피터 린치 · 캐시 우드의 철학.',
    keyTraits: ['1~3년 보유', '매출 성장률 중시', '테크·AI·바이오 선호', 'TAM·미래 시장 규모'],
    aiGuide: `성장주 투자 관점으로 답변하세요.
- 시간 축: 1~3년 관점. 다만 성장 스토리 훼손 시 빠른 재평가
- 핵심 지표: 매출 성장률, EPS 성장률, TAM(시장 규모), 시장 점유율 변화
- 권장 톤: 에너지 있고 미래 지향적. 섹터 테마 적극 언급
- 회피: 과도한 밸류에이션 경고로 기회 놓치게 만드는 방어적 톤`,
    chokPreference: ['AI/반도체', '클라우드/SaaS', '바이오테크', '고성장 섹터 리더'],
    accentColor: '#3182F6',
    referencePicks: [
      { symbol: 'NVDA',  reason: 'AI 반도체 압도적 점유율' },
      { symbol: 'MSFT',  reason: '클라우드 + AI 동시 leader' },
      { symbol: 'GOOGL', reason: '검색 + 클라우드 + AI' },
      { symbol: 'META',  reason: 'AI 인프라 + 광고 회복' },
      { symbol: 'AMD',   reason: 'AI 반도체 2위' },
      { symbol: 'TSLA',  reason: 'EV + 자율주행 옵션' },
    ],
    referenceSectors: { 'IT': 0.60, '헬스케어': 0.15, '자동차': 0.15, '미디어': 0.10 },
  },

  income: {
    id: 'income',
    emoji: '🛡️',
    nameKr: '안전·배당 투자자',
    tagline: '잘 안 내리는 게 곧 잘 오르는 것',
    description: '예측 가능한 현금흐름과 저변동성을 우선하는 스타일. 배당주·필수소비재·저베타 종목 중심. 존 보글의 인덱스 철학에 가까움.',
    keyTraits: ['꾸준한 배당', '저변동성·저베타', '경기 방어주', '원금 보존 우선'],
    aiGuide: `안전·배당 투자자 관점으로 답변하세요.
- 시간 축: 장기 보유 기본. "변동성=적"
- 핵심 지표: 배당수익률, 배당 성장률, 베타, 부채비율, 현금흐름 안정성
- 권장 톤: 차분하고 안정적. 리스크 경고 비교적 적극
- 회피: 변동성 큰 성장주·테마주 추천, 단기 매매 유도`,
    chokPreference: ['배당 ETF', '필수소비재', '유틸리티', '대형 배당주', '저변동성 지수'],
    accentColor: '#16A34A',
    referencePicks: [
      { symbol: 'SCHD', reason: '저평가 배당 ETF (배당+성장)' },
      { symbol: 'JEPI', reason: '월배당 + 변동성 완화' },
      { symbol: 'KO',   reason: '60년+ 배당 귀족' },
      { symbol: 'PG',   reason: '필수소비재 안정 현금흐름' },
      { symbol: 'JNJ',  reason: '헬스케어 방어 + 배당' },
      { symbol: 'VYM',  reason: '광범위 고배당 ETF' },
    ],
    referenceSectors: { '소비재': 0.30, '헬스케어': 0.25, '금융': 0.25, 'ETF': 0.20 },
  },

  momentum: {
    id: 'momentum',
    emoji: '⚡',
    nameKr: '모멘텀 트레이더',
    tagline: '흐름을 타고 끊기기 전에 내려요',
    description: '기술지표와 단기 추세를 활용해 빠르게 진입·이탈하는 스타일. 차트와 거래량이 핵심 판단 근거.',
    keyTraits: ['며칠~몇 주 보유', '기술지표 적극 활용', '거래량·추세 중시', '손절 원칙 엄격'],
    aiGuide: `모멘텀 트레이더 관점으로 답변하세요.
- 시간 축: 일~주 단위. 장기 전망은 부수적
- 핵심 지표: RSI, MACD, 볼린저밴드, 거래량, 이동평균 교차, 추세선 돌파
- 권장 톤: 빠르고 구체적. 진입가·손절가 제시
- 회피: "장기 보유하면 된다"식 passive 코멘트`,
    chokPreference: ['거래량 급증 종목', '기술적 돌파 임박', '고변동성 ETF(3X)', '단기 모멘텀 테마'],
    accentColor: '#FF9500',
    referencePicks: [
      { symbol: 'TSLA', reason: '고변동성 + 거래량 풍부' },
      { symbol: 'NVDA', reason: '모멘텀 추세 종목' },
      { symbol: 'COIN', reason: '크립토 베타 + 변동성' },
      { symbol: 'PLTR', reason: '테마 모멘텀 (AI/방산)' },
      { symbol: 'TQQQ', reason: '나스닥 3X 레버리지' },
      { symbol: 'MSTR', reason: '비트코인 프록시 모멘텀' },
    ],
    referenceSectors: { 'IT': 0.45, '자동차': 0.20, 'ETF': 0.20, '미디어': 0.15 },
  },

  diversified: {
    id: 'diversified',
    emoji: '🌐',
    nameKr: '분산 투자자',
    tagline: '시장을 이기지 않고 함께 가요',
    description: '섹터·자산·지역을 고루 분산해 시장 수익률 추종을 목표. ETF·지수 중심 로우 메인터넌스 스타일.',
    keyTraits: ['섹터 균형', 'ETF·지수 중심', '주기적 리밸런싱', '로우 메인터넌스'],
    aiGuide: `분산 투자자 관점으로 답변하세요.
- 시간 축: 중장기. 포트폴리오 관점 우선
- 핵심 지표: 섹터 비중, 상관계수, 리밸런싱 타이밍, 벤치마크(S&P500) 대비 수익률
- 권장 톤: 균형잡힌 객관적. "개별 종목보단 포트폴리오"
- 회피: 특정 종목에 과도한 확신, 집중 투자 권유`,
    chokPreference: ['광범위 ETF (VOO/QQQ)', '섹터 ETF', '테마 분산', '해외 분산'],
    accentColor: '#6366F1',
    referencePicks: [
      { symbol: 'VOO',  reason: 'S&P500 — 미국 대표 분산' },
      { symbol: 'QQQ',  reason: '나스닥100 — 테크 비중' },
      { symbol: 'VT',   reason: '전세계 주식 분산' },
      { symbol: 'SCHD', reason: '배당 + 가치 분산' },
      { symbol: 'BND',  reason: '미국 채권 ETF' },
      { symbol: 'VEA',  reason: '선진국 해외 분산' },
    ],
    referenceSectors: { 'ETF': 0.50, 'IT': 0.20, '헬스케어': 0.15, '소비재': 0.15 },
  },
};

// ─── 퀴즈 ──────────────────────────────────────────────────────────────────

export interface QuizAnswer {
  label: string;
  scores: Partial<Record<InvestorType, number>>;
}

export interface QuizQuestion {
  id: string;
  question: string;
  answers: QuizAnswer[];
}

export const INVESTOR_TYPE_QUIZ: QuizQuestion[] = [
  {
    id: 'holding_period',
    question: '주식을 보통 얼마나 오래 들고 계세요?',
    answers: [
      { label: '며칠~몇 주',    scores: { momentum: 3, growth: 1 } },
      { label: '몇 개월~1년',   scores: { growth: 2, momentum: 1, diversified: 1 } },
      { label: '1년~3년',       scores: { growth: 2, value: 2, diversified: 1 } },
      { label: '3년 이상',      scores: { value: 3, income: 2 } },
    ],
  },
  {
    id: 'drop_reaction',
    question: '보유 종목이 10% 하락했을 때 가장 먼저 드는 생각은?',
    answers: [
      { label: '손절 규칙대로 정리',              scores: { momentum: 3 } },
      { label: '분할 매수 기회일지 본다',         scores: { value: 2, diversified: 2 } },
      { label: '일단 지켜본다',                    scores: { growth: 2, income: 1 } },
      { label: '장기라 크게 신경 안 쓴다',         scores: { value: 3, income: 2, diversified: 1 } },
    ],
  },
  {
    id: 'info_source',
    question: '투자 결정 시 가장 신뢰하는 정보는?',
    answers: [
      { label: '차트 패턴 · 거래량',               scores: { momentum: 3 } },
      { label: '실적 발표 · 재무제표',             scores: { value: 3, income: 1 } },
      { label: '산업 전망 · 혁신 뉴스',            scores: { growth: 3 } },
      { label: '배당 내역 · 경기 방어성',          scores: { income: 3 } },
      { label: '거시 경제 · 포트폴리오 이론',      scores: { diversified: 3 } },
    ],
  },
  {
    id: 'ideal_return',
    question: '1년 뒤 이상적인 수익률은?',
    answers: [
      { label: '5~10% 꾸준히',                     scores: { income: 3, diversified: 1 } },
      { label: '10~15% 시장 평균 근처',            scores: { diversified: 3, value: 1 } },
      { label: '15~30% 시장 상회',                 scores: { value: 2, growth: 2 } },
      { label: '30% 이상 큰 수익',                 scores: { momentum: 2, growth: 2 } },
    ],
  },
  {
    id: 'max_concentration',
    question: '한 종목에 포트폴리오를 얼마까지 몰빵할 수 있어요?',
    answers: [
      { label: '50% 이상 (확신주 몰빵)',          scores: { value: 3, growth: 1 } },
      { label: '20~30% (핵심 포지션)',             scores: { value: 1, growth: 2, momentum: 1 } },
      { label: '10% 정도 (적당한 분산)',           scores: { diversified: 2, growth: 1 } },
      { label: '5% 이하 (초분산)',                 scores: { diversified: 3, income: 2 } },
    ],
  },
];

// ─── 점수 계산 ────────────────────────────────────────────────────────────

/**
 * 퀴즈 답변 → 유형 결정
 * 모든 답변의 점수 합산. 최고점 유형 반환 (동점 시 우선순위: diversified)
 */
export function calculateInvestorType(
  answers: Array<{ questionId: string; answerIndex: number }>,
): InvestorType {
  const scores: Record<InvestorType, number> = {
    value: 0, growth: 0, income: 0, momentum: 0, diversified: 0,
  };

  for (const ans of answers) {
    const q = INVESTOR_TYPE_QUIZ.find(q => q.id === ans.questionId);
    if (!q) continue;
    const answer = q.answers[ans.answerIndex];
    if (!answer) continue;
    for (const [type, points] of Object.entries(answer.scores) as Array<[InvestorType, number]>) {
      scores[type] += points;
    }
  }

  // 최고점 유형 (동점 시 diversified 우선 — 가장 중립적)
  const entries = Object.entries(scores) as Array<[InvestorType, number]>;
  entries.sort(([a], [b]) => {
    const scoreDiff = scores[b] - scores[a];
    if (scoreDiff !== 0) return scoreDiff;
    if (a === 'diversified') return -1;
    if (b === 'diversified') return 1;
    return 0;
  });
  return entries[0][0];
}

/** 기본 유형 (선택 안 한 유저) */
export const DEFAULT_INVESTOR_TYPE: InvestorType = 'diversified';
