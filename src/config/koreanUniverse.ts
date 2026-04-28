/**
 * 한국 주식 universe — "오늘 시장이 주목한 종목" feature용.
 *
 * 선정 기준 (객관 — 자본시장법 회피):
 *   - KOSPI 시총 상위 70종
 *   - KOSDAQ 시총 상위 30종
 *   - 큐레이터 주관 없음 (시총 단일 지표)
 *   - "추천 종목" 아닌 "정보 제공 대상" 명확
 *
 * 시총 순위는 분기마다 변동 — 베타 후 자동 갱신 cron 도입 예정.
 * 현재 스냅샷: 2026년 4월 기준 (KRX 시총).
 */

export interface KoreanStock {
  symbol: string;   // Finnhub 형식 (.KS = KOSPI, .KQ = KOSDAQ)
  krName: string;
  exchange: 'KS' | 'KQ';
}

export const KOREAN_UNIVERSE: KoreanStock[] = [
  // ─── KOSPI 시총 상위 70 ──────────────────────────────────────────────────
  { symbol: '005930.KS', krName: '삼성전자',           exchange: 'KS' },
  { symbol: '000660.KS', krName: 'SK하이닉스',         exchange: 'KS' },
  { symbol: '373220.KS', krName: 'LG에너지솔루션',     exchange: 'KS' },
  { symbol: '207940.KS', krName: '삼성바이오로직스',   exchange: 'KS' },
  { symbol: '005380.KS', krName: '현대차',             exchange: 'KS' },
  { symbol: '000270.KS', krName: '기아',               exchange: 'KS' },
  { symbol: '035420.KS', krName: 'NAVER',              exchange: 'KS' },
  { symbol: '068270.KS', krName: '셀트리온',           exchange: 'KS' },
  { symbol: '035720.KS', krName: '카카오',             exchange: 'KS' },
  { symbol: '006400.KS', krName: '삼성SDI',            exchange: 'KS' },
  { symbol: '005490.KS', krName: 'POSCO홀딩스',        exchange: 'KS' },
  { symbol: '105560.KS', krName: 'KB금융',             exchange: 'KS' },
  { symbol: '055550.KS', krName: '신한지주',           exchange: 'KS' },
  { symbol: '012330.KS', krName: '현대모비스',         exchange: 'KS' },
  { symbol: '051910.KS', krName: 'LG화학',             exchange: 'KS' },
  { symbol: '138040.KS', krName: '메리츠금융지주',     exchange: 'KS' },
  { symbol: '032830.KS', krName: '삼성생명',           exchange: 'KS' },
  { symbol: '323410.KS', krName: '카카오뱅크',         exchange: 'KS' },
  { symbol: '034730.KS', krName: 'SK',                 exchange: 'KS' },
  { symbol: '028260.KS', krName: '삼성물산',           exchange: 'KS' },
  { symbol: '086790.KS', krName: '하나금융지주',       exchange: 'KS' },
  { symbol: '033780.KS', krName: 'KT&G',               exchange: 'KS' },
  { symbol: '316140.KS', krName: '우리금융지주',       exchange: 'KS' },
  { symbol: '012450.KS', krName: '한화에어로스페이스', exchange: 'KS' },
  { symbol: '011200.KS', krName: 'HMM',                exchange: 'KS' },
  { symbol: '042700.KS', krName: '한미반도체',         exchange: 'KS' },
  { symbol: '377300.KS', krName: '카카오페이',         exchange: 'KS' },
  { symbol: '000810.KS', krName: '삼성화재',           exchange: 'KS' },
  { symbol: '003550.KS', krName: 'LG',                 exchange: 'KS' },
  { symbol: '034020.KS', krName: '두산에너빌리티',     exchange: 'KS' },
  { symbol: '009150.KS', krName: '삼성전기',           exchange: 'KS' },
  { symbol: '030200.KS', krName: 'KT',                 exchange: 'KS' },
  { symbol: '015760.KS', krName: '한국전력',           exchange: 'KS' },
  { symbol: '259960.KS', krName: '크래프톤',           exchange: 'KS' },
  { symbol: '021240.KS', krName: '코웨이',             exchange: 'KS' },
  { symbol: '096770.KS', krName: 'SK이노베이션',       exchange: 'KS' },
  { symbol: '011070.KS', krName: 'LG이노텍',           exchange: 'KS' },
  { symbol: '006800.KS', krName: '미래에셋증권',       exchange: 'KS' },
  { symbol: '003490.KS', krName: '대한항공',           exchange: 'KS' },
  { symbol: '005940.KS', krName: 'NH투자증권',         exchange: 'KS' },
  { symbol: '017670.KS', krName: 'SK텔레콤',           exchange: 'KS' },
  { symbol: '402340.KS', krName: 'SK스퀘어',           exchange: 'KS' },
  { symbol: '051900.KS', krName: 'LG생활건강',         exchange: 'KS' },
  { symbol: '097950.KS', krName: 'CJ제일제당',         exchange: 'KS' },
  { symbol: '329180.KS', krName: '한국조선해양',       exchange: 'KS' },
  { symbol: '009830.KS', krName: '한화솔루션',         exchange: 'KS' },
  { symbol: '090430.KS', krName: '아모레퍼시픽',       exchange: 'KS' },
  { symbol: '241560.KS', krName: '두산밥캣',           exchange: 'KS' },
  { symbol: '018880.KS', krName: '한온시스템',         exchange: 'KS' },
  { symbol: '006360.KS', krName: 'GS건설',             exchange: 'KS' },
  { symbol: '036460.KS', krName: '한국가스공사',       exchange: 'KS' },
  { symbol: '024110.KS', krName: '기업은행',           exchange: 'KS' },
  { symbol: '326030.KS', krName: 'SK바이오팜',         exchange: 'KS' },
  { symbol: '000880.KS', krName: '한화',               exchange: 'KS' },
  { symbol: '128940.KS', krName: '한미약품',           exchange: 'KS' },
  { symbol: '034220.KS', krName: 'LG디스플레이',       exchange: 'KS' },
  { symbol: '010140.KS', krName: '삼성중공업',         exchange: 'KS' },
  { symbol: '004370.KS', krName: '농심',               exchange: 'KS' },
  { symbol: '007310.KS', krName: '오뚜기',             exchange: 'KS' },
  { symbol: '161390.KS', krName: '한국타이어앤테크놀로지', exchange: 'KS' },
  { symbol: '000120.KS', krName: 'CJ대한통운',         exchange: 'KS' },
  { symbol: '047810.KS', krName: '한국항공우주',       exchange: 'KS' },
  { symbol: '000720.KS', krName: '현대건설',           exchange: 'KS' },
  { symbol: '000150.KS', krName: '두산',               exchange: 'KS' },
  { symbol: '004990.KS', krName: '롯데지주',           exchange: 'KS' },
  { symbol: '023530.KS', krName: '롯데쇼핑',           exchange: 'KS' },
  { symbol: '139480.KS', krName: '이마트',             exchange: 'KS' },
  { symbol: '078930.KS', krName: 'GS',                 exchange: 'KS' },
  { symbol: '352820.KS', krName: '하이브',             exchange: 'KS' },
  { symbol: '000810.KS', krName: '삼성화재',           exchange: 'KS' },
  { symbol: '036570.KS', krName: '엔씨소프트',         exchange: 'KS' },
  { symbol: '010130.KS', krName: '고려아연',           exchange: 'KS' },

  // ─── KOSDAQ 시총 상위 30 ─────────────────────────────────────────────────
  { symbol: '196170.KQ', krName: '알테오젠',           exchange: 'KQ' },
  { symbol: '247540.KQ', krName: '에코프로비엠',       exchange: 'KQ' },
  { symbol: '086520.KQ', krName: '에코프로',           exchange: 'KQ' },
  { symbol: '028300.KQ', krName: 'HLB',                exchange: 'KQ' },
  { symbol: '058470.KQ', krName: '리노공업',           exchange: 'KQ' },
  { symbol: '214150.KQ', krName: '클래시스',           exchange: 'KQ' },
  { symbol: '145020.KQ', krName: '휴젤',               exchange: 'KQ' },
  { symbol: '293490.KQ', krName: '카카오게임즈',       exchange: 'KQ' },
  { symbol: '263750.KQ', krName: '펄어비스',           exchange: 'KQ' },
  { symbol: '035900.KQ', krName: 'JYP Ent.',           exchange: 'KQ' },
  { symbol: '041510.KQ', krName: '에스엠',             exchange: 'KQ' },
  { symbol: '122870.KQ', krName: 'YG엔터테인먼트',     exchange: 'KQ' },
  { symbol: '039030.KQ', krName: '이오테크닉스',       exchange: 'KQ' },
  { symbol: '048410.KQ', krName: '현대바이오',         exchange: 'KQ' },
  { symbol: '112040.KQ', krName: '위메이드',           exchange: 'KQ' },
  { symbol: '078340.KQ', krName: '컴투스',             exchange: 'KQ' },
  { symbol: '194480.KQ', krName: '데브시스터즈',       exchange: 'KQ' },
  { symbol: '086900.KQ', krName: '메디톡스',           exchange: 'KQ' },
  { symbol: '034230.KQ', krName: '파라다이스',         exchange: 'KQ' },
  { symbol: '067310.KQ', krName: '하나마이크론',       exchange: 'KQ' },
  { symbol: '240810.KQ', krName: '원익IPS',            exchange: 'KQ' },
  { symbol: '278280.KQ', krName: '천보',               exchange: 'KQ' },
  { symbol: '357780.KQ', krName: '솔브레인',           exchange: 'KQ' },
  { symbol: '095340.KQ', krName: 'ISC',                exchange: 'KQ' },
  { symbol: '108860.KQ', krName: '셀바스AI',           exchange: 'KQ' },
  { symbol: '328130.KQ', krName: '루닛',               exchange: 'KQ' },
  { symbol: '900140.KQ', krName: '엘브이엠씨홀딩스',   exchange: 'KQ' },
  { symbol: '950140.KQ', krName: '잉글우드랩',         exchange: 'KQ' },
  { symbol: '000250.KQ', krName: '삼천당제약',         exchange: 'KQ' },
  { symbol: '067160.KQ', krName: '아프리카TV',         exchange: 'KQ' },
];

// 중복 제거 — 빠른 조회용 Map
const seen = new Set<string>();
export const KOREAN_UNIVERSE_DEDUPED: KoreanStock[] = KOREAN_UNIVERSE.filter(s => {
  if (seen.has(s.symbol)) return false;
  seen.add(s.symbol);
  return true;
});

export const KOREAN_KR_MAP: Record<string, string> = Object.fromEntries(
  KOREAN_UNIVERSE_DEDUPED.map(s => [s.symbol, s.krName])
);