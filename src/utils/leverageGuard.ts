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
// 정책 (5분야 20인 패널 합의 2026-05-28):
// - universe 영구 배제 (자본시장법 §6 회피)
// - 검색에서 EmptyState 안내, 사용자가 '왜 안 보임?'을 알 수 있게
// - AI 분석·촉·모닝브리프·알림 모두 차단 — 진입점 누수 0
// - 보유 등록은 허용 (사용자 자율권), 단 AI OFF + 종목 페이지에 Amber 띠
//
// 호출점 (누수 0 필수):
// - api/search/route.ts — 검색 결과 filter
// - api/admin/listings/add/route.ts — admin 수동 등록 reject
// - utils/alertsEngine.ts — checkAllAlerts 루프 최상단
// - api/cron/morning-brief/route.ts — 보유종목 enrich 전
// - api/ai-chok/route.ts — universe slice 전 (chokUniverse.ts에 한국 상품 없어 이미 안전, 보강)

/** 확정 deny-list — 정확한 종목코드 확인된 상품
 *
 * ETF 16종 정확한 종목코드는 KRX 공시 확인 후 P1에서 보강 예정.
 * 그 사이엔 hasLeverageKeyword 패턴매칭으로 차단.
 */
const LEVERAGE_DENY_SYMBOLS = new Set<string>([
  '520100.KS',  // 미래에셋 레버리지 삼성전자 단일종목 ETN (2026-05-27 상장)
  '520101.KS',  // 미래에셋 레버리지 SK하이닉스 단일종목 ETN (2026-05-27 상장)
]);

/** 한국 ETN 종목코드 패턴 — 5xxxxx 6자리 (520xxx 시리즈 포함) */
const KOREAN_ETN_CODE = /^5\d{5}\.K[SQ]$/;

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
 * 단일종목 레버리지·인버스 차단 판정
 *
 * @param symbol 종목코드 (예: '520100.KS', 'TQQQ', 'AAPL')
 * @param description 종목명 (Finnhub description 또는 사용자/admin 입력값)
 * @returns true면 universe·검색·분석·알림 등 모든 진입점에서 차단
 */
export function isBlockedLeverage(symbol: string, description?: string): boolean {
  if (!symbol) return false;
  const sym = symbol.toUpperCase().trim();

  // 1) 확정 deny-list
  if (LEVERAGE_DENY_SYMBOLS.has(sym)) return true;

  // 2) 한국 ETN 종목코드 + 종목명에 레버리지 키워드 (가장 안전한 조합)
  if (KOREAN_ETN_CODE.test(sym) && description && hasLeverageKeyword(description)) {
    return true;
  }

  // 3) 종목명 키워드만으로도 차단 (description이 제공되는 모든 경로)
  if (description && hasLeverageKeyword(description)) {
    return true;
  }

  return false;
}

/** 사용자 노출 카피 — 검색 EmptyState, admin reject 사유 등 */
export const LEVERAGE_BLOCK_USER_MESSAGE =
  '단일종목 레버리지·인버스 ETF/ETN은 주비 분석 대상이 아니에요. 일일 N배 추종, 음의 복리, 발행사 신용 위험이 있어 학습용 앱 범위 밖이에요.';

/** 짧은 변형 — 검색 결과 1줄, 종목 카드 띠 등 공간 제약 시 */
export const LEVERAGE_BLOCK_SHORT = '단일종목 레버리지는 주비에서 다루지 않아요';

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

// 미국 단일종목 레버리지/인버스 화이트리스트 (Direxion·GraniteShares 등)
const LEVERAGED_SINGLE_US = new Set(['TSLL', 'NVDU', 'NVDX', 'AAPU', 'MSFU', 'AMZU', 'GGLL', 'METU', 'NFLU']);
const INVERSE_SINGLE_US = new Set(['TSLQ', 'NVDD', 'NVDQ', 'AAPD', 'MSFD', 'AMZD', 'GGLS', 'METD', 'NFLD']);

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
  const text = description || '';

  // 1) 한국 ETN 종목코드 (5xxxxx) — 종목명에서 레버리지/인버스 식별
  if (/^5\d{5}\.K[SQ]$/.test(sym)) {
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
