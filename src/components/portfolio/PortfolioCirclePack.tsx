'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { hierarchy, pack } from 'd3-hierarchy';
import { STOCK_KR } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';
import { getSector } from '@/utils/portfolioHealth';

/**
 * 포트폴리오 Circle Pack — 토스 도넛 다음 세대 (전문가 회의 Option B 결과).
 *
 * 디자인 방향:
 *   - 라이트 배경 (#FAFBFC) + 파스텔 톤
 *   - 섹터 큰 원 안에 종목 작은 원 (D3 hierarchy.pack)
 *   - 도넛 토글 안전판 — 작은 원 비교 어려운 사용자용
 *   - 첫 진입 시 종목 셀이 섹터 원 안으로 fly-in 모션
 *
 * 색 의미:
 *   - 종목 원 fill = 손익률 (한국 핀테크 컨벤션 빨/파, 채도 -45% 파스텔)
 *   - 종목 원 stroke = 섹터 색 (8 파스텔 팔레트)
 *   - 섹터 컨테이너 = 옅은 회색 fill + 0.5px 테두리
 */

const OTHERS_SYMBOL = '__OTHERS__';
const COMPACT_TOP_N = 8;
const FULL_TOP_N = 16;
const MIN_VISIBLE_WEIGHT = 0.015;

// ─── 섹터 색 팔레트 (8 파스텔) ─────────────────────────────────────────────
const SECTOR_COLOR: Record<string, string> = {
  'IT':       '#5BA9C7',  // 차분한 시안
  '헬스케어':  '#B8A1D9',  // 라벤더
  '금융':      '#E8A187',  // 피치
  '소비재':    '#C9B391',  // 샌드
  '에너지':    '#D89598',  // 로즈
  '자동차':    '#94BC94',  // 세이지
  '미디어':    '#94B4D9',  // 파우더 블루
  '한국주식':  '#D8C68C',  // 머스타드
  '기타':      '#B0B8C1',  // 뉴트럴 그레이
};

function sectorColor(sector: string): string {
  return SECTOR_COLOR[sector] || SECTOR_COLOR['기타'];
}

// ─── 손익 파스텔 색 (채도 낮은 빨/파) ──────────────────────────────────────
function pastelPnl(pct: number): string {
  if (pct >= 5)    return '#FFB6B6';
  if (pct >= 3)    return '#FFC4C4';
  if (pct >= 1.5)  return '#FFD2D2';
  if (pct >= 0.3)  return '#FFE0E0';
  if (pct > -0.3)  return '#F0F2F5';
  if (pct > -1.5)  return '#E0E5FF';
  if (pct > -3)    return '#D0D9FF';
  if (pct > -5)    return '#BFC9FF';
  return '#A8B5FF';
}

function pnlTextColor(pct: number): string {
  if (pct >= 1.5)  return '#C72C2C';
  if (pct > -1.5)  return '#4E5968';
  return '#1B5BC9';
}

function fmtShort(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

// ─── 데이터 타입 ───────────────────────────────────────────────────────────
interface StockNode {
  type: 'stock';
  symbol: string;
  label: string;
  sector: string;
  value: number;
  realValue?: number;     // OTHERS는 layout != real
  pnlPct: number;
  todayPct: number;
  avgCost: number;
  shares: number;
  currentPrice: number;
  profit: number;
  profitFmt: string;
  valFormatted: string;
  childrenSymbols?: string[];
}

interface SectorNode {
  type: 'sector';
  sector: string;
  children: StockNode[];
}

interface HeatmapProps {
  stocks: { symbol: string; avgCost: number; shares: number; targetReturn: number; }[];
  macroData: Record<string, QuoteData | unknown>;
  usdKrw: number;
  currency: 'KRW' | 'USD';
  variant?: 'full' | 'compact';
  onExpand?: () => void;
  onCellClick?: (symbol: string) => void;
  rawCandles?: Record<string, CandleRaw>;
}

export default function PortfolioCirclePack({
  stocks, macroData, usdKrw, currency,
  variant = 'full', onExpand, onCellClick,
}: HeatmapProps) {
  const [colorMode, setColorMode] = useState<'pnl' | 'today'>('pnl');
  const [viewMode, setViewMode] = useState<'pack' | 'donut'>('pack');
  const [hoveredSym, setHoveredSym] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const isCompact = variant === 'compact';

  useEffect(() => {
    const r = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // ─── 1. 종목 노드 빌드 ─────────────────────────────────────────────────
  const allStockNodes: StockNode[] = useMemo(() => stocks.map(stock => {
    const q = macroData[stock.symbol] as QuoteData | undefined;
    const price = q?.c || 0;
    if (!price || !stock.shares) return null;
    const value = price * stock.shares;
    const pnlPct = stock.avgCost > 0 ? ((price - stock.avgCost) / stock.avgCost) * 100 : 0;
    const todayPct = q?.dp || 0;
    const profit = stock.avgCost > 0 ? (price - stock.avgCost) * stock.shares : 0;
    const valFormatted = currency === 'KRW'
      ? formatKRW(Math.round(value * usdKrw))
      : fmtShort(value);
    const profitFmt = currency === 'KRW'
      ? formatKRW(Math.round(Math.abs(profit) * usdKrw))
      : fmtShort(Math.abs(profit));
    return {
      type: 'stock' as const,
      symbol: stock.symbol,
      label: STOCK_KR[stock.symbol] || stock.symbol,
      sector: getSector(stock.symbol),
      value,
      pnlPct, todayPct,
      avgCost: stock.avgCost, shares: stock.shares, currentPrice: price,
      profit, profitFmt, valFormatted,
    };
  }).filter(Boolean) as StockNode[], [stocks, macroData, currency, usdKrw]);

  // ─── 2. Top-N + 임계 처리 ─────────────────────────────────────────────
  const topN = isCompact ? COMPACT_TOP_N : FULL_TOP_N;
  const visibleStocks: StockNode[] = useMemo(() => {
    if (allStockNodes.length === 0) return [];
    const total = allStockNodes.reduce((s, n) => s + n.value, 0);
    if (total <= 0) return [];
    const sorted = [...allStockNodes].sort((a, b) => b.value - a.value);
    const above = sorted.filter(n => (n.value / total) >= MIN_VISIBLE_WEIGHT);
    const below = sorted.filter(n => (n.value / total) < MIN_VISIBLE_WEIGHT);
    let kept: StockNode[];
    let hidden: StockNode[];
    if (above.length > topN - 1 && below.length === 0) {
      kept = above.slice(0, topN - 1);
      hidden = above.slice(topN - 1);
    } else if (above.length > topN - 1) {
      kept = above.slice(0, topN - 1);
      hidden = [...below, ...above.slice(topN - 1)];
    } else {
      kept = above;
      hidden = below;
    }
    if (hidden.length === 0) return kept;
    if (hidden.length === 1) {
      return [...kept, hidden[0]];
    }
    const restValue = hidden.reduce((s, n) => s + n.value, 0);
    if (restValue <= 0) return kept;
    const wPnl = hidden.reduce((s, n) => s + n.pnlPct * n.value, 0) / restValue;
    const wToday = hidden.reduce((s, n) => s + n.todayPct * n.value, 0) / restValue;
    const restProfit = hidden.reduce((s, n) => s + n.profit, 0);
    const valFormatted = currency === 'KRW'
      ? formatKRW(Math.round(restValue * usdKrw))
      : fmtShort(restValue);
    const profitFmt = currency === 'KRW'
      ? formatKRW(Math.round(Math.abs(restProfit) * usdKrw))
      : fmtShort(Math.abs(restProfit));
    return [...kept, {
      type: 'stock' as const,
      symbol: OTHERS_SYMBOL,
      label: `기타 ${hidden.length}개`,
      sector: '기타',
      value: restValue,
      realValue: restValue,
      pnlPct: wPnl, todayPct: wToday,
      avgCost: 0, shares: hidden.reduce((s, n) => s + n.shares, 0),
      currentPrice: 0, profit: restProfit, profitFmt, valFormatted,
      childrenSymbols: hidden.map(n => n.symbol),
    }];
  }, [allStockNodes, topN, currency, usdKrw]);

  // ─── 3. 섹터 그룹핑 (D3 hierarchy 입력 형식) ───────────────────────────
  const hierarchyData = useMemo<SectorNode[]>(() => {
    const bySector = new Map<string, StockNode[]>();
    for (const s of visibleStocks) {
      const arr = bySector.get(s.sector) || [];
      arr.push(s);
      bySector.set(s.sector, arr);
    }
    return Array.from(bySector.entries()).map(([sector, children]) => ({
      type: 'sector' as const, sector, children,
    }));
  }, [visibleStocks]);

  // ─── 4. D3 pack 레이아웃 (viewBox 단위) ────────────────────────────────
  const VB = 100;
  const PACK_PADDING = isCompact ? 2 : 3.5;
  const SECTOR_PADDING = isCompact ? 1.5 : 2.5;

  const packed = useMemo(() => {
    if (hierarchyData.length === 0) return null;
    const root = hierarchy<{ children?: SectorNode[] | StockNode[]; type?: string; value?: number }>({
      children: hierarchyData,
    } as never).sum((d: { value?: number }) => d.value || 0);
    const layout = pack<typeof root.data>().size([VB, VB]).padding(PACK_PADDING);
    return layout(root);
  }, [hierarchyData, PACK_PADDING]);

  // ─── 5. 섹터·종목 평면 추출 ────────────────────────────────────────────
  type CircleNode = { x: number; y: number; r: number; data: StockNode | SectorNode };
  const sectorCircles: CircleNode[] = useMemo(() => {
    if (!packed) return [];
    return (packed.children || []).map(c => ({
      x: c.x, y: c.y, r: c.r,
      data: c.data as unknown as SectorNode,
    }));
  }, [packed]);

  const stockCircles: Array<CircleNode & { sectorCx: number; sectorCy: number; mountIndex: number }> = useMemo(() => {
    if (!packed) return [];
    const result: Array<CircleNode & { sectorCx: number; sectorCy: number; mountIndex: number }> = [];
    let idx = 0;
    for (const sector of (packed.children || [])) {
      for (const stock of (sector.children || [])) {
        result.push({
          x: stock.x, y: stock.y, r: stock.r,
          data: stock.data as unknown as StockNode,
          sectorCx: sector.x, sectorCy: sector.y,
          mountIndex: idx++,
        });
      }
    }
    return result;
  }, [packed]);

  // ─── 도넛 (안전판) 데이터 ──────────────────────────────────────────────
  const donutData = useMemo(() => {
    const total = hierarchyData.reduce(
      (s, sec) => s + sec.children.reduce((s2, st) => s2 + st.value, 0), 0,
    );
    if (total <= 0) return null;
    let acc = 0;
    return hierarchyData.map(sec => {
      const value = sec.children.reduce((s, st) => s + st.value, 0);
      const startAngle = (acc / total) * Math.PI * 2;
      acc += value;
      const endAngle = (acc / total) * Math.PI * 2;
      const pctReturn = (() => {
        const totCost = sec.children.reduce((s, st) => s + st.avgCost * st.shares, 0);
        const totValue = sec.children.reduce((s, st) => s + st.currentPrice * st.shares, 0);
        if (totCost <= 0) return 0;
        return ((totValue - totCost) / totCost) * 100;
      })();
      return {
        sector: sec.sector,
        value,
        pct: (value / total) * 100,
        startAngle, endAngle,
        pctReturn,
        stockCount: sec.children.length,
      };
    });
  }, [hierarchyData]);

  // ─── 누적 수익률 (워터마크용) ──────────────────────────────────────────
  const totalPnlPct = useMemo(() => {
    const totalCost = allStockNodes.reduce((s, n) => s + n.avgCost * n.shares, 0);
    const totalValue = allStockNodes.reduce((s, n) => s + n.currentPrice * n.shares, 0);
    if (totalCost <= 0) return 0;
    return ((totalValue - totalCost) / totalCost) * 100;
  }, [allStockNodes]);

  // ─── 공유 스냅샷 ───────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!captureRef.current || shareLoading) return;
    setShareLoading(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true, pixelRatio: 2, backgroundColor: '#FAFBFC',
      });
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `solb-portfolio-${dateStr}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      const navAny = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'SOLB 포트폴리오 맵', text: '내 포트폴리오를 공유해요' });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl; a.download = fileName;
        document.body.appendChild(a); a.click(); a.remove();
      }
    } catch (e) {
      console.error('share failed', e);
    } finally {
      setShareLoading(false);
    }
  }, [shareLoading]);

  if (allStockNodes.length === 0) return null;

  // ─── 컨테이너 크기 ─────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = isCompact ? {
    width: '100%',
    height: 'clamp(220px, 38vw, 440px)',
    margin: 0,
  } : {
    aspectRatio: '1 / 1',
    maxWidth: 'min(700px, 100%)',
    margin: '0 auto',
  };

  const totalVal = allStockNodes.reduce((s, n) => s + n.value, 0);

  return (
    <div style={{ marginBottom: isCompact ? 0 : 24, position: 'relative' }}>
      {/* Header */}
      {!isCompact && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
            내 포트폴리오 맵
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* 색 모드 */}
            <div style={{
              display: 'flex', gap: 2, padding: 2, borderRadius: 6,
              background: 'var(--bg-subtle, #F2F4F6)',
            }}>
              {(['pnl', 'today'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setColorMode(opt)}
                  style={{
                    padding: '4px 10px', borderRadius: 4, fontSize: 11,
                    fontWeight: colorMode === opt ? 700 : 500,
                    color: colorMode === opt ? '#191F28' : 'var(--text-tertiary, #B0B8C1)',
                    background: colorMode === opt ? '#FFFFFF' : 'transparent',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {opt === 'pnl' ? '수익률' : '오늘'}
                </button>
              ))}
            </div>
            {/* 뷰 모드 — Pack vs Donut */}
            <div style={{
              display: 'flex', gap: 2, padding: 2, borderRadius: 6,
              background: 'var(--bg-subtle, #F2F4F6)',
            }}>
              {(['pack', 'donut'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setViewMode(opt)}
                  title={opt === 'pack' ? '거품 뷰' : '도넛 뷰 (안전판)'}
                  style={{
                    padding: '4px 10px', borderRadius: 4, fontSize: 11,
                    fontWeight: viewMode === opt ? 700 : 500,
                    color: viewMode === opt ? '#191F28' : 'var(--text-tertiary, #B0B8C1)',
                    background: viewMode === opt ? '#FFFFFF' : 'transparent',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {opt === 'pack' ? '거품' : '도넛'}
                </button>
              ))}
            </div>
            <button
              onClick={handleShare}
              disabled={shareLoading}
              title="포트폴리오 맵 이미지 공유"
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11,
                fontWeight: 600,
                color: shareLoading ? 'var(--text-tertiary, #B0B8C1)' : 'var(--text-secondary, #4E5968)',
                background: 'var(--bg-subtle, #F2F4F6)',
                border: 'none',
                cursor: shareLoading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 3,
              }}
            >
              <span style={{ fontSize: 11 }}>↗</span>
              {shareLoading ? '생성 중' : '공유'}
            </button>
          </div>
        </div>
      )}

      {/* 글로벌 스타일 — fly-in, hover, focus dim */}
      <style>{`
        .solb-cp-stock {
          transition: transform 0.55s cubic-bezier(0.2, 0.8, 0.2, 1),
                      opacity 0.4s ease,
                      filter 0.18s ease;
          cursor: pointer;
        }
        .solb-cp-stock.is-pre-mount { opacity: 0; }
        .solb-cp-stock.is-mounted { opacity: 1; }
        .solb-cp-stock:hover { filter: brightness(0.96) saturate(1.1); }
        .solb-cp-root.is-focus-active .solb-cp-stock.is-dimmed { opacity: 0.45; }
        .solb-cp-sector-bg {
          transition: opacity 0.4s ease;
        }
        .solb-cp-sector-bg.is-pre-mount { opacity: 0; }
        .solb-cp-sector-bg.is-mounted { opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          .solb-cp-stock, .solb-cp-sector-bg {
            transition: none;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* Capture container */}
      <div
        ref={captureRef}
        className={`solb-cp-root${hoveredSym ? ' is-focus-active' : ''}`}
        style={{
          background: '#FAFBFC',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
          border: '1px solid #EFF1F4',
          ...containerStyle,
        }}
      >
        {/* Compact 토글 */}
        {isCompact && (
          <div style={{
            position: 'absolute',
            top: 8, right: 8,
            display: 'flex', alignItems: 'center', gap: 4,
            zIndex: 10,
          }}>
            <div style={{
              display: 'flex', gap: 1, padding: 1, borderRadius: 4,
              background: 'rgba(0,0,0,0.04)',
              backdropFilter: 'blur(4px)',
            }}>
              {(['pnl', 'today'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setColorMode(opt)}
                  style={{
                    padding: '2px 7px', borderRadius: 3, fontSize: 9,
                    fontWeight: 600, lineHeight: 1.2,
                    color: colorMode === opt ? '#191F28' : 'var(--text-tertiary, #8B95A1)',
                    background: colorMode === opt ? '#FFFFFF' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    fontFamily: '-apple-system, sans-serif',
                  }}
                >
                  {opt === 'pnl' ? '수익률' : '오늘'}
                </button>
              ))}
            </div>
            {onExpand && (
              <button
                onClick={onExpand}
                style={{
                  padding: '3px 7px', borderRadius: 3,
                  background: 'rgba(0,0,0,0.04)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  color: 'var(--text-secondary, #4E5968)',
                  fontSize: 9, fontWeight: 600, lineHeight: 1.2,
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                  fontFamily: '-apple-system, sans-serif',
                }}
              >
                확대 →
              </button>
            )}
          </div>
        )}

        {/* === Pack 뷰 === */}
        {viewMode === 'pack' && packed && (
          <svg
            viewBox={`0 0 ${VB} ${VB}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            {/* 섹터 컨테이너 (원) */}
            {sectorCircles.map(sc => {
              const data = sc.data as SectorNode;
              return (
                <g key={`sector-${data.sector}`}>
                  <circle
                    cx={sc.x} cy={sc.y} r={sc.r}
                    fill="rgba(0,0,0,0.025)"
                    stroke={sectorColor(data.sector)}
                    strokeOpacity={0.18}
                    strokeWidth={0.5}
                    className={`solb-cp-sector-bg${hasMounted ? ' is-mounted' : ' is-pre-mount'}`}
                  />
                  {/* 섹터 라벨 — 원 상단 */}
                  {sc.r > 8 && (
                    <text
                      x={sc.x} y={sc.y - sc.r + 3.2}
                      textAnchor="middle"
                      style={{
                        fontSize: 2.4,
                        fontWeight: 700,
                        fill: sectorColor(data.sector),
                        letterSpacing: 0.1,
                        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                        pointerEvents: 'none',
                      }}
                    >
                      {data.sector.toUpperCase()}
                    </text>
                  )}
                </g>
              );
            })}

            {/* 종목 원 */}
            {stockCircles.map((sc, packIdx) => {
              const stock = sc.data as StockNode;
              const isOthers = stock.symbol === OTHERS_SYMBOL;
              const pct = colorMode === 'pnl' ? stock.pnlPct : stock.todayPct;
              const fill = isOthers ? '#E5E8EB' : pastelPnl(pct);
              const stroke = sectorColor(stock.sector);
              const isDimmed = !!hoveredSym && hoveredSym !== stock.symbol;

              // Stagger 페이드인 — SVG transform 속성은 CSS transition이 안 먹어
              // 그래서 위치는 항상 정확히 두고 opacity만 stagger.
              const stagger = `${Math.min(packIdx * 35, 500)}ms`;

              const labelFs = Math.max(1.6, sc.r * 0.32);
              const showLabel = sc.r > 4.5;
              const showPct = sc.r > 6.5;

              return (
                <g
                  key={`stock-${stock.symbol}-${packIdx}`}
                  className={`solb-cp-stock${hasMounted ? ' is-mounted' : ' is-pre-mount'}${isDimmed ? ' is-dimmed' : ''}`}
                  style={{
                    transitionDelay: hasMounted ? stagger : '0ms',
                  }}
                  onClick={() => !isOthers && onCellClick?.(stock.symbol)}
                  onMouseEnter={() => setHoveredSym(stock.symbol)}
                  onMouseLeave={() => setHoveredSym(null)}
                >
                  <circle
                    cx={sc.x} cy={sc.y} r={sc.r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1}
                    strokeOpacity={0.45}
                  />
                  {showLabel && (
                    <text
                      x={sc.x} y={sc.y + (showPct ? -labelFs * 0.15 : labelFs * 0.35)}
                      textAnchor="middle"
                      style={{
                        fontSize: labelFs,
                        fontWeight: 700,
                        fill: '#191F28',
                        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                        pointerEvents: 'none',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {isOthers ? `+${stock.childrenSymbols?.length || 0}` : stock.symbol}
                    </text>
                  )}
                  {showPct && (
                    <text
                      x={sc.x} y={sc.y + labelFs * 1.35}
                      textAnchor="middle"
                      style={{
                        fontSize: labelFs * 0.72,
                        fontWeight: 600,
                        fill: pnlTextColor(pct),
                        fontFamily: '-apple-system, sans-serif',
                        fontVariantNumeric: 'tabular-nums',
                        pointerEvents: 'none',
                      }}
                    >
                      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* === Donut 안전판 뷰 === */}
        {viewMode === 'donut' && donutData && (
          <DonutView
            sectors={donutData}
            isCompact={isCompact}
          />
        )}

        {/* 호버 툴팁 (Pack 뷰만) */}
        {viewMode === 'pack' && hoveredSym && !isCompact && (() => {
          const sc = stockCircles.find(s => (s.data as StockNode).symbol === hoveredSym);
          if (!sc) return null;
          const stock = sc.data as StockNode;
          const isOthers = stock.symbol === OTHERS_SYMBOL;
          // viewBox 좌표 → 화면 좌표 (대략)
          const left = `${sc.x + (sc.x - sc.sectorCx > 0 ? -42 : 4)}%`;
          const top = `${sc.y + sc.r + 1.5}%`;
          return (
            <div style={{
              position: 'absolute', left, top,
              minWidth: 200,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#FFFFFF',
              border: '1px solid #EFF1F4',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              fontSize: 11, color: '#191F28',
              fontFamily: '-apple-system, sans-serif',
              pointerEvents: 'none', zIndex: 30,
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: "'SF Mono', monospace" }}>
                  {isOthers ? stock.label : stock.symbol}
                </span>
                <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 10 }}>
                  {isOthers ? '(가중 평균)' : stock.label}
                </span>
              </div>
              <Row label="비중" value={`${(((stock.realValue ?? stock.value) / totalVal) * 100).toFixed(1)}%`} />
              <Row label="평가금액" value={stock.valFormatted} />
              <Row label="섹터" value={stock.sector} color={sectorColor(stock.sector)} />
              <Row label="수익률"
                   value={`${stock.pnlPct >= 0 ? '+' : ''}${stock.pnlPct.toFixed(2)}%`}
                   color={stock.pnlPct >= 0 ? '#C72C2C' : '#1B5BC9'} bold />
              <Row label="오늘"
                   value={`${stock.todayPct >= 0 ? '+' : ''}${stock.todayPct.toFixed(2)}%`}
                   color={stock.todayPct >= 0 ? '#C72C2C' : '#1B5BC9'} />
              {isOthers && stock.childrenSymbols && (
                <div style={{ marginTop: 6, fontSize: 10, opacity: 0.65, lineHeight: 1.5, wordBreak: 'break-all' }}>
                  {stock.childrenSymbols.join(' · ')}
                </div>
              )}
            </div>
          );
        })()}

        {/* 공유 시 워터마크 */}
        {shareLoading && !isCompact && (
          <div style={{
            position: 'absolute',
            left: 14, bottom: 12,
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'var(--text-secondary, #4E5968)',
            fontSize: 11, fontWeight: 700,
            fontFamily: '-apple-system, sans-serif',
            pointerEvents: 'none', zIndex: 20,
          }}>
            <span style={{
              padding: '3px 8px', borderRadius: 4,
              background: '#191F28', color: '#FFFFFF',
              fontSize: 10, letterSpacing: 0.5,
            }}>SOLB</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
              {' · 누적 '}
              <span style={{ color: totalPnlPct >= 0 ? '#C72C2C' : '#1B5BC9' }}>
                {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Footer 범례 (full 모드) */}
      {!isCompact && (
        <div style={{
          marginTop: 10, fontSize: 10,
          color: 'var(--text-tertiary, #B0B8C1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, fontFamily: '-apple-system, sans-serif',
        }}>
          <span>크기 = 평가금액 · 색 = {colorMode === 'pnl' ? '누적 수익률' : '오늘 등락률'} · 테두리 = 섹터</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: "'SF Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
            <span>−5%</span>
            <div style={{
              width: 90, height: 6, borderRadius: 3,
              background: 'linear-gradient(to right, #A8B5FF 0%, #BFC9FF 25%, #F0F2F5 50%, #FFD2D2 75%, #FFB6B6 100%)',
            }} />
            <span>+5%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub: 도넛 안전판 뷰 ─────────────────────────────────────────────────
function DonutView({
  sectors, isCompact,
}: {
  sectors: { sector: string; value: number; pct: number; startAngle: number; endAngle: number; pctReturn: number; stockCount: number }[];
  isCompact: boolean;
}) {
  const SIZE = 100;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R_OUTER = isCompact ? 38 : 36;
  const R_INNER = isCompact ? 22 : 22;

  const arcPath = (start: number, end: number) => {
    const sx = CX + R_OUTER * Math.cos(start - Math.PI / 2);
    const sy = CY + R_OUTER * Math.sin(start - Math.PI / 2);
    const ex = CX + R_OUTER * Math.cos(end - Math.PI / 2);
    const ey = CY + R_OUTER * Math.sin(end - Math.PI / 2);
    const sxi = CX + R_INNER * Math.cos(end - Math.PI / 2);
    const syi = CY + R_INNER * Math.sin(end - Math.PI / 2);
    const exi = CX + R_INNER * Math.cos(start - Math.PI / 2);
    const eyi = CY + R_INNER * Math.sin(start - Math.PI / 2);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${sx} ${sy} A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${ex} ${ey} L ${sxi} ${syi} A ${R_INNER} ${R_INNER} 0 ${large} 0 ${exi} ${eyi} Z`;
  };

  // 라벨 위치 — 호 중간
  const labelPos = (start: number, end: number) => {
    const mid = (start + end) / 2;
    const r = (R_OUTER + R_INNER) / 2;
    return {
      x: CX + r * Math.cos(mid - Math.PI / 2),
      y: CY + r * Math.sin(mid - Math.PI / 2),
    };
  };

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block' }}>
      {sectors.map(s => {
        const arcAngle = s.endAngle - s.startAngle;
        if (arcAngle < 0.001) return null;
        const showLabel = s.pct >= 6;
        const lp = labelPos(s.startAngle, s.endAngle);
        return (
          <g key={s.sector}>
            <path
              d={arcPath(s.startAngle, s.endAngle)}
              fill={sectorColor(s.sector)}
              fillOpacity={0.78}
              stroke="#FFFFFF"
              strokeWidth={0.6}
            />
            {showLabel && (
              <>
                <text
                  x={lp.x} y={lp.y - 0.6}
                  textAnchor="middle"
                  style={{
                    fontSize: 2.6, fontWeight: 700,
                    fill: '#191F28',
                    fontFamily: '-apple-system, sans-serif',
                    letterSpacing: 0.1,
                    pointerEvents: 'none',
                  }}
                >
                  {s.sector}
                </text>
                <text
                  x={lp.x} y={lp.y + 2.4}
                  textAnchor="middle"
                  style={{
                    fontSize: 2.2, fontWeight: 600,
                    fill: '#4E5968',
                    fontFamily: '-apple-system, sans-serif',
                    fontVariantNumeric: 'tabular-nums',
                    pointerEvents: 'none',
                  }}
                >
                  {s.pct.toFixed(0)}%
                </text>
              </>
            )}
          </g>
        );
      })}
      {/* 중심 라벨 */}
      <text
        x={CX} y={CY - 1}
        textAnchor="middle"
        style={{
          fontSize: 3, fontWeight: 700,
          fill: 'var(--text-tertiary, #B0B8C1)',
          fontFamily: '-apple-system, sans-serif',
          letterSpacing: 0.2,
        }}
      >
        SECTORS
      </text>
      <text
        x={CX} y={CY + 3.2}
        textAnchor="middle"
        style={{
          fontSize: 3.4, fontWeight: 800,
          fill: '#191F28',
          fontFamily: '-apple-system, sans-serif',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {sectors.length}
      </text>
    </svg>
  );
}

// ─── Sub: Tooltip Row ─────────────────────────────────────────────────────
function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12,
      fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
      fontVariantNumeric: 'tabular-nums', fontSize: 10.5, marginBottom: 1,
    }}>
      <span style={{ opacity: 0.5 }}>{label}</span>
      <span style={{ color: color || undefined, fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}
