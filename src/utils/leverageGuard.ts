// ==========================================
// LEVERAGE GUARD — 단일종목 레버리지·인버스 차단 SSOT
// ==========================================
//
// 배경 (2026-05-27 KRX 상장 사건):
// - 단일종목 레버리지 ETF 16종 + ETN 2종 동시 상장 (4.3조원, 사상 최대)
// - 기초자산: 삼성전자(005930.KS), SK하이닉스(000660.KS)
// - 발행사: KODEX(삼성)·TIGER(미래에셋)·ACE(한국투자) [ETF] · 미래에셋증권 [ETN]
// - 금감원 가이드: 'ETF' 명칭 금지, 사전교육 2시간, 예탁금 1000만원, 적합성 의무
// - 위험: 하루 60% 손실 가능, 음의 복리, 발행사 신용리스크
//
// 정책 ('중간 옵션' — 2026-05-29 변호사 의견 반영, 옵션 C 폐기):
//   차단의 기준은 '종목'이 아니라 'AI 출력이 가리키는 방향'이다.
//   - ✅ 허용: 사용자가 '이미 보유한' 단일종목 레버리지의 사후 위험 해설
//             (현황·변동성·구조·음의 복리·발행사 신용 위험 고지). 소비자 보호에 부합.
//   - 🔴 차단: 신규 매매 유인 — AI 촉(관찰 후보)·universe 편입·신규 매수 시사·
//             매수 유인 알림. 이름과 무관하게 '신규 매수 신호'면 §6 자문업으로 당겨짐.
//
//   판별 분리: isSingleStockLeverage()는 '이 종목이 단일종목 레버리지인가'(분류)만 답한다.
//   차단/허용은 각 진입점의 '의도'에 따라 호출부에서 결정한다.
//
// 진입점별 정책 (방향성):
// - api/ai-chok/route.ts        — 신규 발굴 → 🔴 차단 유지
// - api/admin/listings/add      — universe 편입 → 🔴 차단 유지
// - chokUniverse / universe 승급 — 🔴 차단 유지
// - api/search/route.ts         — 보유 입력용 발견 → ✅ 노출 (라벨)
// - SearchBar 보유 등록          — ✅ 허용 (성인·위험 게이트 후)
// - config/analysisPrompt.ts    — 보유분 → ✅ 위험 해설만 (매매 방향 금지)
// - utils/alertsEngine.ts       — 보유분 → ✅ 위험 고지 / 🔴 매수 유인 차단
// - api/cron/morning-brief      — 보유분 → ✅ 위험 라인 / 🔴 매수 유인 차단
//
// ⚠️ 구현은 사용자(파운더) GO(2026-05-29) 하에 진행. production 배포는 약관 v4
//    변호사 정식 검토 후 (의견서 §5). 분쟁 대비 사전 법률의견서 확보 권장.

/** 2026-05-27 KRX 단일종목 레버리지/인버스 ETF 16종 단축코드.
 *
 * 웹 리서치 + K-ETF ISIN(KR7+코드+체크) 교차검증으로 확인 (2026-05-30).
 * ⚠️ 신형 **알파뉴메릭** 단축코드(0193W0 등) — 순수 숫자 6자리가 아니라 krNormalize
 *    (/^\d{6}$/) 대상이 아님 → deny-list에 직접 등재. 8개 운용사, 14종 2X + 2종 인버스(-2X).
 *    증권사 'A' 접두(A0193W0)는 표시용 별개지만, 종목명 키워드('단일종목'·'레버리지')로
 *    이중 탐지되므로 bare + .KS 양형 등재로 충분. (ACE 2종은 발행사 사이트 JS 차단으로
 *    medium 신뢰도이나 한국투자증권 공지+집계 2출처 일치. 운영 반영 시 KRX 최종 대조 권장.)
 */
const KR_LEVERAGE_ETF_2026 = [
  '0193W0', '0193T0', // KODEX(삼성운용) 삼성전자 / SK하이닉스 레버리지 2X
  '0195R0', '0195S0', // TIGER(미래에셋) 삼성전자 / SK하이닉스 레버리지 2X
  '0194M0', '0194T0', // ACE(한국투자) 삼성전자 / SK하이닉스 레버리지 2X
  '0192M0', '0192L0', // RISE(KB) 삼성전자 / SK하이닉스 레버리지 2X
  '0193K0', '0193L0', // PLUS(한화) 삼성전자 레버리지 2X / 삼성전자선물 인버스 -2X
  '0197W0', '0197X0', // SOL(신한) SK하이닉스 레버리지 2X / SK하이닉스선물 인버스 -2X
  '0194N0', '0194R0', // KIWOOM(키움) 삼성전자선물 / SK하이닉스선물 레버리지 2X
  '0198B0', '0198D0', // 1Q(하나) 삼성전자선물 / SK하이닉스선물 레버리지 2X
];

/** 확정 deny-list — 정확한 종목코드 확인된 단일종목 레버리지/인버스 상품 (bare + .KS 양형) */
const LEVERAGE_DENY_SYMBOLS = new Set<string>([
  '520100.KS', '520100',  // 미래에셋 레버리지 삼성전자 단일종목 ETN (2026-05-27 상장)
  '520101.KS', '520101',  // 미래에셋 레버리지 SK하이닉스 단일종목 ETN (2026-05-27 상장)
  ...KR_LEVERAGE_ETF_2026,
  ...KR_LEVERAGE_ETF_2026.map(c => `${c}.KS`),
]);

/** 한국 ETN 종목코드 패턴 — 5xxxxx 6자리 (520xxx 시리즈 포함) */
const KOREAN_ETN_CODE = /^5\d{5}\.K[SQ]$/;

// 미국 단일종목 레버리지/인버스 화이트리스트 (Direxion·GraniteShares 등).
// isSingleStockLeverage(분류)와 classifyAssetClass(자산 클래스) 양쪽이 공유 — symbol 기준 인식.
const LEVERAGED_SINGLE_US = new Set(['TSLL', 'NVDU', 'NVDX', 'AAPU', 'MSFU', 'AMZU', 'GGLL', 'METU', 'NFLU']);
const INVERSE_SINGLE_US = new Set(['TSLQ', 'NVDD', 'NVDQ', 'AAPD', 'MSFD', 'AMZD', 'GGLS', 'METD', 'NFLD']);

/** bare 6자리 한국코드 → .KS 정규화 (OCR·접미사 없는 입력 대응) */
function krNormalize(sym: string): string {
  return /^\d{6}$/.test(sym) ? `${sym}.KS` : sym;
}

/** 종목명에서 레버리지·인버스 시그널 어휘 */
const LEVERAGE_NAME_PATTERNS: RegExp[] = [
  /레버리지/,
  /인버스/,
  /곱버스/,
  /단일종목/,        // KRX 가이드: 단일종목 레버리지는 '단일종목' 명칭 강제
  /일일\s*2배/,
  /\b2X\b/i,         // 'KODEX 200 2X', '삼전 2X' 등
  /-2X\b/i,          // 인버스 -2X
  /TQQQ|SQQQ|SOXL|SOXS|UPRO|SPXS|FNGU|FNGD|TSLL|NVDU|NVDD/i, // 미국 대표 단일·섹터 레버리지
];

function hasLeverageKeyword(text: string): boolean {
  return LEVERAGE_NAME_PATTERNS.some(p => p.test(text));
}

/**
 * 단일종목 레버리지·인버스 **분류** 판정 (정책 아님).
 *
 * "이 종목이 단일종목 레버리지/인버스인가?"에만 답한다.
 * 차단/허용은 호출부가 진입점 의도(신규 유인 vs 보유 해설)에 따라 결정한다.
 *
 * @param symbol 종목코드 (예: '520100.KS', 'TQQQ', 'AAPL')
 * @param description 종목명 (Finnhub description 또는 사용자/admin 입력값)
 */
export function isSingleStockLeverage(symbol: string, description?: string): boolean {
  if (!symbol) return false;
  const sym = symbol.toUpperCase().trim();
  const norm = krNormalize(sym); // bare '520100' → '520100.KS'

  // 1) 확정 deny-list (원본 + .KS 정규화 — OCR bare 코드 대응)
  if (LEVERAGE_DENY_SYMBOLS.has(sym) || LEVERAGE_DENY_SYMBOLS.has(norm)) return true;

  // 2) 미국 단일종목 레버리지/인버스 화이트리스트 — **symbol 기준** (description 불필요).
  //    TSLL·NVDU·AAPU 등은 description 키워드 없이도 차단돼야 함 (STOCK_KR undefined 경로 누수 차단).
  if (LEVERAGED_SINGLE_US.has(sym) || INVERSE_SINGLE_US.has(sym)) return true;

  // 3) 종목명 키워드 (description 제공 경로 — 한국 ETF 16종 등 코드 미확정분 대응)
  if (description && hasLeverageKeyword(description)) return true;

  return false;
}

/**
 * @deprecated 이름이 '무조건 차단'을 암시해 '중간 옵션'과 어긋난다.
 * 신규 매수 유인 표면(촉·universe·admin 등록)에서만 차단 의미로 쓰고,
 * 보유 해설 표면에서는 쓰지 말 것. 분류엔 isSingleStockLeverage() 직접 사용.
 */
export const isBlockedLeverage = isSingleStockLeverage;

// ── 사용자 노출 카피 ──────────────────────────────────────────────────────

/** 신규 발굴 차단 표면(AI 촉·admin universe 등록)의 거부 사유 */
export const LEVERAGE_NEW_BUY_BLOCK_MESSAGE =
  '단일종목 레버리지·인버스 ETF/ETN은 주비가 신규로 추천하거나 관찰 후보로 제시하지 않아요. 일일 N배 추종·음의 복리·발행사 신용 위험이 있는 고위험 단기 트레이딩 도구예요.';

/** 보유분 위험 고지 톤 — 분석·알림에서 "신규 추천 아님 + 위험 함께 보기" 프레이밍 */
export const LEVERAGE_HOLDING_RISK_NOTE =
  '일일 N배 추종·음의 복리·발행사 신용 위험이 있는 단기 트레이딩 도구예요. 추천 목적이 아니라, 보유 중인 위험을 함께 보기 위한 정보예요.';

/** 검색 결과 라벨 — 노출은 하되 '신규 추천 아님' 명시 */
export const LEVERAGE_SEARCH_LABEL = '고위험 · 보유 관리용';

/**
 * @deprecated '분석 대상 아님' 프레이밍은 중간 옵션과 어긋남(보유분은 해설 제공).
 * 신규 차단 사유엔 LEVERAGE_NEW_BUY_BLOCK_MESSAGE 사용.
 */
export const LEVERAGE_BLOCK_USER_MESSAGE = LEVERAGE_NEW_BUY_BLOCK_MESSAGE;

/** 짧은 변형 — 검색 결과 1줄, 종목 카드 띠 등 공간 제약 시 */
export const LEVERAGE_BLOCK_SHORT = '단일종목 레버리지는 신규 추천하지 않아요';

// ==========================================
// ASSET CLASS — Universe 4번째 룰 (P1, 2026-05-28)
// ==========================================
//
// stock_listings.asset_class 컬럼 SSOT (DB CHECK constraint 일치)
// universe 자동 승급 시 isUniverseEligibleClass()로 4번째 룰 적용.

export type AssetClass =
  | 'normal'             // 일반 주식
  | 'etf_index'          // 지수 ETF
  | 'etf_sector'         // 섹터 ETF
  | 'etf_dividend'       // 배당 ETF
  | 'leveraged_index'    // 지수 레버리지 (TQQQ)
  | 'inverse_index'      // 지수 인버스 (SQQQ)
  | 'leveraged_single'   // 단일종목 레버리지 (520100.KS, TSLL)
  | 'inverse_single'     // 단일종목 인버스 (NVDD)
  | 'etn'                // 일반 ETN
  | 'reit'               // 부동산
  | 'other';             // 기타

// 미국 단일종목 레버리지/인버스 화이트리스트는 상단으로 이동(isSingleStockLeverage와 공유).

// 미국 지수 레버리지/인버스 화이트리스트
const LEVERAGED_INDEX_US = new Set(['TQQQ', 'SOXL', 'UPRO', 'FNGU', 'TNA', 'TMF', 'TECL', 'CURE', 'FAS', 'YINN', 'LABU', 'JNUG']);
const INVERSE_INDEX_US = new Set(['SQQQ', 'SOXS', 'SPXS', 'SH', 'FNGD', 'TZA', 'TMV', 'TECS', 'FAZ', 'YANG', 'LABD', 'JDST']);

/**
 * 종목의 자산 클래스 자동 분류 — enrich-listings cron 등에서 호출.
 *
 * description은 Finnhub profile2.name 또는 사용자/admin 입력값.
 * 매칭 우선순위: 한국 ETN 종목코드 → 미국 화이트리스트 → 종목명 패턴.
 */
export function classifyAssetClass(symbol: string, description?: string): AssetClass {
  if (!symbol) return 'normal';
  const sym = symbol.toUpperCase().trim();
  const norm = krNormalize(sym); // bare '520100' → '520100.KS'
  const text = description || '';

  // 0) 확정 deny-list — description 없어도 단일종목 레버리지로 확정 (radar 오분류 차단)
  if (LEVERAGE_DENY_SYMBOLS.has(sym) || LEVERAGE_DENY_SYMBOLS.has(norm)) return 'leveraged_single';

  // 1) 한국 ETN 종목코드 (5xxxxx) — 종목명에서 레버리지/인버스 식별
  if (KOREAN_ETN_CODE.test(norm)) {
    if (/인버스|곱버스|-2X/i.test(text)) return 'inverse_single';
    if (/레버리지|2X|단일종목/.test(text)) return 'leveraged_single';
    return 'etn';  // 일반 ETN
  }

  // 2) 미국 단일종목 레버리지/인버스 화이트리스트
  if (LEVERAGED_SINGLE_US.has(sym)) return 'leveraged_single';
  if (INVERSE_SINGLE_US.has(sym)) return 'inverse_single';

  // 3) 미국 지수 레버리지/인버스 화이트리스트
  if (LEVERAGED_INDEX_US.has(sym)) return 'leveraged_index';
  if (INVERSE_INDEX_US.has(sym)) return 'inverse_index';

  // 4) 한국어 종목명 패턴 (단일종목 레버리지 ETF 16종)
  if (/단일종목/.test(text)) {
    if (/인버스|-2X|곱버스/i.test(text)) return 'inverse_single';
    if (/레버리지|2X/i.test(text)) return 'leveraged_single';
  }

  // 5) 일반 레버리지/인버스 명칭 (지수)
  if (/레버리지|3X|LEVERAGED/i.test(text)) return 'leveraged_index';
  if (/인버스|곱버스|INVERSE/i.test(text)) return 'inverse_index';

  // 6) 기본
  return 'normal';
}

/** Universe 자동 승급 허용 자산 클래스 (THRESHOLDS.md #46 4번째 룰) */
const UNIVERSE_ELIGIBLE_CLASSES: ReadonlySet<AssetClass> = new Set([
  'normal', 'etf_index', 'etf_sector', 'etf_dividend', 'reit',
]);

/** universe 4번째 룰 — 시총·상장기간·데이터에 더해 자산 클래스 검증 */
export function isUniverseEligibleClass(cls: AssetClass | null | undefined): boolean {
  if (!cls) return false;
  return UNIVERSE_ELIGIBLE_CLASSES.has(cls);
}
