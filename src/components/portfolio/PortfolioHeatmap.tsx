'use client';

import { useState, useRef, useMemo } from 'react';
import { STOCK_KR } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';
import { computeVolBaseline, computeZScore } from '@/utils/volatility';

// ─── 상수 ──────────────────────────────────────────────────────────────────
const OTHERS_SYMBOL = '__OTHERS__';
const COMPACT_TOP_N = 6;   // 모바일 4:3 — 6개까지 비례, 나머지는 "기타"
const FULL_TOP_N = 10;     // 분석 탭 1:1 — 10개까지

// ─── Squarify (Bruls et al. 2000) ──────────────────────────────────────────
interface TreeNode {
  symbol: string;
  value: number;        // 평가금액 (USD)
  pnlPct: number;       // 누적 수익률 %
  todayPct: number;     // 오늘 등락률 %
  label: string;        // 한글 회사명
  valFormatted: string; // 표시용 평가금액 (KRW or short USD)
  avgCost: number;
  shares: number;
  currentPrice: number;
  profit: number;       // USD 손익
  profitFmt: string;
  childrenSymbols?: string[]; // OTHERS 노드일 때만: 묶인 종목 심볼 리스트
}

interface Rect { x: number; y: number; w: number; h: number; }
type LayoutNode = TreeNode & Rect;

function worstAspectRatio(row: number[], length: number): number {
  if (row.length === 0) return Infinity;
  const s = row.reduce((a, b) => a + b, 0);
  const maxVal = Math.max(...row);
  const minVal = Math.min(...row);
  const s2 = s * s;
  const l2 = length * length;
  return Math.max((l2 * maxVal) / s2, s2 / (l2 * minVal));
}

function squarify(nodes: TreeNode[], rect: Rect): LayoutNode[] {
  if (nodes.length === 0) return [];
  const total = nodes.reduce((s, n) => s + n.value, 0);
  if (total <= 0) return [];

  const sorted = [...nodes].sort((a, b) => b.value - a.value);

  // 매우 작은 비중(<1%)도 보이도록 최소 1% 바닥 — 0.17% 같은 종목이 사라지지 않게
  // (큰 종목엔 영향 미미, 작은 종목은 1% 최소 보장)
  const FLOOR = 0.01;
  const adjusted = sorted.map(n => Math.max(n.value, total * FLOOR));
  const adjustedTotal = adjusted.reduce((s, v) => s + v, 0);

  const area = rect.w * rect.h;
  const scaled = sorted.map((n, i) => ({
    ...n,
    scaledValue: (adjusted[i] / adjustedTotal) * area,
  }));

  const result: LayoutNode[] = [];
  let remaining = [...scaled];
  let currentRect = { ...rect };

  while (remaining.length > 0) {
    // 자투리 사각형이 0차원이면 종료(나머지 노드 손실 방지 — 이미 최소 비중 적용으로 발생 가능성 낮음)
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
      } else {
        break;
      }
    }

    const rowLength = rowArea / sideLength;
    let offset = 0;
    for (const item of row) {
      const itemLength = item.scaledValue / rowLength;
      if (isWide) {
        result.push({ ...item, x: currentRect.x, y: currentRect.y + offset, w: rowLength, h: itemLength });
      } else {
        result.push({ ...item, x: currentRect.x + offset, y: currentRect.y, w: itemLength, h: rowLength });
      }
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

// ─── 색 스케일 (piecewise, Finviz 스타일) ──────────────────────────────────
// 한국식: 빨강=수익, 파랑=손실. 0 근처는 차콜 회색(다크 배경에서도 보이게 #2D2D2D).
//
// 오늘 모드(zScoreColor): 종목별 변동성 베이스라인 대비 σ 단위로 색 강도 결정
// 누적 모드(pnlColor): 절대 % 기반 piecewise (누적 수익률은 정규분포 가정 약함)

/**
 * z-score 기반 색 — "오늘" 모드 한정.
 * 같은 1% 변동도 안정주(σ=1%)에서는 1σ → 진한 색, 변동주(σ=4%)에서는 0.25σ → 흐린 색.
 */
function zScoreColor(z: number): string {
  if (z >= 3)    return '#B71C1C'; // 극단치 +
  if (z >= 2.2) return '#D32F2F';
  if (z >= 1.5) return '#E84549';
  if (z >= 0.7) return '#C95C5F';
  if (z >= 0.2) return '#7A4347';
  if (z > -0.2) return '#2D2D2D'; // 평소 범위
  if (z > -0.7) return '#3F5777';
  if (z > -1.5) return '#3071C7';
  if (z > -2.2) return '#1B64DA';
  if (z > -3)   return '#1454C4';
  return '#0D47A1'; // 극단치 -
}

function pnlColor(pct: number): string {
  if (pct >= 7)    return '#B71C1C';
  if (pct >= 5)   return '#D32F2F';
  if (pct >= 3)   return '#E84549';
  if (pct >= 1.5) return '#C95C5F';
  if (pct >= 0.3) return '#7A4347';
  if (pct > -0.3) return '#2D2D2D';
  if (pct > -1.5) return '#3F5777';
  if (pct > -3)   return '#3071C7';
  if (pct > -5)   return '#1B64DA';
  if (pct > -7)   return '#1454C4';
  return '#0D47A1';
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
  /** compact: 메인 탭용 가로형(5:2), full: 분석 탭용 정사각 */
  variant?: 'full' | 'compact';
  /** compact일 때 우상단 "확대 →" 버튼 핸들러 */
  onExpand?: () => void;
  /** 셀 클릭 시 분석 패널 열기 */
  onCellClick?: (symbol: string) => void;
  /** "오늘" 모드 z-score 색 매핑용 — 가용 시 종목별 변동성 정규화 */
  rawCandles?: Record<string, CandleRaw>;
}

export default function PortfolioHeatmap({
  stocks, macroData, usdKrw, currency,
  variant = 'full',
  onExpand,
  onCellClick,
  rawCandles,
}: HeatmapProps) {
  const [colorMode, setColorMode] = useState<'pnl' | 'today'>('pnl');
  const [hovered, setHovered] = useState<{ node: TreeNode; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isCompact = variant === 'compact';

  const allNodes: TreeNode[] = useMemo(() => stocks
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
      };
    })
    .filter(Boolean) as TreeNode[],
  [stocks, macroData, currency, usdKrw]);

  // Top-N + "기타" 그룹핑 — 작은 종목이 슬라이버로 사라지지 않게
  const topN = isCompact ? COMPACT_TOP_N : FULL_TOP_N;
  const nodes: TreeNode[] = useMemo(() => {
    if (allNodes.length <= topN) return allNodes;

    const sorted = [...allNodes].sort((a, b) => b.value - a.value);
    const keep = sorted.slice(0, topN - 1); // "기타" 자리 1개 예약
    const rest = sorted.slice(topN - 1);

    if (rest.length <= 1) return sorted; // 남은 게 1개면 그냥 표시

    const restValue = rest.reduce((s, n) => s + n.value, 0);
    const wPnl = rest.reduce((s, n) => s + n.pnlPct * n.value, 0) / (restValue || 1);
    const wToday = rest.reduce((s, n) => s + n.todayPct * n.value, 0) / (restValue || 1);
    const restProfit = rest.reduce((s, n) => s + n.profit, 0);
    const valFormatted = currency === 'KRW'
      ? formatKRW(Math.round(restValue * usdKrw))
      : fmtShort(restValue);
    const profitFmt = currency === 'KRW'
      ? formatKRW(Math.round(Math.abs(restProfit) * usdKrw))
      : fmtShort(Math.abs(restProfit));

    const others: TreeNode = {
      symbol: OTHERS_SYMBOL,
      value: restValue,
      pnlPct: wPnl,
      todayPct: wToday,
      label: `기타 ${rest.length}개`,
      valFormatted,
      avgCost: 0,
      shares: rest.reduce((s, n) => s + n.shares, 0),
      currentPrice: 0,
      profit: restProfit,
      profitFmt,
      childrenSymbols: rest.map(n => n.symbol),
    };
    return [...keep, others];
  }, [allNodes, topN, currency, usdKrw]);

  if (nodes.length === 0) return null;

  const totalVal = nodes.reduce((s, n) => s + n.value, 0);
  const VB_W = 100;
  // compact: 4:3 (모바일에서도 셀이 정사각에 가깝게 수렴)
  // full: 1:1 (분석 탭 풀스크린)
  const VB_H = isCompact ? 75 : 100;
  const layout = squarify(nodes, { x: 0, y: 0, w: VB_W, h: VB_H });

  const handleMouseMove = (node: TreeNode) => (e: React.MouseEvent) => {
    if (isCompact) return;
    const rect = containerRef.current?.getBoundingClientRect();
    setHovered({
      node,
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    });
  };

  return (
    <div ref={containerRef} style={{ marginBottom: isCompact ? 0 : 24, position: 'relative' }}>
      {/* Header — full 모드만 */}
      {!isCompact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
            내 포트폴리오 맵
          </div>
          <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 6, background: 'var(--bg-subtle, #F2F4F6)' }}>
            {([
              { id: 'pnl' as const,   label: '수익률' },
              { id: 'today' as const, label: '오늘' },
            ]).map(opt => (
              <button
                key={opt.id}
                onClick={() => setColorMode(opt.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: colorMode === opt.id ? 700 : 500,
                  color: colorMode === opt.id ? '#191F28' : 'var(--text-tertiary, #B0B8C1)',
                  background: colorMode === opt.id ? '#FFFFFF' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 다크 컨테이너 */}
      <div
        style={{
          background: '#0A0A0A',
          padding: 1,
          borderRadius: isCompact ? 8 : 4,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          style={{
            width: '100%',
            display: 'block',
            aspectRatio: `${VB_W} / ${VB_H}`,
          }}
        >
          {layout.map(node => {
            const isOthers = node.symbol === OTHERS_SYMBOL;
            const pct = colorMode === 'pnl' ? node.pnlPct : node.todayPct;
            // P3 — "오늘" 모드 + rawCandles 가용 시 z-score 색.
            // 누적 모드는 정규분포 가정이 약하므로 piecewise % 유지.
            // OTHERS 노드는 평균 묶음이라 z-score 부적합 → piecewise 사용.
            let color: string;
            if (colorMode === 'today' && !isOthers && rawCandles?.[node.symbol]) {
              const baseline = computeVolBaseline(rawCandles[node.symbol]);
              const z = computeZScore(node.todayPct, baseline);
              color = z !== null ? zScoreColor(z) : pnlColor(pct);
            } else {
              color = pnlColor(pct);
            }
            const textColor = textOn(pct);
            const cellArea = node.w * node.h;
            const minDim = Math.min(node.w, node.h);

            // Progressive disclosure — % 가시성 강화 (4:3에서 셀이 더 정사각이라 임계 완화)
            // ≥12 viewBox: 티커 + % / ≥7: 티커만 / 그 외: 색만
            const showTicker  = minDim >= 7;
            const showPercent = minDim >= 12;
            const showValue   = !isCompact && minDim >= 16 && cellArea >= 260;

            // 면적 기반 폰트 자동 스케일
            const fontMul = isCompact ? 0.30 : 0.24;
            const tickerSize = Math.min(Math.max(minDim * fontMul, 1.8), isCompact ? 6.5 : 7);
            const pctSize    = tickerSize * 0.72;
            const valSize    = tickerSize * 0.55;

            const cx = node.x + node.w / 2;
            const cy = node.y + node.h / 2;

            const yTicker  = showPercent ? cy - tickerSize * 0.55 : cy;
            const yPercent = cy + pctSize * 0.4;
            const yValue   = cy + pctSize * 0.4 + pctSize * 1.05;

            const clickable = !!onCellClick && !isOthers;
            const tickerLabel = isOthers ? '기타' : node.symbol;

            return (
              <g
                key={node.symbol}
                onMouseMove={handleMouseMove(node)}
                onMouseLeave={() => setHovered(null)}
                onClick={clickable ? () => onCellClick!(node.symbol) : undefined}
                style={{ cursor: clickable ? 'pointer' : 'default' }}
              >
                <rect
                  x={node.x + 0.15}
                  y={node.y + 0.15}
                  width={Math.max(node.w - 0.3, 0)}
                  height={Math.max(node.h - 0.3, 0)}
                  rx={0.6}
                  fill={color}
                  // "기타" 셀은 살짝 어둡게 + 점선 느낌 — 별도 셀임을 시각화
                  opacity={isOthers ? 0.78 : 1}
                  stroke={isOthers ? 'rgba(255,255,255,0.18)' : 'none'}
                  strokeWidth={isOthers ? 0.3 : 0}
                  strokeDasharray={isOthers ? '0.8 0.8' : undefined}
                />
                {showTicker && (
                  <text
                    x={cx} y={yTicker}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={textColor}
                    fontSize={tickerSize}
                    fontWeight={700}
                    fontFamily="'SF Mono', 'JetBrains Mono', 'Menlo', monospace"
                    style={{ pointerEvents: 'none', letterSpacing: '-0.02em' }}
                  >
                    {tickerLabel}
                  </text>
                )}
                {showPercent && (
                  <text
                    x={cx} y={yPercent}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={textColor}
                    fontSize={pctSize}
                    fontWeight={600}
                    fontFamily="'SF Mono', 'JetBrains Mono', 'Menlo', monospace"
                    opacity={0.92}
                    style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {isOthers
                      ? `${node.childrenSymbols?.length || 0}개`
                      : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
                  </text>
                )}
                {showValue && !isOthers && (
                  <text
                    x={cx} y={yValue}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={textColor}
                    fontSize={valSize}
                    fontWeight={500}
                    fontFamily="'SF Mono', 'JetBrains Mono', 'Menlo', monospace"
                    opacity={0.62}
                    style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {node.valFormatted}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* 확대 버튼 — compact만 */}
        {isCompact && onExpand && (
          <button
            onClick={onExpand}
            aria-label="포트폴리오 맵 크게 보기"
            style={{
              position: 'absolute',
              top: 6, right: 6,
              padding: '4px 8px',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              fontFamily: '-apple-system, sans-serif',
            }}
          >
            확대 →
          </button>
        )}

        {/* 호버 툴팁 — full만 */}
        {hovered && !isCompact && containerRef.current && (
          <div
            role="tooltip"
            style={{
              position: 'absolute',
              top: Math.min(hovered.y + 14, containerRef.current.clientHeight - 200),
              left: Math.min(hovered.x + 14, containerRef.current.clientWidth - 230),
              minWidth: 210,
              padding: '10px 12px',
              borderRadius: 6,
              background: '#1A1A1A',
              border: '1px solid #2F2F2F',
              color: '#FFFFFF',
              fontSize: 11,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              pointerEvents: 'none',
              zIndex: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            {hovered.node.symbol === OTHERS_SYMBOL ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  {hovered.node.label}
                  <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 10, marginLeft: 6 }}>
                    (가중 평균)
                  </span>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '3px 14px',
                  fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 10.5,
                  marginBottom: 8,
                }}>
                  <span style={{ opacity: 0.5 }}>합산 비중</span>
                  <span style={{ textAlign: 'right' }}>{((hovered.node.value / totalVal) * 100).toFixed(1)}%</span>
                  <span style={{ opacity: 0.5 }}>합산 평가</span>
                  <span style={{ textAlign: 'right' }}>{hovered.node.valFormatted}</span>
                  <span style={{ opacity: 0.5 }}>가중 수익률</span>
                  <span style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    color: hovered.node.pnlPct >= 0 ? '#FF6B6B' : '#5B8DF1',
                  }}>
                    {hovered.node.pnlPct >= 0 ? '+' : ''}{hovered.node.pnlPct.toFixed(2)}%
                  </span>
                  <span style={{ opacity: 0.5 }}>합산 손익</span>
                  <span style={{
                    textAlign: 'right',
                    color: hovered.node.profit >= 0 ? '#FF6B6B' : '#5B8DF1',
                  }}>
                    {hovered.node.profit >= 0 ? '+' : '-'}{hovered.node.profitFmt}
                  </span>
                </div>
                <div style={{ fontSize: 10, opacity: 0.55, marginBottom: 4 }}>포함 종목</div>
                <div style={{
                  fontSize: 10,
                  fontFamily: "'SF Mono', monospace",
                  opacity: 0.85,
                  lineHeight: 1.5,
                  wordBreak: 'break-all',
                }}>
                  {hovered.node.childrenSymbols?.join(' · ')}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: "'SF Mono', monospace" }}>{hovered.node.symbol}</span>
                  <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 10 }}>{hovered.node.label}</span>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '3px 14px',
                  fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 10.5,
                }}>
                  <span style={{ opacity: 0.5 }}>비중</span>
                  <span style={{ textAlign: 'right' }}>{((hovered.node.value / totalVal) * 100).toFixed(1)}%</span>
                  <span style={{ opacity: 0.5 }}>평균단가</span>
                  <span style={{ textAlign: 'right' }}>${hovered.node.avgCost.toFixed(2)}</span>
                  <span style={{ opacity: 0.5 }}>현재가</span>
                  <span style={{ textAlign: 'right' }}>${hovered.node.currentPrice.toFixed(2)}</span>
                  <span style={{ opacity: 0.5 }}>평가금액</span>
                  <span style={{ textAlign: 'right' }}>{hovered.node.valFormatted}</span>
                  <span style={{ opacity: 0.5 }}>수익률</span>
                  <span style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    color: hovered.node.pnlPct >= 0 ? '#FF6B6B' : '#5B8DF1',
                  }}>
                    {hovered.node.pnlPct >= 0 ? '+' : ''}{hovered.node.pnlPct.toFixed(2)}%
                  </span>
                  <span style={{ opacity: 0.5 }}>손익</span>
                  <span style={{
                    textAlign: 'right',
                    color: hovered.node.profit >= 0 ? '#FF6B6B' : '#5B8DF1',
                  }}>
                    {hovered.node.profit >= 0 ? '+' : '-'}{hovered.node.profitFmt}
                  </span>
                  <span style={{ opacity: 0.5 }}>오늘</span>
                  <span style={{
                    textAlign: 'right',
                    color: hovered.node.todayPct >= 0 ? '#FF6B6B' : '#5B8DF1',
                  }}>
                    {hovered.node.todayPct >= 0 ? '+' : ''}{hovered.node.todayPct.toFixed(2)}%
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer — full 모드만 (범례) */}
      {!isCompact && (
        <div style={{
          marginTop: 8,
          fontSize: 10,
          color: 'var(--text-tertiary, #B0B8C1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8,
        }}>
          <span style={{ fontFamily: '-apple-system, sans-serif' }}>
            면적 = 평가금액 · 색 = {colorMode === 'pnl' ? '누적 수익률' : (rawCandles ? '오늘 등락 (변동성 정규화)' : '오늘 등락률')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'SF Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
            <span>−7%</span>
            <div style={{
              width: 90, height: 6, borderRadius: 1,
              background: 'linear-gradient(to right, #0D47A1 0%, #1B64DA 18%, #3071C7 32%, #2D2D2D 48%, #2D2D2D 52%, #C95C5F 68%, #D32F2F 82%, #B71C1C 100%)',
            }} />
            <span>+7%</span>
          </div>
        </div>
      )}
    </div>
  );
}
