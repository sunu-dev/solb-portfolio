import { CHOK_SECTOR_MAP, sectorLabel } from '@/config/chokUniverse';
import type { EnrichedStockData } from '@/utils/chokDataEnricher';

export interface SectorFlowStat {
  sector: string;
  label: string;
  sampleSize: number;
  medianChangePct: number;
  averageChangePct: number;
  advanceRatio: number;
  relativeStrengthPct: number;
}

export interface MarketFlowResult {
  generatedAt: string;
  coverage: { available: number; total: number; ratio: number };
  benchmarks: { spy: number | null; qqq: number | null; soxx: number | null };
  marketTone: 'up' | 'down' | 'mixed' | 'insufficient';
  rotation: {
    detected: boolean;
    confidence: 'low' | 'medium' | 'high';
    spreadPct: number | null;
  };
  sectors: SectorFlowStat[];
  strongest: SectorFlowStat | null;
  weakest: SectorFlowStat | null;
  summary: string;
  evidence: string[];
}

const EXCLUDED_SECTORS = new Set(['etf', 'bond_etf', 'other']);

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function formatSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function withSubjectParticle(label: string): string {
  const last = label.at(-1);
  if (!last) return label;
  const code = last.charCodeAt(0);
  const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;
  const hasFinalConsonant = isHangulSyllable && (code - 0xac00) % 28 !== 0;
  return `${label}${hasFinalConsonant ? '이' : '가'}`;
}

export function analyzeMarketFlow(
  enriched: EnrichedStockData[],
  generatedAt = new Date().toISOString(),
): MarketFlowResult {
  const available = enriched.filter(item => Number.isFinite(item.todayChangePct));
  const quoteMap = new Map(enriched.map(item => [item.symbol, item.todayChangePct]));
  const benchmarks = {
    spy: quoteMap.get('SPY') ?? null,
    qqq: quoteMap.get('QQQ') ?? null,
    soxx: quoteMap.get('SOXX') ?? null,
  };

  const grouped = new Map<string, number[]>();
  for (const item of available) {
    const sector = CHOK_SECTOR_MAP[item.symbol];
    if (!sector || EXCLUDED_SECTORS.has(sector) || item.todayChangePct == null) continue;
    const values = grouped.get(sector) ?? [];
    values.push(item.todayChangePct);
    grouped.set(sector, values);
  }

  const broadValues = Array.from(grouped.values()).flat();
  const broadMedian = broadValues.length ? median(broadValues) : 0;
  const sectors = Array.from(grouped.entries())
    .filter(([, values]) => values.length >= 2)
    .map(([sector, values]): SectorFlowStat => {
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const med = median(values);
      return {
        sector,
        label: sectorLabel(sector),
        sampleSize: values.length,
        medianChangePct: round(med),
        averageChangePct: round(average),
        advanceRatio: round(values.filter(value => value > 0).length / values.length, 2),
        relativeStrengthPct: round(med - broadMedian),
      };
    })
    .sort((a, b) => b.relativeStrengthPct - a.relativeStrengthPct);

  const strongest = sectors[0] ?? null;
  const weakest = sectors.at(-1) ?? null;
  const spread = strongest && weakest
    ? round(strongest.relativeStrengthPct - weakest.relativeStrengthPct)
    : null;
  const breadthConfirmed = !!strongest && !!weakest
    && strongest.advanceRatio >= 0.6
    && weakest.advanceRatio <= 0.4;
  const rotationDetected = spread != null
    && spread >= 1.5
    && strongest!.relativeStrengthPct >= 0.5
    && weakest!.relativeStrengthPct <= -0.5
    && breadthConfirmed;
  const confidence = !rotationDetected
    ? 'low'
    : spread! >= 2.5 && strongest!.sampleSize >= 3 && weakest!.sampleSize >= 3
      ? 'high'
      : 'medium';

  const marketReference = benchmarks.spy ?? (broadValues.length ? broadMedian : null);
  const marketTone: MarketFlowResult['marketTone'] = marketReference == null
    ? 'insufficient'
    : Math.abs(marketReference) < 0.3
      ? 'mixed'
      : marketReference > 0
        ? 'up'
        : 'down';

  let summary = '시장 흐름을 설명할 데이터가 아직 충분하지 않아요.';
  if (strongest && weakest && marketReference != null) {
    const marketText = marketTone === 'up'
      ? '시장 전체는 오른 가운데'
      : marketTone === 'down'
        ? '시장 전체는 내린 가운데'
        : '시장 전체는 방향이 엇갈린 가운데';
    summary = rotationDetected
      ? `${marketText} ${withSubjectParticle(weakest.label)} 상대적으로 약하고 ${withSubjectParticle(strongest.label)} 강해 섹터 간 순환 신호가 나타났어요.`
      : `${marketText} ${strongest.label}와 ${weakest.label} 사이의 상대 강도 차이를 확인할 수 있어요. 아직 뚜렷한 순환으로 단정할 정도는 아니에요.`;
  }

  const evidence: string[] = [];
  if (benchmarks.spy != null) evidence.push(`S&P 500 ${formatSigned(benchmarks.spy)}`);
  if (benchmarks.qqq != null) evidence.push(`나스닥 100 ${formatSigned(benchmarks.qqq)}`);
  if (benchmarks.soxx != null) evidence.push(`반도체 ETF ${formatSigned(benchmarks.soxx)}`);
  if (strongest) evidence.push(`${strongest.label} 중앙값 ${formatSigned(strongest.medianChangePct)} · 상승 종목 ${Math.round(strongest.advanceRatio * 100)}% · ${strongest.sampleSize}종목`);
  if (weakest) evidence.push(`${weakest.label} 중앙값 ${formatSigned(weakest.medianChangePct)} · 상승 종목 ${Math.round(weakest.advanceRatio * 100)}% · ${weakest.sampleSize}종목`);

  return {
    generatedAt,
    coverage: {
      available: available.length,
      total: enriched.length,
      ratio: enriched.length ? round(available.length / enriched.length, 2) : 0,
    },
    benchmarks,
    marketTone,
    rotation: { detected: rotationDetected, confidence, spreadPct: spread },
    sectors,
    strongest,
    weakest,
    summary,
    evidence,
  };
}
