'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { STOCK_KR } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';
import { getSector } from '@/utils/portfolioHealth';
import { sectorLabel } from '@/config/chokUniverse';

/**
 * 포트폴리오 마인드맵 — 옵시디언 그래프 뷰 스타일.
 *
 * 디자인 (사용자 피드백 반영):
 *   - Circle Pack 폐기 (촌스러움)
 *   - 마인드맵 = 중심 코어 + 섹터 허브 + 종목 노드 + 곡선 연결
 *   - 도트 그리드 배경 (옵시디언 시그니처)
 *   - "기타" 폐기 — 작은 종목은 그냥 작은 점
 *   - 한국 핀테크 톤다운 파스텔
 */

const SECTOR_COLOR: Record<string, string> = {
  'IT':       '#7BB6CC',
  '헬스케어':  '#B8A1D9',
  '금융':      '#E8A187',
  '소비재':    '#C9B391',
  '에너지':    '#D89598',
  '자동차':    '#94BC94',
  '미디어':    '#94B4D9',
  '한국주식':  '#D8C68C',
  '기타':      '#B0B8C1',
};

function sectorColorOf(sector: string): string {
  return SECTOR_COLOR[sector] || SECTOR_COLOR['기타'];
}

function pastelPnl(pct: number): string {
  if (pct >= 5)    return '#FFA8A8';
  if (pct >= 3)    return '#FFB8B8';
  if (pct >= 1.5)  return '#FFC8C8';
  if (pct >= 0.3)  return '#FFD8D8';
  if (pct > -0.3)  return '#E8EBF0';
  if (pct > -1.5)  return '#D5DDFF';
  if (pct > -3)    return '#C5D0FF';
  if (pct > -5)    return '#B5C5FF';
  return '#A0B5FF';
}

function fmtShort(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

interface StockNode {
  symbol: string;
  label: string;
  sector: string;
  value: number;        // 평가금액
  weight: number;       // 0~1
  pnlPct: number;
  todayPct: number;
  avgCost: number;
  shares: number;
  currentPrice: number;
  profit: number;
  profitFmt: string;
  valFormatted: string;
  // 레이아웃 결과
  x: number;
  y: number;
  r: number;
}

interface SectorHub {
  sector: string;
  x: number;
  y: number;
  baseAngle: number;    // 중심에서 본 방향
  totalValue: number;
  weightShare: number;  // 0~1
  stocks: StockNode[];
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

export default function PortfolioMindmap({
  stocks, macroData, usdKrw, currency,
  variant = 'full', onExpand, onCellClick,
}: HeatmapProps) {
  const [colorMode, setColorMode] = useState<'pnl' | 'today'>('pnl');
  const [hoveredSym, setHoveredSym] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const isCompact = variant === 'compact';

  useEffect(() => {
    const r = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // ─── 1. 종목 빌드 ──────────────────────────────────────────────────────
  const allStocks: Omit<StockNode, 'x' | 'y' | 'r' | 'weight'>[] = useMemo(
    () => stocks.map(stock => {
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
        symbol: stock.symbol,
        label: STOCK_KR[stock.symbol] || stock.symbol,
        sector: getSector(stock.symbol),
        value, pnlPct, todayPct,
        avgCost: stock.avgCost, shares: stock.shares, currentPrice: price,
        profit, profitFmt, valFormatted,
      };
    }).filter(Boolean) as Omit<StockNode, 'x' | 'y' | 'r' | 'weight'>[],
    [stocks, macroData, currency, usdKrw],
  );

  // ─── 2. 레이아웃 계산 (방사형 deterministic) ──────────────────────────
  const VB = 100;
  const CX = 50, CY = 50;
  const HUB_RADIUS = isCompact ? 25 : 26;  // 중심에서 섹터 허브까지

  const layout: { hubs: SectorHub[]; centerLabel: string } = useMemo(() => {
    if (allStocks.length === 0) return { hubs: [], centerLabel: '' };

    const totalValue = allStocks.reduce((s, n) => s + n.value, 0);
    const totalCost = allStocks.reduce((s, n) => s + n.avgCost * n.shares, 0);
    const totalPctReturn = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    // 섹터별 묶기
    const bySector = new Map<string, Omit<StockNode, 'x' | 'y' | 'r' | 'weight'>[]>();
    for (const s of allStocks) {
      const arr = bySector.get(s.sector) || [];
      arr.push(s);
      bySector.set(s.sector, arr);
    }
    // 섹터를 평가금액 큰 순으로 정렬 (큰 섹터가 위쪽 근처)
    const sectorEntries = Array.from(bySector.entries())
      .map(([sector, ss]) => ({
        sector,
        stocks: [...ss].sort((a, b) => b.value - a.value),
        totalValue: ss.reduce((s, n) => s + n.value, 0),
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    const N = sectorEntries.length;

    // 섹터 허브 위치 — 균등 분포 (시작각 -π/2 = 12시)
    const hubs: SectorHub[] = sectorEntries.map((entry, i) => {
      const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
      const hubX = CX + HUB_RADIUS * Math.cos(angle);
      const hubY = CY + HUB_RADIUS * Math.sin(angle);
      const weightShare = totalValue > 0 ? entry.totalValue / totalValue : 0;
      return {
        sector: entry.sector,
        x: hubX, y: hubY,
        baseAngle: angle,
        totalValue: entry.totalValue,
        weightShare,
        stocks: [],
      };
    });

    // 종목 노드 위치 — 자기 섹터 허브 주변에 부채꼴로 배치
    hubs.forEach((hub, hubIdx) => {
      const entry = sectorEntries[hubIdx];
      const stockCount = entry.stocks.length;

      // 인접 섹터까지의 각도 절반을 허용 영역으로
      const wedgeHalf = Math.PI / Math.max(N, 2) * 0.85;

      entry.stocks.forEach((stock, j) => {
        const weight = totalValue > 0 ? stock.value / totalValue : 0;
        // 큰 종목일수록 허브에 가까이 (끌어당김)
        const distFromHub = 7 + (1 - Math.min(weight * 6, 0.95)) * 5;
        // 종목 노드 반지름 (비중에 비례, 안전 범위)
        const r = Math.max(1.6, Math.min(4.2, 1.5 + Math.sqrt(weight) * 14));

        // 부채꼴 안에서 종목 분포
        // 종목 1개면 정중앙(허브 바깥쪽), 여러 개면 wedge 내 분포
        let localAngle: number;
        if (stockCount === 1) {
          localAngle = hub.baseAngle;
        } else {
          // 큰 종목이 가운데, 작은 종목이 가장자리
          // j=0이 가장 큰 종목 (sorted됨)
          const seq = j === 0 ? 0 : (j % 2 === 1 ? Math.ceil(j / 2) : -Math.ceil(j / 2));
          const stepCount = Math.ceil(stockCount / 2);
          const step = stepCount > 0 ? wedgeHalf / stepCount : 0;
          localAngle = hub.baseAngle + seq * step;
        }

        // 허브에서 바깥 방향으로
        const x = hub.x + distFromHub * Math.cos(localAngle);
        const y = hub.y + distFromHub * Math.sin(localAngle);

        hub.stocks.push({
          ...stock,
          weight,
          x, y, r,
        });
      });
    });

    const sign = totalPctReturn >= 0 ? '+' : '';
    return {
      hubs,
      centerLabel: `${sign}${totalPctReturn.toFixed(1)}%`,
    };
  }, [allStocks, HUB_RADIUS]);

  // 누적 수익률 (워터마크용)
  const totalPnlPct = useMemo(() => {
    const totalCost = allStocks.reduce((s, n) => s + n.avgCost * n.shares, 0);
    const totalValue = allStocks.reduce((s, n) => s + n.currentPrice * n.shares, 0);
    if (totalCost <= 0) return 0;
    return ((totalValue - totalCost) / totalCost) * 100;
  }, [allStocks]);

  // 공유
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

  if (allStocks.length === 0) return null;

  // 컨테이너 크기
  const containerStyle: React.CSSProperties = isCompact ? {
    width: '100%',
    height: 'clamp(240px, 42vw, 480px)',
    margin: 0,
  } : {
    aspectRatio: '1 / 1',
    maxWidth: 'min(720px, 100%)',
    margin: '0 auto',
  };

  // 호버 종목 정보
  const hoveredStock = useMemo(() => {
    if (!hoveredSym) return null;
    for (const hub of layout.hubs) {
      const found = hub.stocks.find(s => s.symbol === hoveredSym);
      if (found) return { stock: found, hub };
    }
    return null;
  }, [hoveredSym, layout]);

  // 곡선 path 생성 (sector hub → stock 또는 center → sector hub)
  function curvePath(x1: number, y1: number, x2: number, y2: number, curvature = 0.18): string {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    // 수직 방향으로 약간 휨
    const cx = mx - dy * curvature;
    const cy = my + dx * curvature;
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  }

  return (
    <div style={{ marginBottom: isCompact ? 0 : 24, position: 'relative' }}>
      {/* Header */}
      {!isCompact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
            내 포트폴리오 맵
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 6, background: 'var(--bg-subtle, #F2F4F6)' }}>
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

      {/* 글로벌 스타일 */}
      <style>{`
        .solb-mm-stock {
          transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1),
                      opacity 0.32s ease,
                      filter 0.18s ease;
          cursor: pointer;
          transform-origin: center;
          transform-box: fill-box;
        }
        .solb-mm-stock.is-pre-mount { opacity: 0; }
        .solb-mm-stock.is-mounted { opacity: 1; }
        .solb-mm-stock:hover {
          filter: brightness(1.05);
        }
        .solb-mm-root.is-focus-active .solb-mm-stock.is-dimmed { opacity: 0.32; }
        .solb-mm-root.is-focus-active .solb-mm-line.is-dimmed { opacity: 0.08; }
        .solb-mm-root.is-focus-active .solb-mm-hub.is-dimmed { opacity: 0.5; }
        .solb-mm-line {
          transition: opacity 0.22s ease, stroke 0.22s ease, stroke-width 0.22s ease;
        }
        .solb-mm-line.is-pre-mount { opacity: 0; }
        .solb-mm-line.is-mounted { opacity: 0.32; }
        .solb-mm-hub {
          transition: opacity 0.32s ease, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
          transform-origin: center;
          transform-box: fill-box;
        }
        .solb-mm-hub.is-pre-mount { opacity: 0; }
        .solb-mm-hub.is-mounted { opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          .solb-mm-stock, .solb-mm-line, .solb-mm-hub {
            transition: none; opacity: 1 !important;
          }
        }
      `}</style>

      {/* 캡처 컨테이너 */}
      <div
        ref={captureRef}
        className={`solb-mm-root${hoveredSym ? ' is-focus-active' : ''}`}
        style={{
          background: '#FAFBFC',
          backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.06) 0.8px, transparent 0.8px)`,
          backgroundSize: '14px 14px',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
          border: '1px solid #EFF1F4',
          ...containerStyle,
        }}
      >
        {/* Compact 토글 */}
        {isCompact && (
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4, zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 1, padding: 1, borderRadius: 4, background: 'rgba(0,0,0,0.04)', backdropFilter: 'blur(4px)' }}>
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

        {/* SVG 마인드맵 */}
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* 라인 — 중심 → 섹터 허브 */}
          <g>
            {layout.hubs.map(hub => (
              <path
                key={`line-c-${hub.sector}`}
                d={curvePath(CX, CY, hub.x, hub.y, 0.0)}
                fill="none"
                stroke="rgba(80,90,110,0.32)"
                strokeWidth={0.5}
                className={`solb-mm-line${hasMounted ? ' is-mounted' : ' is-pre-mount'}${hoveredSym ? ' is-dimmed' : ''}`}
                style={{ transitionDelay: hasMounted ? '40ms' : '0ms' }}
              />
            ))}
          </g>

          {/* 라인 — 섹터 허브 → 종목 */}
          <g>
            {layout.hubs.flatMap(hub =>
              hub.stocks.map((stock, j) => {
                const isHovered = hoveredSym === stock.symbol;
                const isDimmed = !!hoveredSym && !isHovered;
                return (
                  <path
                    key={`line-${stock.symbol}-${j}`}
                    d={curvePath(hub.x, hub.y, stock.x, stock.y, 0.18)}
                    fill="none"
                    stroke={isHovered ? sectorColorOf(hub.sector) : 'rgba(80,90,110,0.28)'}
                    strokeWidth={isHovered ? 0.8 : 0.4}
                    className={`solb-mm-line${hasMounted ? ' is-mounted' : ' is-pre-mount'}${isDimmed ? ' is-dimmed' : ''}`}
                    style={{ transitionDelay: hasMounted ? `${100 + j * 20}ms` : '0ms' }}
                  />
                );
              })
            )}
          </g>

          {/* 중심 노드 — 누적 수익률 라벨 */}
          <g>
            <circle cx={CX} cy={CY} r={6.5} fill="#FFFFFF" stroke="rgba(0,0,0,0.08)" strokeWidth={0.4} />
            <text x={CX} y={CY - 0.5} textAnchor="middle" style={{
              fontSize: 2.4, fontWeight: 600,
              fill: 'var(--text-tertiary, #B0B8C1)',
              fontFamily: '-apple-system, sans-serif',
              letterSpacing: 0.1,
            }}>누적</text>
            <text x={CX} y={CY + 2.6} textAnchor="middle" style={{
              fontSize: 3.2, fontWeight: 800,
              fill: totalPnlPct >= 0 ? '#C72C2C' : '#1B5BC9',
              fontFamily: '-apple-system, sans-serif',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {layout.centerLabel}
            </text>
          </g>

          {/* 섹터 허브 */}
          {layout.hubs.map(hub => {
            const isHubDimmed = !!hoveredSym && hoveredStock?.hub.sector !== hub.sector;
            const labelOffsetX = hub.x - CX;
            const labelOffsetY = hub.y - CY;
            const labelDist = 4.5;
            const labelAngleNorm = Math.atan2(labelOffsetY, labelOffsetX);
            const labelX = hub.x + labelDist * Math.cos(labelAngleNorm);
            const labelY = hub.y + labelDist * Math.sin(labelAngleNorm);
            return (
              <g key={`hub-${hub.sector}`}
                className={`solb-mm-hub${hasMounted ? ' is-mounted' : ' is-pre-mount'}${isHubDimmed ? ' is-dimmed' : ''}`}
              >
                <circle
                  cx={hub.x} cy={hub.y} r={3.5}
                  fill="#FFFFFF"
                  stroke={sectorColorOf(hub.sector)}
                  strokeWidth={0.9}
                />
                <circle
                  cx={hub.x} cy={hub.y} r={1.6}
                  fill={sectorColorOf(hub.sector)}
                  fillOpacity={0.85}
                />
                {/* 섹터 라벨 — 허브 바깥쪽 */}
                <text
                  x={labelX} y={labelY + 0.6}
                  textAnchor="middle"
                  style={{
                    fontSize: 2.4, fontWeight: 700,
                    fill: 'var(--text-secondary, #4E5968)',
                    fontFamily: '-apple-system, sans-serif',
                    letterSpacing: 0.1,
                    pointerEvents: 'none',
                  }}
                >
                  {sectorLabel(hub.sector === '한국주식' ? '한국주식' : hub.sector) === hub.sector ? hub.sector : sectorLabel(hub.sector)}
                </text>
              </g>
            );
          })}

          {/* 종목 노드 */}
          {layout.hubs.flatMap(hub =>
            hub.stocks.map((stock, j) => {
              const pct = colorMode === 'pnl' ? stock.pnlPct : stock.todayPct;
              const fill = pastelPnl(pct);
              const stroke = sectorColorOf(hub.sector);
              const isHovered = hoveredSym === stock.symbol;
              const isDimmed = !!hoveredSym && !isHovered;

              const showLabel = stock.r >= 2.6 || isHovered;

              return (
                <g
                  key={`stock-${stock.symbol}`}
                  className={`solb-mm-stock${hasMounted ? ' is-mounted' : ' is-pre-mount'}${isDimmed ? ' is-dimmed' : ''}`}
                  style={{ transitionDelay: hasMounted ? `${200 + j * 25}ms` : '0ms' }}
                  onClick={() => onCellClick?.(stock.symbol)}
                  onMouseEnter={() => setHoveredSym(stock.symbol)}
                  onMouseLeave={() => setHoveredSym(null)}
                  onTouchStart={() => setHoveredSym(stock.symbol)}
                >
                  {/* 호버 외광 */}
                  {isHovered && (
                    <circle cx={stock.x} cy={stock.y} r={stock.r * 1.7}
                      fill={stroke} fillOpacity={0.18}
                    />
                  )}
                  <circle
                    cx={stock.x} cy={stock.y} r={stock.r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isHovered ? 0.75 : 0.55}
                    strokeOpacity={isHovered ? 0.9 : 0.55}
                  />
                  {showLabel && (
                    <text
                      x={stock.x}
                      y={stock.y + stock.r + 1.8}
                      textAnchor="middle"
                      style={{
                        fontSize: Math.max(1.8, stock.r * 0.7),
                        fontWeight: 600,
                        fill: 'var(--text-primary, #191F28)',
                        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                        letterSpacing: '-0.01em',
                        pointerEvents: 'none',
                      }}
                    >
                      {stock.symbol}
                    </text>
                  )}
                </g>
              );
            })
          )}
        </svg>

        {/* 호버 카드 */}
        {hoveredStock && !isCompact && (() => {
          const { stock, hub } = hoveredStock;
          const left = stock.x > 50 ? '4%' : 'auto';
          const right = stock.x > 50 ? 'auto' : '4%';
          return (
            <div style={{
              position: 'absolute', top: 12, left, right,
              minWidth: 200, padding: '12px 14px',
              borderRadius: 10,
              background: '#FFFFFF',
              border: '1px solid #EFF1F4',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              fontSize: 11, color: '#191F28',
              fontFamily: '-apple-system, sans-serif',
              pointerEvents: 'none', zIndex: 30,
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6,
                display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: "'SF Mono', monospace" }}>{stock.symbol}</span>
                <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 10 }}>{stock.label}</span>
              </div>
              <Row label="섹터" value={sectorLabel(hub.sector) === hub.sector ? hub.sector : sectorLabel(hub.sector)} color={sectorColorOf(hub.sector)} />
              <Row label="비중" value={`${(stock.weight * 100).toFixed(1)}%`} />
              <Row label="평가금액" value={stock.valFormatted} />
              <Row label="수익률"
                   value={`${stock.pnlPct >= 0 ? '+' : ''}${stock.pnlPct.toFixed(2)}%`}
                   color={stock.pnlPct >= 0 ? '#C72C2C' : '#1B5BC9'} bold />
              <Row label="오늘"
                   value={`${stock.todayPct >= 0 ? '+' : ''}${stock.todayPct.toFixed(2)}%`}
                   color={stock.todayPct >= 0 ? '#C72C2C' : '#1B5BC9'} />
            </div>
          );
        })()}

        {/* 공유 워터마크 */}
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

      {/* Footer 범례 */}
      {!isCompact && (
        <div style={{
          marginTop: 10, fontSize: 10,
          color: 'var(--text-tertiary, #B0B8C1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, fontFamily: '-apple-system, sans-serif',
        }}>
          <span>크기 = 비중 · 색 = {colorMode === 'pnl' ? '누적 수익률' : '오늘 등락률'} · 테두리 = 섹터 · 가까울수록 비중 큼</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: "'SF Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
            <span>−5%</span>
            <div style={{
              width: 90, height: 6, borderRadius: 3,
              background: 'linear-gradient(to right, #A0B5FF 0%, #C5D0FF 25%, #E8EBF0 50%, #FFC8C8 75%, #FFA8A8 100%)',
            }} />
            <span>+5%</span>
          </div>
        </div>
      )}
    </div>
  );
}

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
