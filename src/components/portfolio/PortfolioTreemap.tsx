'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { STOCK_KR } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';
import { getSector } from '@/utils/portfolioHealth';

/**
 * 포트폴리오 트리맵 — 토스/뱅크샐러드 톤 (3인 회의 만장일치).
 *
 * 디자인 원칙 (이전 거부 피드백 반영):
 *   - 라이트 배경 #FAFBFC (다크 #0d0e10 ❌)
 *   - 파스텔 채도 -45% (Finviz -25% ❌)
 *   - 둥근 라디우스 14px (직각 0px ❌)
 *   - 셀 갭 6~8px 숨쉬는 공간 (1~3px tight ❌)
 *   - Pretendard / 토스 톤 (모노스페이스 Bloomberg ❌)
 *   - 어떤 N(3~30)에서도 작동 (Squarify deterministic)
 */

const OTHERS_SYMBOL = '__OTHERS__';
const COMPACT_TOP_N = 8;
const FULL_TOP_N = 16;
const MIN_VISIBLE_WEIGHT = 0.015;
const MIN_OTHERS_LAYOUT_RATIO = 0.04;

// ─── 타입 ────────────────────────────────────────────────────────────────
interface Rect { x: number; y: number; w: number; h: number; }

interface Node {
  symbol: string;
  value: number;            // squarify용
  realValue?: number;       // OTHERS 부스팅
  pnlPct: number;
  todayPct: number;
  label: string;
  valFormatted: string;
  avgCost: number;
  shares: number;
  currentPrice: number;
  profit: number;
  profitFmt: string;
  childrenSymbols?: string[];
  sector: string;
}

interface SectorGroup {
  sector: string;
  value: number;
  nodes: Node[];
}

interface LayoutNode extends Node, Rect {}
interface LayoutSector extends SectorGroup, Rect {
  cellLayout: LayoutNode[];
}

// ─── Squarify (Bruls et al. 2000) — deterministic ───────────────────────
function worstAspectRatio(row: number[], length: number): number {
  if (row.length === 0) return Infinity;
  const s = row.reduce((a, b) => a + b, 0);
  const maxVal = Math.max(...row);
  const minVal = Math.min(...row);
  const s2 = s * s;
  const l2 = length * length;
  return Math.max((l2 * maxVal) / s2, s2 / (l2 * minVal));
}

function squarify<T extends { value: number }>(items: T[], rect: Rect): Array<T & Rect> {
  if (items.length === 0) return [];
  const total = items.reduce((s, n) => s + n.value, 0);
  if (total <= 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const FLOOR = 0.01;
  const adjusted = sorted.map(n => Math.max(n.value, total * FLOOR));
  const adjustedTotal = adjusted.reduce((s, v) => s + v, 0);
  const area = rect.w * rect.h;
  const scaled = sorted.map((n, i) => ({
    ...n,
    scaledValue: (adjusted[i] / adjustedTotal) * area,
  }));

  const result: Array<T & Rect> = [];
  let remaining = [...scaled];
  let currentRect = { ...rect };

  while (remaining.length > 0) {
    if (currentRect.w <= 0.01 || currentRect.h <= 0.01) break;
    const isWide = currentRect.w >= currentRect.h;
    const sideLength = isWide ? currentRect.h : currentRect.w;
    if (sideLength <= 0.01) break;

    const row: typeof scaled = [remaining[0]];
    remaining = remaining.slice(1);
    let rowArea = row[0].scaledValue;
    let prevWorst = worstAspectRatio([row[0].scaledValue], sideLength);

    while (remaining.length > 0) {
      const candidate = remaining[0].scaledValue;
      const newWorst = worstAspectRatio([...row.map(r => r.scaledValue), candidate], sideLength);
      if (newWorst <= prevWorst) {
        row.push(remaining[0]);
        remaining = remaining.slice(1);
        rowArea += candidate;
        prevWorst = newWorst;
      } else break;
    }

    const rowLength = rowArea / sideLength;
    let offset = 0;
    for (const item of row) {
      const itemLength = item.scaledValue / rowLength;
      const cellRect = isWide
        ? { x: currentRect.x, y: currentRect.y + offset, w: rowLength, h: itemLength }
        : { x: currentRect.x + offset, y: currentRect.y, w: itemLength, h: rowLength };
      const { scaledValue: _sv, ...rest } = item;
      void _sv;
      result.push({ ...(rest as unknown as T), ...cellRect });
      offset += itemLength;
    }

    if (isWide) {
      currentRect = { x: currentRect.x + rowLength, y: currentRect.y, w: currentRect.w - rowLength, h: currentRect.h };
    } else {
      currentRect = { x: currentRect.x, y: currentRect.y + rowLength, w: currentRect.w, h: currentRect.h - rowLength };
    }
  }
  return result;
}

// ─── 색 (파스텔 -45%, 토스 톤) ────────────────────────────────────────────
function pastelPnl(pct: number): string {
  if (pct >= 5)    return '#F8AEAE';
  if (pct >= 3)    return '#FABBBB';
  if (pct >= 1.5)  return '#FCCBCB';
  if (pct >= 0.3)  return '#FCDADA';
  if (pct > -0.3)  return '#EAEDF2';   // 보합 — 따뜻한 그레이
  if (pct > -1.5)  return '#D6DEF8';
  if (pct > -3)    return '#C0CBF7';
  if (pct > -5)    return '#A8B8F3';
  return '#92A6EF';
}

function darkenSlight(hex: string): string {
  const m = hex.replace('#', '');
  if (m.length !== 6) return hex;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const f = 0.94;  // 6% darker
  const to2 = (n: number) => Math.round(n * f).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
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

// ─── Component ───────────────────────────────────────────────────────────
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

export default function PortfolioTreemap({
  stocks, macroData, usdKrw, currency,
  variant = 'full', onExpand, onCellClick,
}: HeatmapProps) {
  const [colorMode, setColorMode] = useState<'pnl' | 'today'>('pnl');
  const [hovered, setHovered] = useState<{ node: LayoutNode; x: number; y: number } | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  const isCompact = variant === 'compact';

  useEffect(() => {
    const r = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // 1. Build all nodes
  const allNodes: Node[] = useMemo(() => stocks
    .map(stock => {
      const q = macroData[stock.symbol] as QuoteData | undefined;
      const price = q?.c || 0;
      if (!price || !stock.shares) return null;
      const value = price * stock.shares;
      const pnlPct = stock.avgCost > 0 ? ((price - stock.avgCost) / stock.avgCost) * 100 : 0;
      const todayPct = q?.dp || 0;
      const label = STOCK_KR[stock.symbol] || stock.symbol;
      const valFormatted = currency === 'KRW'
        ? formatKRW(Math.round(value * usdKrw))
        : fmtShort(value);
      const profit = stock.avgCost > 0 ? (price - stock.avgCost) * stock.shares : 0;
      const profitFmt = currency === 'KRW'
        ? formatKRW(Math.round(Math.abs(profit) * usdKrw))
        : fmtShort(Math.abs(profit));
      return {
        symbol: stock.symbol, value, pnlPct, todayPct, label, valFormatted,
        avgCost: stock.avgCost, shares: stock.shares, currentPrice: price,
        profit, profitFmt,
        sector: getSector(stock.symbol),
      };
    })
    .filter(Boolean) as Node[],
  [stocks, macroData, currency, usdKrw]);

  // 2. Top-N + 임계 처리
  const topN = isCompact ? COMPACT_TOP_N : FULL_TOP_N;
  const visibleNodes: Node[] = useMemo(() => {
    if (allNodes.length === 0) return [];
    const totalRaw = allNodes.reduce((s, n) => s + n.value, 0);
    if (totalRaw <= 0) return [];
    const sorted = [...allNodes].sort((a, b) => b.value - a.value);
    const above = sorted.filter(n => (n.value / totalRaw) >= MIN_VISIBLE_WEIGHT);
    const below = sorted.filter(n => (n.value / totalRaw) < MIN_VISIBLE_WEIGHT);

    let kept: Node[];
    let hidden: Node[];
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

    const keptValue = kept.reduce((s, n) => s + n.value, 0);
    const minLayoutValue = keptValue > 0
      ? keptValue * MIN_OTHERS_LAYOUT_RATIO / (1 - MIN_OTHERS_LAYOUT_RATIO)
      : 0;

    if (hidden.length === 1) {
      const single = hidden[0];
      return [...kept, {
        ...single,
        value: Math.max(single.value, minLayoutValue),
        realValue: single.value,
      }];
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
    const layoutValue = Math.max(restValue, minLayoutValue);

    return [...kept, {
      symbol: OTHERS_SYMBOL,
      value: layoutValue,
      realValue: restValue,
      pnlPct: wPnl, todayPct: wToday,
      label: `소액 ${hidden.length}종`, valFormatted,
      avgCost: 0, shares: hidden.reduce((s, n) => s + n.shares, 0), currentPrice: 0,
      profit: restProfit, profitFmt,
      childrenSymbols: hidden.map(n => n.symbol),
      sector: '기타',
    }];
  }, [allNodes, topN, currency, usdKrw]);

  // 3. 섹터 그룹핑 — 종목 4+ 일 때만, 단일 섹터면 그냥 평면
  const sectorCount = useMemo(() => {
    return new Set(visibleNodes.map(n => n.sector)).size;
  }, [visibleNodes]);
  const useSectors = !isCompact && visibleNodes.length >= 4 && sectorCount >= 2;

  // 4. Layout
  const VB = 100;
  const SECTOR_INSET = 0.6;
  const layout = useMemo(() => {
    if (visibleNodes.length === 0) return { sectors: [] as LayoutSector[], flat: [] as LayoutNode[] };

    if (!useSectors) {
      const flat = squarify(visibleNodes, { x: 0, y: 0, w: VB, h: VB });
      return { sectors: [], flat };
    }

    const bySector = new Map<string, Node[]>();
    for (const n of visibleNodes) {
      const arr = bySector.get(n.sector) || [];
      arr.push(n);
      bySector.set(n.sector, arr);
    }
    const sectorGroups: SectorGroup[] = Array.from(bySector.entries()).map(([sector, nodes]) => ({
      sector, value: nodes.reduce((s, n) => s + n.value, 0), nodes,
    }));

    const sectorLayouts = squarify(sectorGroups, { x: 0, y: 0, w: VB, h: VB });

    const sectors: LayoutSector[] = sectorLayouts.map(s => {
      const innerRect: Rect = {
        x: s.x + SECTOR_INSET,
        y: s.y + SECTOR_INSET,
        w: Math.max(s.w - SECTOR_INSET * 2, 0.5),
        h: Math.max(s.h - SECTOR_INSET * 2, 0.5),
      };
      const cellLayout = squarify(s.nodes, innerRect);
      return { ...s, cellLayout };
    });

    return { sectors, flat: [] as LayoutNode[] };
  }, [visibleNodes, useSectors]);

  // 누적 수익률
  const totalPnlPct = useMemo(() => {
    const totalCost = allNodes.reduce((s, n) => s + n.avgCost * n.shares, 0);
    const totalValue = allNodes.reduce((s, n) => s + n.currentPrice * n.shares, 0);
    if (totalCost <= 0) return 0;
    return ((totalValue - totalCost) / totalCost) * 100;
  }, [allNodes]);

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

  if (allNodes.length === 0) return null;

  const totalVal = allNodes.reduce((s, n) => s + n.value, 0);

  // 컨테이너 — 정사각형 강제
  const containerStyle: React.CSSProperties = isCompact ? {
    width: '100%',
    aspectRatio: '1 / 1',
    maxWidth: 480,
    margin: '0 auto',
  } : {
    aspectRatio: '1 / 1',
    maxWidth: 'min(720px, 100%)',
    margin: '0 auto',
  };

  const handleMouseMove = (node: LayoutNode) => (e: React.MouseEvent) => {
    if (isCompact) return;
    const rect = containerRef.current?.getBoundingClientRect();
    setHovered({ node, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
  };

  return (
    <div ref={containerRef} style={{ marginBottom: isCompact ? 0 : 24, position: 'relative' }}>
      {/* Header */}
      {!isCompact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
            내 포트폴리오 맵
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: 'var(--bg-subtle, #F2F4F6)' }}>
              {(['pnl', 'today'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setColorMode(opt)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 11,
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
                padding: '4px 12px', borderRadius: 8, fontSize: 11,
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
        .solb-tm-cell {
          transition: opacity 0.42s ease,
                      transform 0.42s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .solb-tm-cell.is-pre-mount { opacity: 0; transform: scale(0.96); }
        .solb-tm-cell.is-mounted   { opacity: 1; transform: scale(1); }
        .solb-tm-cell-inner {
          transition: filter 0.18s ease, box-shadow 0.22s ease, transform 0.22s ease;
        }
        .solb-tm-cell-inner:hover {
          filter: brightness(1.04);
          box-shadow: 0 6px 16px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
          transform: scale(1.012);
        }
        .solb-tm-cell-inner:active {
          transform: scale(0.99);
        }
        @media (prefers-reduced-motion: reduce) {
          .solb-tm-cell, .solb-tm-cell-inner {
            transition: none;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Capture container */}
      <div
        ref={captureRef}
        style={{
          background: '#FAFBFC',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 20,
          padding: 6,
          ...containerStyle,
        }}
      >
        {/* Compact 토글 */}
        {isCompact && (
          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 4, zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 1, padding: 1, borderRadius: 6, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)', border: '1px solid rgba(0,0,0,0.04)' }}>
              {(['pnl', 'today'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setColorMode(opt)}
                  style={{
                    padding: '3px 8px', borderRadius: 5, fontSize: 10,
                    fontWeight: 600, lineHeight: 1.2,
                    color: colorMode === opt ? '#191F28' : 'var(--text-tertiary, #8B95A1)',
                    background: colorMode === opt ? '#FFFFFF' : 'transparent',
                    border: 'none', cursor: 'pointer',
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
                  padding: '4px 9px', borderRadius: 5,
                  background: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(0,0,0,0.04)',
                  color: 'var(--text-secondary, #4E5968)',
                  fontSize: 10, fontWeight: 600, lineHeight: 1.2,
                  cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                }}
              >
                확대 →
              </button>
            )}
          </div>
        )}

        {/* 평면 (단일 섹터 또는 compact) */}
        {!useSectors && layout.flat.map((node, i) => (
          <Cell
            key={node.symbol}
            node={node}
            colorMode={colorMode}
            isCompact={isCompact}
            onClick={onCellClick}
            onMouseMove={handleMouseMove(node)}
            onMouseLeave={() => setHovered(null)}
            hasMounted={hasMounted}
            mountIndex={i}
          />
        ))}

        {/* 섹터 그룹 */}
        {useSectors && layout.sectors.map(sector => (
          <div key={sector.sector}
            style={{
              position: 'absolute',
              left: `${sector.x}%`, top: `${sector.y}%`,
              width: `${sector.w}%`, height: `${sector.h}%`,
              padding: 2,  // 섹터 안 갭
              boxSizing: 'border-box',
            }}>
            {sector.cellLayout.map((node, i) => (
              <Cell
                key={node.symbol}
                node={node}
                colorMode={colorMode}
                isCompact={isCompact}
                onClick={onCellClick}
                onMouseMove={handleMouseMove(node)}
                onMouseLeave={() => setHovered(null)}
                relative
                parentRect={sector}
                hasMounted={hasMounted}
                mountIndex={i}
              />
            ))}
          </div>
        ))}

        {/* 호버 툴팁 */}
        {hovered && !isCompact && containerRef.current && (
          <Tooltip
            node={hovered.node}
            x={hovered.x} y={hovered.y}
            totalVal={totalVal}
            containerWidth={containerRef.current.clientWidth}
            containerHeight={containerRef.current.clientHeight}
          />
        )}

        {/* 공유 시 워터마크 */}
        {shareLoading && !isCompact && (
          <div style={{
            position: 'absolute',
            left: 14, bottom: 12,
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'var(--text-secondary, #4E5968)',
            fontSize: 11, fontWeight: 700,
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
          gap: 8,
        }}>
          <span>크기 = 평가금액 · 색 = {colorMode === 'pnl' ? '누적 수익률' : '오늘 등락률'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5,
            fontVariantNumeric: 'tabular-nums' }}>
            <span>−5%</span>
            <div style={{
              width: 90, height: 6, borderRadius: 3,
              background: 'linear-gradient(to right, #92A6EF 0%, #C0CBF7 25%, #EAEDF2 50%, #FCCBCB 75%, #F8AEAE 100%)',
            }} />
            <span>+5%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub: Cell ───────────────────────────────────────────────────────────
function Cell({
  node, colorMode, isCompact, onClick, onMouseMove, onMouseLeave,
  relative = false, parentRect,
  hasMounted = true, mountIndex = 0,
}: {
  node: LayoutNode;
  colorMode: 'pnl' | 'today';
  isCompact: boolean;
  onClick?: (symbol: string) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  relative?: boolean;
  parentRect?: Rect;
  hasMounted?: boolean;
  mountIndex?: number;
}) {
  const isOthers = node.symbol === OTHERS_SYMBOL;
  const pct = colorMode === 'pnl' ? node.pnlPct : node.todayPct;

  const baseFill = pastelPnl(pct);
  const gradient = `linear-gradient(180deg, ${baseFill} 0%, ${darkenSlight(baseFill)} 100%)`;

  const left = relative && parentRect ? `${((node.x - parentRect.x) / parentRect.w) * 100}%` : `${node.x}%`;
  const top = relative && parentRect ? `${((node.y - parentRect.y) / parentRect.h) * 100}%` : `${node.y}%`;
  const width = relative && parentRect ? `${(node.w / parentRect.w) * 100}%` : `${node.w}%`;
  const height = relative && parentRect ? `${(node.h / parentRect.h) * 100}%` : `${node.h}%`;

  const clickable = !!onClick && !isOthers;
  const tickerLabel = isOthers ? `+${node.childrenSymbols?.length || 0}` : node.symbol;
  const pctLabel = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;

  const stagger = `${Math.min(mountIndex * 30, 350)}ms`;

  return (
    <div
      className={`solb-tm-cell${hasMounted ? ' is-mounted' : ' is-pre-mount'}`}
      style={{
        position: 'absolute',
        left, top, width, height,
        padding: 3,  // 셀 갭
        boxSizing: 'border-box',
        transitionDelay: hasMounted ? stagger : '0ms',
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="solb-tm-cell-inner"
        onClick={clickable ? () => onClick!(node.symbol) : undefined}
        style={{
          width: '100%', height: '100%',
          background: gradient,
          borderRadius: 14,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          cursor: clickable ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          containerType: 'size',
          opacity: isOthers ? 0.92 : 1,
        }}
      >
        <CellLabel ticker={tickerLabel} pct={pctLabel} pctColor={pnlTextColor(pct)} isCompact={isCompact} />
      </div>
    </div>
  );
}

// ─── Sub: Cell label (container queries로 크기별 표시) ─────────────────────
function CellLabel({
  ticker, pct, pctColor, isCompact,
}: {
  ticker: string; pct: string; pctColor: string; isCompact: boolean;
}) {
  const tickerFs = isCompact ? '12px' : '13px';
  const pctFs = isCompact ? '10px' : '11px';

  return (
    <>
      <style>{`
        .solb-tm-ticker {
          font-size: ${tickerFs};
          font-weight: 700;
          font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif;
          letter-spacing: -0.02em;
          line-height: 1.1;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          color: #191F28;
        }
        .solb-tm-pct {
          font-size: ${pctFs};
          font-weight: 600;
          font-feature-settings: "tnum";
          line-height: 1.2;
          margin-top: 2px;
          text-align: center;
          opacity: 0.92;
          white-space: nowrap;
        }
        @container (max-height: 36px) { .solb-tm-pct { display: none; } }
        @container (max-width: 50px)  { .solb-tm-pct { display: none; } }
        @container (max-height: 24px) { .solb-tm-ticker { font-size: 10px; } }
      `}</style>
      <div className="solb-tm-ticker">{ticker}</div>
      <div className="solb-tm-pct" style={{ color: pctColor }}>{pct}</div>
    </>
  );
}

// ─── Sub: Tooltip ────────────────────────────────────────────────────────
function Tooltip({
  node, x, y, totalVal, containerWidth, containerHeight,
}: {
  node: LayoutNode;
  x: number; y: number;
  totalVal: number;
  containerWidth: number;
  containerHeight: number;
}) {
  const isOthers = node.symbol === OTHERS_SYMBOL;
  const top = Math.min(y + 14, containerHeight - 200);
  const left = Math.min(x + 14, containerWidth - 230);

  return (
    <div role="tooltip" style={{
      position: 'absolute', top, left,
      minWidth: 210, padding: '12px 14px',
      borderRadius: 12,
      background: '#FFFFFF',
      border: '1px solid #EFF1F4',
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      color: '#191F28', fontSize: 11,
      pointerEvents: 'none', zIndex: 30,
    }}>
      {isOthers ? (
        <>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            {node.label}
            <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 10, marginLeft: 6 }}>(가중 평균)</span>
          </div>
          <Row label="합산 비중" value={`${(((node.realValue ?? node.value) / totalVal) * 100).toFixed(1)}%`} />
          <Row label="합산 평가" value={node.valFormatted} />
          <Row label="가중 수익률" value={`${node.pnlPct >= 0 ? '+' : ''}${node.pnlPct.toFixed(2)}%`}
               color={node.pnlPct >= 0 ? '#C72C2C' : '#1B5BC9'} bold />
          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 6, marginBottom: 2 }}>포함 종목</div>
          <div style={{
            fontSize: 10, fontFamily: "'SF Mono', monospace", opacity: 0.85,
            lineHeight: 1.5, wordBreak: 'break-all',
          }}>
            {node.childrenSymbols?.join(' · ')}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6,
            display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontFamily: "'SF Mono', monospace" }}>{node.symbol}</span>
            <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 10 }}>{node.label}</span>
          </div>
          <Row label="비중" value={`${((node.value / totalVal) * 100).toFixed(1)}%`} />
          <Row label="평가금액" value={node.valFormatted} />
          <Row label="수익률" value={`${node.pnlPct >= 0 ? '+' : ''}${node.pnlPct.toFixed(2)}%`}
               color={node.pnlPct >= 0 ? '#C72C2C' : '#1B5BC9'} bold />
          <Row label="오늘" value={`${node.todayPct >= 0 ? '+' : ''}${node.todayPct.toFixed(2)}%`}
               color={node.todayPct >= 0 ? '#C72C2C' : '#1B5BC9'} />
        </>
      )}
    </div>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12,
      fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
      fontVariantNumeric: 'tabular-nums', fontSize: 10.5, marginBottom: 2,
    }}>
      <span style={{ opacity: 0.5 }}>{label}</span>
      <span style={{ color: color || undefined, fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}
