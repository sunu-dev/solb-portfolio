// ==========================================
// SEARCH ASSET TAG — 검색 결과 표시 전용 자산 분류
// ==========================================
//
// 목적 (9인 패널 P0, 2026-05-29): 검색 결과에서 보통주·우선주·ETF·혼합을
// 시각적으로 구분해 사용자 인지 갭 해소. 토스가 "삼성전" 검색 시 보통주/우선주/
// ETF를 라벨로 구분해 보여주는 것과 동일한 정보 위계.
//
// ⚠️ 이 분류기는 **표시 전용**이다. 법적·DB 의미가 있는
// leverageGuard.ts의 classifyAssetClass()/AssetClass enum과 의도적으로 분리한다.
// 그쪽은 universe 편입 자격(isUniverseEligibleClass) + DB CHECK constraint에
// 묶여 있어, 검색 UI 편의를 위해 클래스를 추가하면 법적 로직이 오염된다.
//
// 정렬 순서(order): 보통주(0) → ETF(1) → 우선주(2) → 혼합(3).
// 보통주를 최상단에 둬 "삼성전자"가 "삼성전자우"보다 먼저 노출된다.

export interface SearchTag {
  /** 칩에 표시할 짧은 라벨 */
  label: string;
  /** 정렬 가중치 — 낮을수록 상단 */
  order: number;
}

const ETF_BRAND = /KODEX|TIGER|ACE|RISE|PLUS|KBSTAR|KOSEF|ARIRANG|HANARO|\bSOL\b|\bETF\b/i;

/**
 * 검색 결과 1건의 표시용 자산 태그.
 *
 * @param name 정제된 종목명 (거래소 suffix "(KRX)" 등 제거된 표시명)
 * @returns 보통주면 null (칩 없음), 그 외 { label, order }
 */
export function getSearchTag(_symbol: string, name: string): SearchTag | null {
  const text = (name || '').trim();
  if (!text) return null;

  // ETF (혼합형 ETF는 '혼합'으로 세분)
  if (ETF_BRAND.test(text)) {
    if (/채권혼합|혼합/.test(text)) return { label: '혼합', order: 3 };
    return { label: 'ETF', order: 1 };
  }
  if (/채권혼합/.test(text)) return { label: '혼합', order: 3 };

  // 우선주 — 구형('…우') · 신형('…우B') 종결
  if (/우B?$/.test(text)) return { label: '우선주', order: 2 };

  // 보통주 — 칩 없음
  return null;
}

/** 정렬용 가중치만 필요할 때 (보통주 = 0) */
export function searchTagOrder(symbol: string, name: string): number {
  return getSearchTag(symbol, name)?.order ?? 0;
}
