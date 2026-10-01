import { CHOK_SECTOR_MAP } from '@/config/chokUniverse';
import { STOCK_KR } from '@/config/constants';
import { classifyAssetClass, type AssetClass } from './leverageGuard';
import { getSector } from './portfolioHealth';
import { getYahooSymbolCandidates } from './stockCurrency';

export interface PortfolioHeatmapGroup {
  sector: string;
  industry: string;
}

// Exact English names from public/stock-catalog.json, 2026-09-18 snapshot
// (Korea Investment & Securities public masters). Keep this compact: the full
// search catalog must not become a dependency of the client-side map.
const VERIFIED_FUND_NAMES: Readonly<Record<string, string>> = {
  TSLL: 'DIREXION DAILY TSLA BULL 2X ETF',
  MUU: 'DIREXION DAILY MU BULL 2X ETF',
  KORU: 'DIREXION DAILY MSCI SOUTH KOREA BULL 3X ETF',
};

// Exact descriptions from the same snapshot's kospi_code.mst records.
// Explicit membership identifies these funds; a brand-like name alone does not.
const VERIFIED_KOREAN_FUND_NAMES: Readonly<Record<string, string>> = {
  '069500.KS': 'KODEX 200',
  '069660.KS': 'KIWOOM 200',
  '102110.KS': 'TIGER 200',
  '114800.KS': 'KODEX 인버스',
  '122630.KS': 'KODEX 레버리지',
  '133690.KS': 'TIGER 미국나스닥100',
  '229200.KS': 'KODEX 코스닥150',
  '252670.KS': 'KODEX 200선물인버스2X',
  '360750.KS': 'TIGER 미국S&P500',
  '379800.KS': 'KODEX 미국S&P500',
  '396500.KS': 'TIGER 반도체TOP10',
  '453850.KS': 'ACE 미국30년국채액티브(H)',
};

function verifiedKoreanFundName(symbol: string): string | undefined {
  return getYahooSymbolCandidates(symbol)
    .map(candidate => VERIFIED_KOREAN_FUND_NAMES[candidate])
    .find(name => name !== undefined);
}

/** Prefer verified fund names, then saved names and known symbol aliases. */
export function getPortfolioHeatmapLabel(symbol: string, fallback: string, savedName?: string): string {
  const fundName = verifiedKoreanFundName(symbol);
  if (fundName) return fundName;
  const storedName = savedName?.trim();
  if (storedName) return storedName;
  return getYahooSymbolCandidates(symbol)
    .map(candidate => STOCK_KR[candidate])
    .find(name => name !== undefined) ?? fallback;
}

const FUND_GROUPS: Partial<Record<AssetClass, string>> = {
  leveraged_single: '단일종목 레버리지',
  leveraged_index: '지수 레버리지',
  inverse_single: '단일종목 인버스',
  inverse_index: '지수 인버스',
  etf_index: '지수 ETF',
  etf_sector: '섹터 ETF',
  etf_dividend: '배당 ETF',
  etn: 'ETN',
};

/** Product type takes precedence over an ETF's underlying company's sector. */
export function getPortfolioHeatmapGroup(symbol: string): PortfolioHeatmapGroup {
  const normalized = symbol.trim().toUpperCase();
  const koreanFundName = verifiedKoreanFundName(normalized);
  const assetClass = classifyAssetClass(normalized, koreanFundName ?? VERIFIED_FUND_NAMES[normalized]);
  if (koreanFundName) {
    // Short KRX names often omit the underlying index. The shared detector
    // defaults such names to "single", so show only the verified product type.
    const industry = assetClass === 'inverse_single' || assetClass === 'inverse_index'
      ? '인버스'
      : assetClass === 'leveraged_single' || assetClass === 'leveraged_index'
        ? '레버리지'
        : 'ETF';
    return { sector: 'ETF·ETN', industry };
  }
  const fundGroup = FUND_GROUPS[assetClass];
  if (fundGroup) return { sector: 'ETF·ETN', industry: fundGroup };

  // Reuse only the catalog's explicit fund tags. Its stock-sector taxonomy is
  // different from portfolioHealth, so it must not override ordinary equities.
  const fundTag = CHOK_SECTOR_MAP[normalized];
  if (fundTag === 'etf' || fundTag === 'bond_etf') {
    return { sector: 'ETF·ETN', industry: fundTag === 'bond_etf' ? '채권 ETF' : 'ETF' };
  }

  const sector = getYahooSymbolCandidates(normalized)
    .map(getSector)
    .find(candidate => candidate !== '기타' && candidate !== '한국주식');
  return { sector: sector ?? '미분류', industry: '' };
}
