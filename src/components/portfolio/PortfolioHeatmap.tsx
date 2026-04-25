'use client';

import { useState, useMemo, useRef } from 'react';
import { STOCK_KR } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';
import { getSector } from '@/utils/portfolioHealth';
import { computeVolBaseline, computeZScore } from '@/utils/volatility';

/**
 * 포트폴리오 히트맵 — Finviz/NASDAQ 스타일.
 *
 * 핵심 디자인 결정 (전문가 회의 후):
 * 1. HTML overlay 방식 — SVG <text> 안에서는 viewBox가 CSS px을 user units로
 *    해석해 폰트 cap이 작동 안 함. 셀(div)과 라벨(div) 모두 HTML로 → 정확한 px 사이즈.
 * 2. 섹터 그룹핑 (2단 squarify) — Finviz의 본질. IT/헬스/금융 섹터로 1차 분할,
 *    각 섹터 안에서 종목으로 2차 분할. 섹터 갭 3px, 종목 갭 1px.
 * 3. 직각 모서리(0px), 모노스페이스 폐기, 회사명 셀에서 제거.
 * 4. 폰트 고정 크기 (Finviz 14/11/9px 3단), 셀 크기에 따라 표시/숨김만.
 * 5. 색 채도 -25%, 0% 셀은 푸른 회색 (#3a3e4a) — 장시간 응시 피로 최소화.
 */

const OTHERS_SYMBOL = '__OTHERS__';
const COMPACT_TOP_N = 8;
const FULL_TOP_N = 16;
// 비중 < 1.5% 종목은 자동으로 "기타" 묶음 — 글씨 들어갈 만큼은 보장
const MIN_VISIBLE_WEIGHT = 0.015;
// "기타" 셀이 너무 작으면 thin strip 문제. 레이아웃 전용 최소 4% 부스팅
// (툴팁은 실제값 표시 — node.realValue 사용)
const MIN_OTHERS_LAYOUT_RATIO = 0.04;

// ─── Squarify (Bruls et al. 2000) ──────────────────────────────────────────
interface Rect { x: number; y: number; w: number; h: number; }

interface Node {
  symbol: string;
  value: number;            // 레이아웃용 (squarify에 사용)
  realValue?: number;       // 실제 평가금액 (OTHERS 부스팅 시 layout != real)
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
      // strip scaledValue to avoid leaking it
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

// ─── 색 (Finviz 톤다운, 채도 -25%) ────────────────────────────────────────
function pnlColor(pct: number): string {
  if (pct >= 7)    return '#a01818';
  if (pct >= 5)   return '#b62828';
  if (pct >= 3)   return '#c83a3a';
  if (pct >= 1.5) return '#a45050';
  if (pct >= 0.3) return '#7d4044';
  if (pct > -0.3) return '#3a3e4a';
  if (pct > -1.5) return '#3e5572';
  if (pct > -3)   return '#2e63b0';
  if (pct > -5)   return '#1d56b8';
  if (pct > -7)   return '#13449e';
  return '#0c3680';
}

function zScoreColor(z: number): string {
  if (z >= 3)    return '#a01818';
  if (z >= 2.2) return '#b62828';
  if (z >= 1.5) return '#c83a3a';
  if (z >= 0.7) return '#a45050';
  if (z >= 0.2) return '#7d4044';
  if (z > -0.2) return '#3a3e4a';
  if (z > -0.7) return '#3e5572';
  if (z > -1.5) return '#2e63b0';
  if (z > -2.2) return '#1d56b8';
  if (z > -3)   return '#13449e';
  return '#0c3680';
}

function textOn(pct: number): string {
  return Math.abs(pct) >= 1.5 ? '#FFFFFF' : '#D8D8D8';
}

function fmtShort(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

// ─── Component ─────────────────────────────────────────────────────────────
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

export default function PortfolioHeatmap({
  stocks, macroData, usdKrw, currency,
  variant = 'full', onExpand, onCellClick, rawCandles,
}: HeatmapProps) {
  const [colorMode, setColorMode] = useState<'pnl' | 'today'>('pnl');
  const [hovered, setHovered] = useState<{ node: LayoutNode; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isCompact = variant === 'compact';

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

  // 2. 1.5% 임계 + Top-N — 글씨 들어갈 정도 안 되는 종목은 자동 "기타"
  const topN = isCompact ? COMPACT_TOP_N : FULL_TOP_N;
  const visibleNodes: Node[] = useMemo(() => {
    if (allNodes.length === 0) return [];
    const totalRaw = allNodes.reduce((s, n) => s + n.value, 0);
    if (totalRaw <= 0) return [];

    // Step 1: 비중 < 1.5%는 hidden로 분리 (thin strip 방지)
    const sorted = [...allNodes].sort((a, b) => b.value - a.value);
    const aboveThreshold = sorted.filter(n => (n.value / totalRaw) >= MIN_VISIBLE_WEIGHT);
    const belowThreshold = sorted.filter(n => (n.value / totalRaw) < MIN_VISIBLE_WEIGHT);

    // Step 2: 임계 통과한 것 중 Top-N(슬롯 N-1)만, 나머지도 hidden 합류
    let kept: Node[];
    let hidden: Node[];
    if (aboveThreshold.length > topN - 1 && belowThreshold.length === 0) {
      // 모두 임계 이상이지만 Top-N 초과 — 마지막부터 잘라서 "기타"로
      kept = aboveThreshold.slice(0, topN - 1);
      hidden = aboveThreshold.slice(topN - 1);
    } else if (aboveThreshold.length > topN - 1) {
      kept = aboveThreshold.slice(0, topN - 1);
      hidden = [...belowThreshold, ...aboveThreshold.slice(topN - 1)];
    } else {
      kept = aboveThreshold;
      hidden = belowThreshold;
    }

    // Step 3: hidden 처리
    if (hidden.length === 0) return kept;

    // hidden.length === 1: "기타" 묶음 대신 원래 티커 표시 (사용자 요구)
    // 단 셀 면적은 부스팅 (thin strip 방지)
    const keptValue = kept.reduce((s, n) => s + n.value, 0);
    const minLayoutValue = keptValue > 0
      ? keptValue * MIN_OTHERS_LAYOUT_RATIO / (1 - MIN_OTHERS_LAYOUT_RATIO)
      : 0;

    if (hidden.length === 1) {
      const single = hidden[0];
      return [...kept, {
        ...single,
        value: Math.max(single.value, minLayoutValue),  // 레이아웃 부스팅
        realValue: single.value,                          // 툴팁용 실제값
      }];
    }

    // hidden.length ≥ 2: "기타 N개" 묶음 셀
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
      label: `기타 ${hidden.length}개`, valFormatted,
      avgCost: 0, shares: hidden.reduce((s, n) => s + n.shares, 0), currentPrice: 0,
      profit: restProfit, profitFmt,
      childrenSymbols: hidden.map(n => n.symbol),
      sector: '기타',
    }];
  }, [allNodes, topN, currency, usdKrw]);

  // 3. 섹터 그룹핑 — full 모드에서만 (compact는 종목 적어 의미 약함)
  const useSectors = !isCompact && visibleNodes.length >= 4;

  // 4. Layout 계산 (CSS % 기준)
  const VB = 100;
  const layout = useMemo(() => {
    if (visibleNodes.length === 0) return { sectors: [] as LayoutSector[], flat: [] as LayoutNode[] };

    if (!useSectors) {
      // 단일 squarify
      const flat = squarify(visibleNodes, { x: 0, y: 0, w: VB, h: VB });
      return { sectors: [], flat };
    }

    // 2단 squarify: 섹터 → 종목
    const bySector = new Map<string, Node[]>();
    for (const n of visibleNodes) {
      const arr = bySector.get(n.sector) || [];
      arr.push(n);
      bySector.set(n.sector, arr);
    }
    const sectorGroups: SectorGroup[] = Array.from(bySector.entries()).map(([sector, nodes]) => ({
      sector,
      value: nodes.reduce((s, n) => s + n.value, 0),
      nodes,
    }));

    const sectorLayouts = squarify(sectorGroups, { x: 0, y: 0, w: VB, h: VB });
    const SECTOR_GAP = 0.5; // 섹터 박스 안쪽 inset (%)
    const SECTOR_HEADER = 2.5; // 섹터 헤더 영역 (%)

    const sectors: LayoutSector[] = sectorLayouts.map(s => {
      const innerRect: Rect = {
        x: s.x + SECTOR_GAP,
        y: s.y + SECTOR_GAP + SECTOR_HEADER,
        w: Math.max(s.w - SECTOR_GAP * 2, 0.5),
        h: Math.max(s.h - SECTOR_GAP * 2 - SECTOR_HEADER, 0.5),
      };
      const cellLayout = squarify(s.nodes, innerRect);
      return { ...s, cellLayout };
    });

    return { sectors, flat: [] as LayoutNode[] };
  }, [visibleNodes, useSectors]);

  if (allNodes.length === 0) return null;

  const totalVal = allNodes.reduce((s, n) => s + n.value, 0);

  // 5. 컨테이너 크기 — compact: 사용자 요구로 30% 축소 (이전: 280/50vw/600 → 현재: 196/35vw/420)
  // 데스크톱 1200×420 (2.86:1), 모바일 360×196 (1.84:1)
  const containerStyle: React.CSSProperties = isCompact ? {
    width: '100%',
    height: 'clamp(196px, 35vw, 420px)',
    margin: 0,
  } : {
    aspectRatio: '1 / 1',
    maxWidth: 'min(700px, 100%)',
    margin: '0 auto',
  };

  // 6. 호버 핸들러
  const handleMouseMove = (node: LayoutNode) => (e: React.MouseEvent) => {
    if (isCompact) return;
    const rect = containerRef.current?.getBoundingClientRect();
    setHovered({ node, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
  };

  return (
    <div ref={containerRef} style={{ marginBottom: isCompact ? 0 : 24, position: 'relative' }}>
      {/* Header */}
      {!isCompact && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
            내 포트폴리오 맵
          </div>
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
        </div>
      )}

      {/* 글로벌 호버 효과 + 폰트 강화 */}
      <style>{`
        .solb-heatmap-cell-inner:hover {
          filter: brightness(1.08) saturate(1.1);
        }
        .solb-heatmap-cell:hover {
          z-index: 2;
        }
        .solb-heatmap-cell-inner > * {
          position: relative;
        }
        .solb-heatmap-cell-inner > div:first-child,
        .solb-heatmap-cell-inner > div:nth-child(2) {
          /* 그라데이션과 inner border는 absolute, 라벨만 z-index 위로 */
          position: absolute;
        }
      `}</style>

      {/* Heatmap container (다크 배경) */}
      <div style={{
        background: '#0d0e10',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 4,
        ...containerStyle,
      }}>
        {/* Compact 모드에서 토글 + 확대 버튼 (상단 absolute) */}
        {isCompact && (
          <div style={{
            position: 'absolute',
            top: 4, right: 4,
            display: 'flex', alignItems: 'center', gap: 4,
            zIndex: 10,
          }}>
            <div style={{
              display: 'flex', gap: 1, padding: 1, borderRadius: 4,
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(6px)',
            }}>
              {(['pnl', 'today'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setColorMode(opt)}
                  style={{
                    padding: '2px 7px', borderRadius: 3, fontSize: 9,
                    fontWeight: 600, lineHeight: 1.2,
                    color: colorMode === opt ? '#0d0e10' : 'rgba(255,255,255,0.65)',
                    background: colorMode === opt ? 'rgba(255,255,255,0.92)' : 'transparent',
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
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: '#FFFFFF', fontSize: 9, fontWeight: 600, lineHeight: 1.2,
                  cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                  fontFamily: '-apple-system, sans-serif',
                }}
              >
                확대 →
              </button>
            )}
          </div>
        )}

        {/* 섹터 그룹 렌더링 (full 모드) */}
        {useSectors && layout.sectors.map(sector => (
          <div key={sector.sector}
            style={{
              position: 'absolute',
              left: `${sector.x}%`, top: `${sector.y}%`,
              width: `${sector.w}%`, height: `${sector.h}%`,
            }}>
            {/* 섹터 헤더 라벨 */}
            <div style={{
              position: 'absolute', top: 0, left: 4, right: 4,
              fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              lineHeight: 1.6, height: 14,
              fontFamily: '-apple-system, sans-serif',
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}>
              {sector.sector}
            </div>
            {/* 섹터 안 종목 셀 */}
            {sector.cellLayout.map(node => (
              <Cell
                key={node.symbol}
                node={node}
                colorMode={colorMode}
                rawCandles={rawCandles}
                isCompact={isCompact}
                onClick={onCellClick}
                onMouseMove={handleMouseMove(node)}
                onMouseLeave={() => setHovered(null)}
                relative
                parentRect={sector}
              />
            ))}
          </div>
        ))}

        {/* 평면 squarify (compact 또는 sectors 미사용) */}
        {!useSectors && layout.flat.map(node => (
          <Cell
            key={node.symbol}
            node={node}
            colorMode={colorMode}
            rawCandles={rawCandles}
            isCompact={isCompact}
            onClick={onCellClick}
            onMouseMove={handleMouseMove(node)}
            onMouseLeave={() => setHovered(null)}
          />
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
      </div>

      {/* Footer 범례 — full 모드 */}
      {!isCompact && (
        <div style={{
          marginTop: 8, fontSize: 10,
          color: 'var(--text-tertiary, #B0B8C1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, fontFamily: '-apple-system, sans-serif',
        }}>
          <span>면적 = 평가금액 · 색 = {colorMode === 'pnl' ? '누적 수익률' : '오늘 등락률'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: "'SF Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
            <span>−7%</span>
            <div style={{
              width: 90, height: 6, borderRadius: 1,
              background: 'linear-gradient(to right, #0c3680 0%, #2e63b0 25%, #3a3e4a 48%, #3a3e4a 52%, #c83a3a 75%, #a01818 100%)',
            }} />
            <span>+7%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub: 셀 (HTML) ─────────────────────────────────────────────────────────
function Cell({
  node, colorMode, rawCandles, isCompact, onClick, onMouseMove, onMouseLeave,
  relative = false, parentRect,
}: {
  node: LayoutNode;
  colorMode: 'pnl' | 'today';
  rawCandles?: Record<string, CandleRaw>;
  isCompact: boolean;
  onClick?: (symbol: string) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  relative?: boolean;
  parentRect?: Rect;
}) {
  const isOthers = node.symbol === OTHERS_SYMBOL;
  const pct = colorMode === 'pnl' ? node.pnlPct : node.todayPct;

  // z-score 색 (오늘 모드 + 캔들 가용 시)
  let bg: string;
  if (colorMode === 'today' && !isOthers && rawCandles?.[node.symbol]) {
    const baseline = computeVolBaseline(rawCandles[node.symbol]);
    const z = computeZScore(node.todayPct, baseline);
    bg = z !== null ? zScoreColor(z) : pnlColor(pct);
  } else {
    bg = pnlColor(pct);
  }

  // 위치 계산 — sector 안의 셀이면 parentRect 기준 상대값으로 변환
  const left = relative && parentRect ? `${((node.x - parentRect.x) / parentRect.w) * 100}%` : `${node.x}%`;
  const top = relative && parentRect ? `${((node.y - parentRect.y) / parentRect.h) * 100}%` : `${node.y}%`;
  const width = relative && parentRect ? `${(node.w / parentRect.w) * 100}%` : `${node.w}%`;
  const height = relative && parentRect ? `${(node.h / parentRect.h) * 100}%` : `${node.h}%`;

  const textColor = textOn(pct);
  const clickable = !!onClick && !isOthers;
  const tickerLabel = isOthers ? `기타 ${node.childrenSymbols?.length || 0}` : node.symbol;
  const pctLabel = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;

  return (
    <div
      onClick={clickable ? () => onClick!(node.symbol) : undefined}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="solb-heatmap-cell"
      style={{
        position: 'absolute',
        left, top, width, height,
        padding: 1,
        boxSizing: 'border-box',
      }}
    >
      <div className="solb-heatmap-cell-inner" style={{
        position: 'relative',
        width: '100%', height: '100%',
        background: bg,
        opacity: isOthers ? 0.88 : 1,
        cursor: clickable ? 'pointer' : 'default',
        color: textColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 4px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        // Container queries로 크기에 따라 라벨 자동 표시/숨김
        containerType: 'size',
        transition: 'filter 0.18s ease, background-color 0.35s ease, opacity 0.25s ease',
      } as React.CSSProperties}>
        {/* 미세한 입체감 그라데이션 — 위 하이라이트 + 아래 섀도우 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 28%, transparent 70%, rgba(0,0,0,0.12) 100%)',
          pointerEvents: 'none',
        }} />
        {/* 셀 안 미세 inner border (깊이) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          pointerEvents: 'none',
        }} />
        <CellLabel
          ticker={tickerLabel}
          pct={pctLabel}
          isCompact={isCompact}
        />
      </div>
    </div>
  );
}

// ─── Sub: 셀 라벨 (container queries로 자동 표시/숨김) ──────────────────────
function CellLabel({
  ticker, pct, isCompact,
}: {
  ticker: string; pct: string; isCompact: boolean;
}) {
  // 티커 폰트는 셀 크기 무관 고정 (사용자 요구).
  // 작은 셀에서는 % 만 숨김, 티커는 그대로. 너무 좁으면 ellipsis로 자연스럽게 잘림.
  const tickerFs = isCompact ? '11px' : '13px';
  const pctFs = isCompact ? '9px' : '11px';

  return (
    <>
      <style>{`
        .heatmap-label-ticker {
          font-size: ${tickerFs};
          font-weight: 700;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
          letter-spacing: -0.01em;
          line-height: 1.1;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .heatmap-label-pct {
          font-size: ${pctFs};
          font-weight: 500;
          font-feature-settings: "tnum";
          line-height: 1.2;
          margin-top: 1px;
          text-align: center;
          opacity: 0.92;
          white-space: nowrap;
          overflow: hidden;
        }
        /* 작은 셀: 티커 폰트 고정, % 만 숨김 (사용자 요구) */
        @container (max-height: 28px) { .heatmap-label-pct { display: none; } }
        @container (max-width: 40px)  { .heatmap-label-pct { display: none; } }
      `}</style>
      <div className="heatmap-label-ticker">{ticker}</div>
      <div className="heatmap-label-pct">{pct}</div>
    </>
  );
}

// ─── Sub: 호버 툴팁 ─────────────────────────────────────────────────────────
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
      minWidth: 210, padding: '10px 12px',
      borderRadius: 6,
      background: '#1A1A1A',
      border: '1px solid #2F2F2F',
      color: '#FFFFFF', fontSize: 11,
      fontFamily: '-apple-system, sans-serif',
      pointerEvents: 'none', zIndex: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      {isOthers ? (
        <>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            {node.label}
            <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 10, marginLeft: 6 }}>(가중 평균)</span>
          </div>
          <Row label="합산 비중" value={`${(((node.realValue ?? node.value) / totalVal) * 100).toFixed(1)}%`} />
          <Row label="합산 평가" value={node.valFormatted} />
          <Row label="가중 수익률" value={`${node.pnlPct >= 0 ? '+' : ''}${node.pnlPct.toFixed(2)}%`}
               color={node.pnlPct >= 0 ? '#FF6B6B' : '#5B8DF1'} bold />
          <Row label="합산 손익"
               value={`${node.profit >= 0 ? '+' : '-'}${node.profitFmt}`}
               color={node.profit >= 0 ? '#FF6B6B' : '#5B8DF1'} />
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
            <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 10 }}>{node.label}</span>
          </div>
          <Row label="비중" value={`${((node.value / totalVal) * 100).toFixed(1)}%`} />
          <Row label="평균단가" value={`$${node.avgCost.toFixed(2)}`} />
          <Row label="현재가" value={`$${node.currentPrice.toFixed(2)}`} />
          <Row label="평가금액" value={node.valFormatted} />
          <Row label="수익률" value={`${node.pnlPct >= 0 ? '+' : ''}${node.pnlPct.toFixed(2)}%`}
               color={node.pnlPct >= 0 ? '#FF6B6B' : '#5B8DF1'} bold />
          <Row label="손익"
               value={`${node.profit >= 0 ? '+' : '-'}${node.profitFmt}`}
               color={node.profit >= 0 ? '#FF6B6B' : '#5B8DF1'} />
          <Row label="오늘" value={`${node.todayPct >= 0 ? '+' : ''}${node.todayPct.toFixed(2)}%`}
               color={node.todayPct >= 0 ? '#FF6B6B' : '#5B8DF1'} />
        </>
      )}
    </div>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12,
      fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
      fontVariantNumeric: 'tabular-nums', fontSize: 10.5, marginBottom: 1,
    }}>
      <span style={{ opacity: 0.5 }}>{label}</span>
      <span style={{ color: color || undefined, fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}
