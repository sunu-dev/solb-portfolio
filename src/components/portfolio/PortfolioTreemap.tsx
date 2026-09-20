'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, CircleHelp, Share2, X } from 'lucide-react';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { buildComposition, type CompositionStock } from '@/utils/portfolioComposition';
import { layoutPortfolioTerrain } from '@/utils/portfolioTerrainLayout';
import PortfolioTerrain, { terrainLabel, type TerrainColor } from './PortfolioTerrain';
import { portfolioPriceHistory } from '@/utils/portfolioPriceHistory';
import styles from './PortfolioTreemap.module.css';

interface Props {
  stocks: CompositionStock[];
  macroData: Record<string, QuoteData | unknown>;
  usdKrw: number;
  currency: 'KRW' | 'USD';
  variant?: 'full' | 'compact';
  onExpand?: () => void;
  onCellClick?: (symbol: string) => void;
  rawCandles?: Record<string, CandleRaw>;
}

const numberFormat = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' });
const percent = (value: number | null) => value === null ? '미확인' : `${numberFormat.format(value)}%`;
const weight = (value: number) => value < 0.1 ? '0.1% 미만' : `${value.toFixed(1)}%`;
const direction = (value: number | null) => value === null ? 'unknown' : value > 0 ? 'gain' : value < 0 ? 'loss' : 'flat';

/** One shared scale for each mode; territory area always represents market value. */
function tileStyle(value: number | null, mode: 'pnl' | 'today'): TerrainColor {
  const depth = Math.min(Math.abs(value ?? 0) / (mode === 'pnl' ? 100 : 10), 1);
  const start = value !== null && value > 0 ? [199, 35, 57] : [28, 84, 235];
  const end = value !== null && value > 0 ? [177, 30, 56] : [26, 47, 172];
  const fill = value === null || value === 0 ? '#eef0f2' : `rgb(${start.map((channel, index) => Math.round(channel + (end[index] - channel) * depth)).join(' ')})`;
  return { '--parcel-fill': fill, '--parcel-ink': value === null || value === 0 ? '#505965' : '#ffffff' };
}

function PriceTrace({ history }: { history: NonNullable<ReturnType<typeof portfolioPriceHistory>> }) {
  return <svg className={styles.priceTrace} viewBox="0 0 240 64" preserveAspectRatio="none" aria-hidden="true"><path d={history.line} fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function PortfolioTreemap({ stocks, macroData, usdKrw, currency, variant = 'full', onExpand, onCellClick, rawCandles }: Props) {
  const [mode, setMode] = useState<'pnl' | 'today'>('pnl');
  const [expanded, setExpanded] = useState(false);
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  const [size, setSize] = useState({ width: 400, height: 360 });
  const capture = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | SVGPathElement | null>(null);
  const pickerId = useId();
  const { items, missing } = useMemo(() => buildComposition(stocks, macroData, usdKrw, currency), [stocks, macroData, usdKrw, currency]);
  const formatter = useMemo(() => new Intl.NumberFormat('ko-KR', { style: 'currency', currency, maximumFractionDigits: currency === 'KRW' ? 0 : 2 }), [currency]);
  const map = useMemo(() => layoutPortfolioTerrain(items, size.width, size.height), [items, size]);
  const selected = items.find(item => item.symbol === selectedSymbol);
  const smallItems = map.filter(item => !terrainLabel(item).visible);
  const selectedHistory = useMemo(() => portfolioPriceHistory(selected ? rawCandles?.[selected.symbol] : undefined), [rawCandles, selected]);
  const hasItems = items.length > 0;
  const modeLabel = mode === 'pnl' ? '누적 수익률' : '오늘 등락률';
  const selectedReturn = selected ? mode === 'pnl' ? selected.pnl : selected.today : null;
  const select = (symbol: string, trigger: HTMLButtonElement | SVGPathElement | null) => {
    lastTrigger.current = trigger;
    setSelectedSymbol(symbol);
    setExpanded(false);
  };
  const closeSelection = () => {
    setSelectedSymbol(null);
    (lastTrigger.current?.isConnected ? lastTrigger.current : picker.current)?.focus();
  };

  useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width > 0 && height > 0) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    });
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [hasItems]);

  const share = async () => {
    if (!capture.current || sharing) return;
    setSharing(true); setShareError('');
    let exportHost: HTMLElement | null = null;
    try {
      const { toBlob } = await import('html-to-image');
      // Reflow the export with a system font before measuring it. Remote web
      // fonts cannot be embedded under our CSP and otherwise wrap differently.
      const snapshot = capture.current.cloneNode(true) as HTMLElement;
      exportHost = document.createElement('div');
      exportHost.setAttribute('aria-hidden', 'true');
      exportHost.inert = true;
      Object.assign(exportHost.style, { position: 'fixed', left: '-10000px', top: '0', width: `${capture.current.getBoundingClientRect().width}px` });
      snapshot.style.margin = '0';
      snapshot.querySelectorAll<HTMLElement>('*').forEach(element => { element.style.animation = 'none'; element.style.transition = 'none'; });
      for (const element of [snapshot, ...snapshot.querySelectorAll<HTMLElement>('*')]) element.style.setProperty('font-family', 'Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif', 'important');
      snapshot.querySelectorAll('[data-capture="exclude"]').forEach(element => element.remove());
      snapshot.querySelectorAll<HTMLDetailsElement>('[data-map-key]').forEach(element => { element.open = false; });
      exportHost.append(snapshot);
      document.body.append(exportHost);
      // html-to-image deep-clones an SVG without copying its descendants' CSS.
      // Freeze their resolved paint and type styles so the export is self-contained.
      const svgProperties = ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'clip-path', 'mask', 'filter', 'visibility', 'display', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'paint-order', 'stop-color', 'stop-opacity', 'vector-effect'];
      snapshot.querySelectorAll<SVGElement>('svg *').forEach(element => {
        const computed = getComputedStyle(element);
        svgProperties.forEach(property => element.style.setProperty(property, computed.getPropertyValue(property)));
      });
      // Render the self-contained SVG separately: nested SVG masks inside the
      // exporter's foreignObject otherwise lose their text-clearance effect.
      for (const svg of snapshot.querySelectorAll<SVGSVGElement>('svg[data-portfolio-terrain]')) {
        const bounds = svg.getBoundingClientRect();
        const artwork = svg.cloneNode(true) as SVGSVGElement;
        artwork.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        artwork.setAttribute('width', String(bounds.width));
        artwork.setAttribute('height', String(bounds.height));
        artwork.style.filter = 'none';
        const picture = new Image();
        picture.width = bounds.width;
        picture.height = bounds.height;
        picture.style.cssText = `display:block;width:100%;height:100%;filter:${getComputedStyle(svg).filter}`;
        picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(artwork))}`;
        await picture.decode();
        svg.replaceWith(picture);
      }
      const blob = await toBlob(snapshot, { pixelRatio: 2, skipFonts: true, backgroundColor: getComputedStyle(capture.current).backgroundColor });
      if (!blob) throw new Error('Portfolio image is empty');
      const file = new File([blob], `joobi-portfolio-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: '주비 · 내 포트폴리오 맵' });
      else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setShareError('이미지를 만들지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally { exportHost?.remove(); setSharing(false); }
  };

  return <section ref={capture} className={styles.panel} data-variant={variant} aria-label="내 포트폴리오 맵" onKeyDown={event => { if (event.key === 'Escape' && selected) { event.preventDefault(); closeSelection(); } }}>
    <header className={styles.header}>
      <h2>내 포트폴리오 맵</h2>
      <button className={styles.share} onClick={share} disabled={sharing || !hasItems} data-capture="exclude" aria-label={sharing ? '공유 이미지 만드는 중' : '포트폴리오 맵 이미지 공유'}><Share2 size={17} aria-hidden="true" /></button>
    </header>
    {!hasItems ? <p className={styles.empty}>보유 종목의 시세가 준비되면 투자 비중을 보여드릴게요.</p> : <>
      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="색으로 표시할 수익률">
          <button aria-pressed={mode === 'pnl'} onClick={() => setMode('pnl')}>누적 수익률</button>
          <button aria-pressed={mode === 'today'} onClick={() => setMode('today')}>오늘 등락률</button>
        </div>
        <button ref={picker} className={styles.picker} aria-expanded={expanded} aria-controls={pickerId} data-capture="exclude" onClick={() => setExpanded(!expanded)}>{items.length}종목 <ChevronDown size={13} aria-hidden="true" /></button>
      </div>
      <div ref={canvas} className={styles.map}
        onPointerMove={event => {
          if (event.pointerType !== 'mouse') return;
          const bounds = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty('--light-x', `${(event.clientX - bounds.left) / bounds.width * 100}%`);
          event.currentTarget.style.setProperty('--light-y', `${(event.clientY - bounds.top) / bounds.height * 100}%`);
        }}
        onPointerLeave={event => { event.currentTarget.style.removeProperty('--light-x'); event.currentTarget.style.removeProperty('--light-y'); }}>
        <PortfolioTerrain cells={map} width={size.width} height={size.height} mode={mode} modeLabel={modeLabel}
          selectedSymbol={selected?.symbol} highlightedSymbol={highlightedSymbol}
          color={value => tileStyle(value, mode)} percent={percent} weight={weight} onSelect={select} />
        <span className={styles.illumination} aria-hidden="true" />
      </div>
      {selected && <div className={styles.detail} style={tileStyle(selectedReturn, mode)} aria-live="polite">
        <div className={styles.detailHeader}><div><span className={styles.detailEyebrow}>선택한 종목</span><strong>{selected.label}</strong></div><button className={styles.close} aria-label="종목 상세 닫기" onClick={closeSelection} data-capture="exclude"><X size={17} /></button></div>
        <dl className={styles.metrics}>
          <div className={styles.valueMetric}><dt>현재 평가금액</dt><dd>{formatter.format(selected.value)}</dd></div>
          <div><dt>투자 비중</dt><dd>{weight(selected.weight)}</dd></div>
          <div><dt>{modeLabel}</dt><dd data-direction={direction(selectedReturn)}>{percent(selectedReturn)}</dd></div>
        </dl>
        <div className={styles.detailActions}>
          {selectedHistory && <details className={styles.history}><summary>가격 흐름 <ChevronDown size={13} aria-hidden="true" /></summary><div data-direction={direction(selectedHistory.change)}><div className={styles.historyCaption}><span>{selectedHistory.start}–{selectedHistory.end} 종가</span><b>기간 {percent(selectedHistory.change)}</b></div><PriceTrace history={selectedHistory} /><p>표시된 기간의 가격 변화로, 매입 이후 수익률과 다를 수 있어요.</p></div></details>}
          {onCellClick && <button className={styles.analysisLink} onClick={() => onCellClick(selected.symbol)}>{selected.label} 분석 보기 <ArrowUpRight size={14} /></button>}
        </div>
      </div>}
      <details className={styles.help} data-map-key>
        <summary aria-label="맵 읽는 법"><span className={styles.keyLabel}>면적·숫자는 투자 비중 <CircleHelp size={13} aria-hidden="true" /></span><span className={styles.colorKey}><i data-direction="loss" />하락<i data-direction="gain" />상승</span></summary>
        <p>숫자와 각 영역의 면적은 현재 평가금액의 비중이에요. 파랑은 하락, 빨강은 상승이며 색이 진할수록 {modeLabel}의 변화 폭이 커요. {mode === 'pnl' ? '±100%' : '±10%'}를 넘으면 가장 진한 색으로 표시해요. 종목을 누르면 금액과 수익률이 펼쳐져요.</p><p>누적 수익률은 입력한 매입금액 기준이며, 시세나 매입금액이 없으면 미확인으로 표시해요. 회색 영역은 보합 또는 수익률 미확인이에요.</p>
      </details>
      {smallItems.length > 0 && <div className={styles.smallItems} aria-label="작은 비중의 종목">{smallItems.slice(0, 3).map(item => <button key={item.symbol} aria-pressed={selected?.symbol === item.symbol} onClick={event => select(item.symbol, event.currentTarget)} onMouseEnter={() => setHighlightedSymbol(item.symbol)} onMouseLeave={() => setHighlightedSymbol(null)} onFocus={() => setHighlightedSymbol(item.symbol)} onBlur={() => setHighlightedSymbol(null)} style={tileStyle(mode === 'pnl' ? item.pnl : item.today, mode)}><i aria-hidden="true" /><span>{item.label}</span><b>{weight(item.weight)}</b><ArrowUpRight size={13} aria-hidden="true" /></button>)}{smallItems.length > 3 && <button aria-expanded={expanded} aria-controls={pickerId} onClick={() => setExpanded(!expanded)}>외 {smallItems.length - 3}종목 <ChevronDown size={13} aria-hidden="true" /></button>}</div>}
      <div id={pickerId} className={styles.holdings} hidden={!expanded} role="group" aria-label="전체 종목 선택" data-capture="exclude">
        {items.map(item => <button key={item.symbol} aria-pressed={selected?.symbol === item.symbol} onClick={() => { select(item.symbol, picker.current); picker.current?.focus(); }}><span>{item.label}</span><span>{weight(item.weight)}</span><b data-direction={direction(mode === 'pnl' ? item.pnl : item.today)}>{percent(mode === 'pnl' ? item.pnl : item.today)}</b></button>)}
      </div>
      {missing > 0 && <p className={styles.note}>시세가 없는 {missing}개 종목은 비중 계산에서 제외했어요.</p>}
      {variant === 'compact' && onExpand && <button className={styles.more} onClick={onExpand}>전체 분석 보기 <ArrowUpRight size={15} /></button>}
    </>}
    {shareError && <p role="status" className={styles.note}>{shareError}</p>}
  </section>;
}
