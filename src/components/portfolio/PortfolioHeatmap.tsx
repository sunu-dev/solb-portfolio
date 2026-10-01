'use client';

import { useId, useRef } from 'react';
import type { buildComposition } from '@/utils/portfolioComposition';
import type { layoutPortfolioHeatmap } from '@/utils/portfolioHeatmapLayout';
import { isKoreanStockSymbol } from '@/utils/stockCurrency';
import styles from './PortfolioTreemap.module.css';

type Mode = 'pnl' | 'today';
type Item = ReturnType<typeof buildComposition>['items'][number] & { sector: string; industry: string };
type Layout = ReturnType<typeof layoutPortfolioHeatmap<Item>>;
type Cell = Item & { x: number; y: number; w: number; h: number };

const PALETTE = ['#f63538', '#bf4045', '#8b444e', '#414554', '#35764f', '#2f9e4f', '#30c85a'];
export function heatmapColor(value: number | null, mode: Mode): string {
  if (value === null || !Number.isFinite(value)) return '#303440';
  const normalized = value / (mode === 'today' ? 1 : 10);
  return PALETTE[normalized <= -3 ? 0 : normalized <= -2 ? 1 : normalized <= -.5 ? 2 : normalized < .5 ? 3 : normalized < 2 ? 4 : normalized < 3 ? 5 : 6];
}
const textUnits = (value: string) => [...value].reduce((width, character) => width + (/[^\x00-\x7F]/.test(character) ? 1.03 : /[MW]/.test(character) ? .94 : /[A-Z]/.test(character) ? .76 : .6), 0);

export function heatmapLabel(cell: Pick<Cell, 'symbol' | 'label' | 'w' | 'h' | 'pnl' | 'today'>, mode: Mode) {
  let name = isKoreanStockSymbol(cell.symbol) ? cell.label : cell.symbol;
  const value = mode === 'today' ? cell.today : cell.pnl;
  const text = value === null ? '미확인' : `${value > 0 ? '+' : ''}${Math.abs(value) >= 100000 ? value.toExponential(1) : value.toFixed(2)}%`;
  const width = Math.max(0, cell.w - 8), height = Math.max(0, cell.h - 6);
  let nameSize = Math.floor(Math.min(56, width * .88 / Math.max(textUnits(name), 1), height * .3));
  if (nameSize < 10 && height >= 20) {
    if (textUnits(name) * 10 <= width) nameSize = 10;
    else if (width >= 42) {
      while (name.length > 2 && textUnits(`${name}…`) * 10 > width * .88) name = name.slice(0, -1);
      name += '…';
      nameSize = 10;
    }
  }
  const returnSize = Math.floor(Math.min(nameSize * .78, width / Math.max(textUnits(text), 1)));
  const nameVisible = nameSize >= 10 && cell.w >= 22 && cell.h >= 20;
  const returnVisible = nameVisible && returnSize >= 9 && height >= nameSize * 1.2 + returnSize * 1.2 + 3;
  return { name, text, nameSize, returnSize, nameVisible, returnVisible };
}

interface Props {
  layout: Layout;
  width: number;
  height: number;
  mode: Mode;
  modeLabel: string;
  selectedSymbol?: string;
  percent: (value: number | null) => string;
  weight: (value: number) => string;
  onSelect: (symbol: string, trigger: SVGGElement) => void;
}

export default function PortfolioHeatmap({ layout, width, height, mode, modeLabel, selectedSymbol, percent, weight, onSelect }: Props) {
  const id = useId().replace(/:/g, '');
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const unknownPattern = `heatmap-unknown-${id}`;
  return <svg className={styles.heatmap} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`업종별 포트폴리오 맵, ${modeLabel}`} data-portfolio-heatmap
    onPointerDown={event => { pointerStart.current = { x: event.clientX, y: event.clientY }; }}
    onPointerCancel={() => { pointerStart.current = null; }}>
    <defs>
      <pattern id={unknownPattern} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2,2L2,-2M0,8L8,0M6,10L10,6" stroke="#9299a8" strokeWidth=".6" opacity=".35" /></pattern>
      {layout.sectors.map((sector, sectorIndex) => <clipPath key={sector.id} id={`sector-${id}-${sectorIndex}`}><rect x={sector.x + 3} y={sector.y} width={Math.max(0, sector.w - 6)} height={sector.headerHeight} /></clipPath>)}
      {layout.sectors.flatMap((sector, sectorIndex) => sector.industries.map((industry, industryIndex) => <clipPath key={industry.id} id={`industry-${id}-${sectorIndex}-${industryIndex}`}><rect x={industry.x + 3} y={industry.y} width={Math.max(0, industry.w - 6)} height={industry.headerHeight} /></clipPath>))}
    </defs>
    <rect width={width} height={height} fill="#272a33" />
    {layout.sectors.map((sector, sectorIndex) => <g key={sector.id}>
      <rect x={sector.x} y={sector.y} width={sector.w} height={sector.h} fill="#272a33" />
      {sector.headerHeight > 0 && <text x={sector.x + 3} y={sector.y + sector.headerHeight - 4} className={styles.sectorLabel} clipPath={`url(#sector-${id}-${sectorIndex})`}>{sector.label}</text>}
      {sector.industries.map((industry, industryIndex) => <g key={industry.id}>
        {industry.headerHeight > 0 && <g aria-hidden="true"><rect x={industry.x + 1} y={industry.y} width={Math.max(0, industry.w - 2)} height={industry.headerHeight} fill="#3b414c" /><text x={industry.x + 3} y={industry.y + industry.headerHeight - 2.5} className={styles.industryLabel} clipPath={`url(#industry-${id}-${sectorIndex}-${industryIndex})`}>{industry.label}</text></g>}
        {industry.cells.map(cell => {
          const value = mode === 'today' ? cell.today : cell.pnl;
          const label = heatmapLabel(cell, mode);
          const centerX = cell.x + cell.w / 2, centerY = cell.y + cell.h / 2;
          const nameY = label.returnVisible ? centerY - label.returnSize * .24 : centerY + label.nameSize * .34;
          return <g key={cell.symbol} className={styles.heatmapCell} data-symbol={cell.symbol} role="button" tabIndex={cell.w >= 12 && cell.h >= 12 ? 0 : -1}
            aria-pressed={selectedSymbol === cell.symbol} aria-label={`${cell.label}, ${modeLabel} ${percent(value)}, 투자 비중 ${weight(cell.weight)}`}
            onClick={event => {
              const start = pointerStart.current; pointerStart.current = null;
              if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
              onSelect(cell.symbol, event.currentTarget);
            }}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) onSelect(cell.symbol, event.currentTarget); } }}>
            <title>{`${cell.label} · ${modeLabel} ${percent(value)} · 비중 ${weight(cell.weight)}`}</title>
            <rect x={cell.x} y={cell.y} width={cell.w} height={cell.h} fill={heatmapColor(value, mode)} className={styles.tileRect} />
            {value === null && <rect x={cell.x} y={cell.y} width={cell.w} height={cell.h} fill={`url(#${unknownPattern})`} pointerEvents="none" />}
            {label.nameVisible && <g data-heatmap-label={cell.symbol} className={styles.tileType} aria-hidden="true">
              <text x={centerX} y={nameY} fontSize={label.nameSize} textAnchor="middle" className={styles.tileName}>{label.name}</text>
              {label.returnVisible && <text x={centerX} y={nameY + label.returnSize * 1.22} fontSize={label.returnSize} textAnchor="middle" className={styles.tileReturn}>{label.text}</text>}
            </g>}
            <rect x={cell.x + Math.min(.8, cell.w / 4)} y={cell.y + Math.min(.8, cell.h / 4)} width={Math.max(0, cell.w - 1.6)} height={Math.max(0, cell.h - 1.6)} fill="none" className={styles.tileSelection} pointerEvents="none" />
          </g>;
        })}
      </g>)}
      <rect x={sector.x + 1} y={sector.y + 1} width={Math.max(0, sector.w - 2)} height={Math.max(0, sector.h - 2)} fill="none" className={styles.sectorBoundary} pointerEvents="none" aria-hidden="true" />
    </g>)}
  </svg>;
}
