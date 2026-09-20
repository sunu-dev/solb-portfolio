'use client';

import { useId, useMemo, type CSSProperties } from 'react';
import type { buildComposition } from '@/utils/portfolioComposition';
import type { TerrainGeometry } from '@/utils/portfolioTerrainLayout';
import { portfolioTerrainContours } from '@/utils/portfolioTerrainContours';
import styles from './PortfolioTreemap.module.css';

type TerrainCell = ReturnType<typeof buildComposition>['items'][number] & TerrainGeometry;
export type TerrainColor = CSSProperties & Record<'--parcel-fill' | '--parcel-ink', string>;

const characterWidth = (text: string) => [...text].reduce((sum, char) => sum + (/[^\x00-\x7F]/.test(char) ? 1 : .64), 0);

/** The entire text rectangle fits inside an inscribed disc, not merely a bounding box. */
export function terrainLabel(cell: TerrainCell) {
  const room = cell.labelAnchor.radius * 1.35;
  const fullName = /\.(KS|KQ)$/.test(cell.symbol) ? cell.label : cell.symbol;
  const name = fullName || cell.symbol;
  const nameSize = Math.min(21, Math.max(12, room * .13));
  const amount = cell.weight.toFixed(1);
  const numberSize = Math.min(112, (room - 4) / (amount.length * .64 + .4), room * .48);
  const gap = Math.max(6, Math.min(11, room * .06));
  const textHeight = nameSize * 1.2 + gap + numberSize * 1.15;
  const visible = room >= 36 && numberSize >= 12 && textHeight <= room;
  const nameOffset = -textHeight / 2 + nameSize * .9;
  const numberOffset = textHeight / 2 - numberSize * .2;
  let shortName = name;
  while (shortName.length > 1 && characterWidth(shortName) * nameSize > room - 4) shortName = shortName.slice(0, -1);
  if (shortName !== name) shortName = `${shortName.slice(0, -1)}…`;
  return { visible, name: shortName, nameSize, numberSize, amount, nameOffset, numberOffset };
}

interface Props {
  cells: TerrainCell[];
  width: number;
  height: number;
  selectedSymbol?: string;
  highlightedSymbol: string | null;
  modeLabel: string;
  mode: 'pnl' | 'today';
  color: (value: number | null) => TerrainColor;
  percent: (value: number | null) => string;
  weight: (value: number) => string;
  onSelect: (symbol: string, trigger: SVGPathElement) => void;
}

export default function PortfolioTerrain({ cells, width, height, selectedSymbol, highlightedSymbol, mode, modeLabel, color, percent, weight, onSelect }: Props) {
  const id = useId().replace(/:/g, '');
  const clipId = `terrain-clip-${id}`;
  const lightId = `terrain-light-${id}`;
  const rimId = `terrain-rim-${id}`;
  const maskId = `terrain-type-mask-${id}`;
  const maskGradientId = `terrain-type-fade-${id}`;
  const contours = useMemo(() => portfolioTerrainContours(cells, width, height), [cells, width, height]);
  const padding = Math.min(8, width / 20, height / 20);

  return <svg className={styles.terrain} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="투자 비중 지도" data-portfolio-terrain data-selected={selectedSymbol ? 'true' : undefined}>
    <defs>
      <clipPath id={clipId}><ellipse cx={width / 2} cy={height / 2} rx={width / 2 - padding} ry={height / 2 - padding} /></clipPath>
      <linearGradient id={lightId} x1="0" y1="0" x2=".75" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity=".1" />
        <stop offset=".42" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#111e52" stopOpacity=".28" />
      </linearGradient>
      <linearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fff" stopOpacity=".65" />
        <stop offset=".45" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#0c143f" stopOpacity=".2" />
      </linearGradient>
      <radialGradient id={maskGradientId}><stop offset=".65" stopColor="#000" /><stop offset="1" stopColor="#fff" /></radialGradient>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
        <rect width={width} height={height} fill="#fff" />
        {cells.map(cell => {
          const label = terrainLabel(cell);
          return label.visible ? <ellipse key={cell.symbol} cx={cell.labelAnchor.x} cy={cell.labelAnchor.y - 5} rx={cell.labelAnchor.radius * .74 + 5} ry={(label.numberSize + label.nameSize) * .58 + 14} fill={`url(#${maskGradientId})`} /> : null;
        })}
      </mask>
    </defs>
    {cells.map(cell => {
      const change = mode === 'pnl' ? cell.pnl : cell.today;
      const label = terrainLabel(cell);
      const paint = color(change);
      return <g key={cell.symbol} style={paint} data-neutral={change === null || change === 0 || undefined} data-active={selectedSymbol === cell.symbol || undefined} data-highlighted={highlightedSymbol === cell.symbol || undefined} className={styles.regionGroup}>
        <path d={cell.path} fill={paint['--parcel-fill']} className={styles.region} data-symbol={cell.symbol} role="button" tabIndex={cell.labelAnchor.radius >= 22 ? 0 : -1}
          aria-pressed={selectedSymbol === cell.symbol}
          aria-label={`${cell.label}, 투자 비중 ${weight(cell.weight)}, ${modeLabel} ${percent(change)}`}
          onClick={event => onSelect(cell.symbol, event.currentTarget)}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(cell.symbol, event.currentTarget); } }} />
        <path d={cell.path} fill={`url(#${lightId})`} className={styles.finish} aria-hidden="true" />
        <path d={cell.path} fill="none" className={styles.regionBorder} aria-hidden="true" />
        {highlightedSymbol === cell.symbol && !label.visible && <circle className={styles.locator} fill="none" cx={cell.labelAnchor.x} cy={cell.labelAnchor.y} r="13" aria-hidden="true" />}
      </g>;
    })}
    <g fill="none" clipPath={`url(#${clipId})`} mask={`url(#${maskId})`} className={styles.terrainEtching} aria-hidden="true">
      {contours.map((path, index) => <path key={index} d={path} pathLength="1" style={{ animationDelay: `${index * 24}ms` }} />)}
    </g>
    {cells.map(cell => {
      const label = terrainLabel(cell);
      const change = mode === 'pnl' ? cell.pnl : cell.today;
      const paint = color(change);
      return label.visible ? <g key={cell.symbol} fill={paint['--parcel-ink']} className={styles.regionLabel} style={paint} aria-hidden="true" data-region-label={cell.symbol}>
        <text x={cell.labelAnchor.x} y={cell.labelAnchor.y + label.nameOffset} fontSize={label.nameSize} className={styles.regionName} textAnchor="middle">{label.name}</text>
        <text x={cell.labelAnchor.x} y={cell.labelAnchor.y + label.numberOffset} fontSize={label.numberSize} className={styles.regionWeight} textAnchor="middle">{label.amount}<tspan fontSize={Math.max(9, label.numberSize * .35)} dx="2">%</tspan></text>
      </g> : null;
    })}
    <ellipse fill="none" className={styles.terrainRim} cx={width / 2} cy={height / 2} rx={width / 2 - padding - .6} ry={height / 2 - padding - .6} stroke={`url(#${rimId})`} aria-hidden="true" />
  </svg>;
}
