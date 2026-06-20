/**
 * AI 촉 결정론적 폴백 (β안)
 *
 * 목적: 캐시 미스 + AI 호출 *없이* 사용자에게 "기준 추천" 노출.
 * 마운트 시점에 한도 차감/AI quota 소비를 막기 위해 사용.
 *
 * 정책 준수:
 * - "추천", "사세요" 같은 표현 금지 — 객관 수치 인용만.
 * - reason/keyMetric은 EnrichedStockData (Finnhub 객관값) 인용으로만 구성.
 */

import { CHOK_UNIVERSE, sectorLabel } from '@/config/chokUniverse';
import type { EnrichedStockData } from '@/utils/chokDataEnricher';

export interface FallbackPick {
  symbol: string;
  krName: string;
  sector: string;
  reason: string;
  keyMetric: string;
}

interface ScoredCandidate {
  symbol: string;
  krName: string;
  sector: string;
  e: EnrichedStockData | undefined;
  score: number;
  metric: string;
}

/**
 * Score: 객관 수치 기반 (AI 가공 없음)
 *  - 52주 위치 낮을수록 +30 (저점 가까움)
 *  - PER 0~30 사이에서 낮을수록 +30
 *  - 1Y 수익률 양수 + (회복 신호) +20
 *  - 데이터 부족 시 -1 (후순위)
 */
function scoreCandidate(_u: { symbol: string; krName: string; sector: string }, e: EnrichedStockData | undefined): { score: number; metric: string } {
  if (!e?.currentPrice) return { score: -1, metric: '' };
  let score = 0;
  const parts: string[] = [];
  if (e.week52Position != null) {
    score += (1 - e.week52Position / 100) * 30;
    parts.push(`52w ${Math.round(e.week52Position)}% 위치`);
  }
  if (e.peRatio != null && e.peRatio > 0 && e.peRatio < 30) {
    score += (1 - Math.min(1, e.peRatio / 30)) * 30;
    parts.push(`PER ${e.peRatio.toFixed(1)}`);
  }
  if (e.yearReturn != null && e.yearReturn > 0) {
    score += Math.min(1, e.yearReturn / 50) * 20;
  }
  return { score, metric: parts.join(', ') };
}

export function generateFallbackPicks(opts: {
  enriched: EnrichedStockData[];
  excludedSymbols: Set<string>;
}): FallbackPick[] {
  const { enriched, excludedSymbols } = opts;
  const enrichedMap = new Map(enriched.map(e => [e.symbol, e]));

  const scored: ScoredCandidate[] = CHOK_UNIVERSE
    .filter(u => !excludedSymbols.has(u.symbol))
    .map(u => {
      const e = enrichedMap.get(u.symbol);
      const { score, metric } = scoreCandidate(u, e);
      return { symbol: u.symbol, krName: u.krName, sector: u.sector, e, score, metric };
    })
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score);

  // 1차: sector 다양성 강제 (기존 라우트 로직과 동일 원칙)
  const seenSectors = new Set<string>();
  const picks: FallbackPick[] = [];
  for (const x of scored) {
    if (seenSectors.has(x.sector)) continue;
    seenSectors.add(x.sector);
    picks.push({
      symbol: x.symbol,
      krName: x.krName,
      sector: sectorLabel(x.sector),
      reason: x.metric || '객관 수치 기준',
      keyMetric: x.metric || '데이터 부족',
    });
    if (picks.length >= 3) break;
  }

  // 2차: 후보 부족 시 sector 무시하고 score 순으로 채움
  if (picks.length < 3) {
    for (const x of scored) {
      if (picks.find(p => p.symbol === x.symbol)) continue;
      picks.push({
        symbol: x.symbol,
        krName: x.krName,
        sector: sectorLabel(x.sector),
        reason: x.metric || '객관 수치 기준',
        keyMetric: x.metric || '데이터 부족',
      });
      if (picks.length >= 3) break;
    }
  }

  // 3차(빈 상태 원천 차단): enriched(PER·52주위치)가 전혀 없으면 score<0로 scored=0 → picks=0가 되어
  //   "촉이 오는 종목을 찾지 못했어요"가 떴다. enriched 유무와 무관하게 CHOK_UNIVERSE
  //   (이미 §6·레버리지 검증된 관찰 universe)에서 섹터 다양성 우선으로 3개를 보장한다.
  if (picks.length < 3) {
    const pickedSyms = new Set(picks.map(p => p.symbol));
    const usedSectors = new Set(picks.map(p => p.sector));
    const pool = CHOK_UNIVERSE.filter(u => !excludedSymbols.has(u.symbol) && !pickedSyms.has(u.symbol));
    const fillFrom = (preferNewSector: boolean) => {
      for (const u of pool) {
        if (picks.find(p => p.symbol === u.symbol)) continue;
        const lbl = sectorLabel(u.sector);
        if (preferNewSector && usedSectors.has(lbl)) continue;
        usedSectors.add(lbl);
        picks.push({ symbol: u.symbol, krName: u.krName, sector: lbl, reason: '객관 수치 기준', keyMetric: '데이터 부족' });
        if (picks.length >= 3) return;
      }
    };
    fillFrom(true);       // 새 섹터 우선
    if (picks.length < 3) fillFrom(false); // 그래도 부족하면 섹터 무시
  }

  return picks;
}

/**
 * 결정론적 universe slice (G안)
 *
 * 같은 (userKey, date, session, refreshCount)에 대해 같은 결과 반환.
 * 캐시 키에 refreshCount를 포함하면 새로고침마다 자연 무효화 + 다른 슬라이스.
 */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

export function deterministicSlice<T>(items: T[], targetCount: number, seed: string): T[] {
  if (targetCount >= items.length) return items.slice();
  const seedNum = hashStr(seed);
  // Fisher-Yates with seeded LCG (Mulberry32 단순 변형)
  let state = seedNum >>> 0;
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, targetCount);
}
