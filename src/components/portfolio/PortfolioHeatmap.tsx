'use client';

import { useState } from 'react';
import { STOCK_KR } from '@/config/constants';

// --- Squarify Algorithm (Bruls et al. 2000, simplified) ---
interface TreeNode {
  symbol: string;
  value: number;   // tile size (평가금액)
  pnlPct: number;  // total P&L %
  todayPct: number; // today change %
  label: string;    // Korean name
  valFormatted: string; // formatted value string
}

interface Rect { x: number; y: number; w: number; h: number; }
type LayoutNode = TreeNode & Rect;

function worstAspectRatio(row: number[], length: number, totalArea: number): number {
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

  // Normalize values to area
  const area = rect.w * rect.h;
  const scaled = sorted.map(n => ({ ...n, scaledValue: (n.value / total) * area }));

  const result: LayoutNode[] = [];
  let remaining = [...scaled];
  let currentRect = { ...rect };

  while (remaining.length > 0) {
    const isWide = currentRect.w >= currentRect.h;
    const sideLength = isWide ? currentRect.h : currentRect.w;

    // Build row
    const row: typeof scaled = [remaining[0]];
    remaining = remaining.slice(1);

    let rowArea = row[0].scaledValue;
    let prevWorst = worstAspectRatio([row[0].scaledValue], sideLength, area);

    while (remaining.length > 0) {
      const candidate = remaining[0].scaledValue;
      const newWorst = worstAspectRatio([...row.map(r => r.scaledValue), candidate], sideLength, area);
      if (newWorst <= prevWorst) {
        row.push(remaining[0]);
        remaining = remaining.slice(1);
        rowArea += candidate;
        prevWorst = newWorst;
      } else {
        break;
      }
    }

    // Layout row
    const rowLength = rowArea / sideLength;
    let offset = 0;

    for (const item of row) {
      const itemLength = item.scaledValue / rowLength;
      if (isWide) {
        result.push({
          ...item,
          x: currentRect.x,
          y: currentRect.y + offset,
          w: rowLength,
          h: itemLength,
        });
      } else {
        result.push({
          ...item,
          x: currentRect.x + offset,
          y: currentRect.y,
          w: itemLength,
          h: rowLength,
        });
      }
      offset += itemLength;
    }

    // Shrink remaining rect
    if (isWide) {
      currentRect = {
        x: currentRect.x + rowLength,
        y: currentRect.y,
        w: currentRect.w - rowLength,
        h: currentRect.h,
      };
    } else {
      currentRect = {
        x: currentRect.x,
        y: currentRect.y + rowLength,
        w: currentRect.w,
        h: currentRect.h - rowLength,
      };
    }
  }

  return result;
}

// --- Color scale: P&L% → color ---
function pnlColor(pct: number): string {
  if (pct >= 10) return '#D32F2F';
  if (pct >= 5) return '#EF4452';
  if (pct >= 2) return '#F47B7B';
  if (pct > 0) return '#FFAAAA';
  if (pct === 0) return '#B0B8C1';
  if (pct > -2) return '#A3C9FF';
  if (pct > -5) return '#6FA8F5';
  if (pct > -10) return '#3182F6';
  return '#1B64DA';
}

function fmtShort(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

// --- Component ---
interface HeatmapProps {
  stocks: {
    symbol: string;
    avgCost: number;
    shares: number;
    targetReturn: number;
  }[];
  macroData: Record<string, any>;
  usdKrw: number;
  currency: 'KRW' | 'USD';
}

export default function PortfolioHeatmap({ stocks, macroData, usdKrw, currency }: HeatmapProps) {
  const [colorMode, setColorMode] = useState<'pnl' | 'today'>('pnl');

  // Build tree nodes from investing stocks
  const nodes: TreeNode[] = stocks
    .map(stock => {
      const q = macroData[stock.symbol];
      const price = q?.c || 0;
      if (!price || !stock.shares) return null;
      const value = price * stock.shares;
      const pnlPct = stock.avgCost > 0 ? ((price - stock.avgCost) / stock.avgCost) * 100 : 0;
      const todayPct = q?.dp || 0;
      const label = STOCK_KR[stock.symbol] || stock.symbol;
      const valFormatted = currency === 'KRW'
        ? `₩${Math.round(value * usdKrw).toLocaleString()}`
        : fmtShort(value);
      return { symbol: stock.symbol, value, pnlPct, todayPct, label, valFormatted };
    })
    .filter(Boolean) as TreeNode[];

  if (nodes.length === 0) return null;

  const WIDTH = 100; // SVG viewBox percentage
  const HEIGHT = 100; // 정사각형
  const layout = squarify(nodes, { x: 0, y: 0, w: WIDTH, h: HEIGHT });

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Header + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#191F28' }}>내 포트폴리오 맵</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { id: 'pnl' as const, label: '수익률' },
            { id: 'today' as const, label: '오늘' },
          ]).map(opt => (
            <button
              key={opt.id}
              onClick={() => setColorMode(opt.id)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: colorMode === opt.id ? 700 : 500,
                color: colorMode === opt.id ? '#3182F6' : '#8B95A1',
                background: colorMode === opt.id ? 'rgba(49,130,246,0.08)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Treemap */}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', maxWidth: 400, height: 'auto', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', margin: '0 auto', display: 'block' }}
      >
        {layout.map((node, i) => {
          const pct = colorMode === 'pnl' ? node.pnlPct : node.todayPct;
          const color = pnlColor(pct);
          const textColor = Math.abs(pct) >= 2 ? '#FFFFFF' : '#191F28';
          const showDetail = node.w > 15 && node.h > 18;
          const showLabel = node.w > 8 && node.h > 10;

          return (
            <g key={node.symbol}>
              <rect
                x={node.x + 0.3}
                y={node.y + 0.3}
                width={Math.max(node.w - 0.6, 0)}
                height={Math.max(node.h - 0.6, 0)}
                rx={1.5}
                fill={color}
              />
              {showLabel && (
                <>
                  <text
                    x={node.x + node.w / 2}
                    y={node.y + node.h / 2 - (showDetail ? 3 : 0)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={textColor}
                    fontSize={node.w > 20 ? 3.5 : 2.8}
                    fontWeight={700}
                    fontFamily="'Pretendard Variable', sans-serif"
                  >
                    {node.label.length > 6 ? node.symbol : node.label}
                  </text>
                  {showDetail && (
                    <>
                      <text
                        x={node.x + node.w / 2}
                        y={node.y + node.h / 2 + 3}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={textColor}
                        fontSize={2.5}
                        fontWeight={600}
                        fontFamily="'Pretendard Variable', sans-serif"
                        opacity={0.9}
                      >
                        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                      </text>
                      <text
                        x={node.x + node.w / 2}
                        y={node.y + node.h / 2 + 7}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={textColor}
                        fontSize={2}
                        fontWeight={400}
                        fontFamily="'Pretendard Variable', sans-serif"
                        opacity={0.7}
                      >
                        {node.valFormatted}
                      </text>
                    </>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
