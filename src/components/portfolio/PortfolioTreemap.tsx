'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, Share2, X } from 'lucide-react';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { buildComposition, type CompositionStock } from '@/utils/portfolioComposition';
import { layoutPortfolioHeatmap } from '@/utils/portfolioHeatmapLayout';
import { getPortfolioHeatmapGroup, getPortfolioHeatmapLabel } from '@/utils/portfolioHeatmapGroups';
import PortfolioHeatmap, { heatmapColor, heatmapLabel } from './PortfolioHeatmap';
import { portfolioPriceHistory } from '@/utils/portfolioPriceHistory';
import styles from './PortfolioTreemap.module.css';

interface Props {
  stocks: (CompositionStock & { name?: string })[];
  macroData: Record<string, QuoteData | unknown>;
  usdKrw: number;
  currency: 'KRW' | 'USD';
  variant?: 'full' | 'compact';
  onExpand?: () => void;
  onCellClick?: (symbol: string) => void;
  rawCandles?: Record<string, CandleRaw>;
}

const numberFormat = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });
const percent = (value: number | null) => value === null ? '미확인' : `${numberFormat.format(value)}%`;
const weight = (value: number) => value < 0.1 ? '0.1% 미만' : `${value.toFixed(1)}%`;
const direction = (value: number | null) => value === null ? 'unknown' : value > 0 ? 'gain' : value < 0 ? 'loss' : 'flat';

function PriceTrace({ history }: { history: NonNullable<ReturnType<typeof portfolioPriceHistory>> }) {
  return <svg className={styles.priceTrace} viewBox="0 0 240 64" preserveAspectRatio="none" aria-hidden="true"><path d={history.line} fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function PortfolioTreemap({ stocks, macroData, usdKrw, currency, variant = 'full', onExpand, onCellClick, rawCandles }: Props) {
  const [mode, setMode] = useState<'pnl' | 'today'>('today');
  const [expanded, setExpanded] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  const [size, setSize] = useState({ width: 400, height: 320 });
  const capture = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | SVGPathElement | SVGGElement | null>(null);
  const pickerId = useId();
  const { items: rawItems, missing } = useMemo(() => buildComposition(stocks, macroData, usdKrw, currency), [stocks, macroData, usdKrw, currency]);
  const items = useMemo(() => {
    const savedNames = new Map<string, string>();
    for (const stock of stocks) {
      if (stock.name?.trim()) savedNames.set(stock.symbol, stock.name);
    }
    return rawItems.map(item => ({
      ...item,
      label: getPortfolioHeatmapLabel(item.symbol, item.label, savedNames.get(item.symbol)),
    }));
  }, [rawItems, stocks]);
  const formatter = useMemo(() => new Intl.NumberFormat('ko-KR', { style: 'currency', currency, maximumFractionDigits: currency === 'KRW' ? 0 : 2 }), [currency]);
  const selected = items.find(item => item.symbol === selectedSymbol);
  const map = useMemo(() => layoutPortfolioHeatmap(items.map(item => ({ ...item, ...getPortfolioHeatmapGroup(item.symbol) })), size.width, size.height), [items, size]);
  const cells = map.sectors.flatMap(sector => sector.industries.flatMap(industry => industry.cells));
  const smallItems = cells.filter(item => !heatmapLabel(item, mode).nameVisible);
  const selectedHistory = useMemo(() => portfolioPriceHistory(selected ? rawCandles?.[selected.symbol] : undefined), [rawCandles, selected]);
  const hasItems = items.length > 0;
  const modeLabel = mode === 'pnl' ? '누적 수익률' : '오늘 등락률';
  const selectedReturn = selected ? mode === 'pnl' ? selected.pnl : selected.today : null;
  const select = (symbol: string, trigger: HTMLButtonElement | SVGPathElement | SVGGElement | null) => {
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
      // Rasterize the self-contained plot separately to preserve SVG paint
      // and label typography in the exported image.
      for (const svg of snapshot.querySelectorAll<SVGSVGElement>('svg[data-portfolio-heatmap]')) {
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

  return <section ref={capture} className={styles.panel} data-variant={variant} aria-label="내 포트폴리오 맵" onKeyDown={event => { if (event.key === 'Escape') { if (expanded) { event.preventDefault(); setExpanded(false); picker.current?.focus(); } else if (selected) { event.preventDefault(); closeSelection(); } } }}>
    <header className={styles.header}>
      <h2>내 포트폴리오 맵</h2>
      <button className={styles.share} onClick={share} disabled={sharing || !hasItems} data-capture="exclude" aria-label={sharing ? '공유 이미지 만드는 중' : '포트폴리오 맵 이미지 공유'}><Share2 size={17} aria-hidden="true" /></button>
    </header>
    {!hasItems ? <p className={styles.empty}>보유 종목의 시세가 준비되면 투자 비중을 보여드릴게요.</p> : <>
      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="색으로 표시할 수익률">
          <button aria-pressed={mode === 'today'} onClick={() => setMode('today')}>오늘 등락률</button>
          <button aria-pressed={mode === 'pnl'} onClick={() => setMode('pnl')}>누적 수익률</button>
        </div>
        <button ref={picker} className={styles.picker} aria-expanded={expanded} aria-controls={pickerId} data-capture="exclude" onClick={() => setExpanded(!expanded)}>{items.length}종목 <ChevronDown size={13} aria-hidden="true" /></button>
      </div>
      <div id={pickerId} className={styles.holdings} hidden={!expanded} role="group" aria-label="전체 종목 선택" data-capture="exclude">
        {items.map(item => <button key={item.symbol} aria-pressed={selected?.symbol === item.symbol} onClick={() => { select(item.symbol, picker.current); picker.current?.focus(); }}><span>{item.label}</span><span>{weight(item.weight)}</span><b data-direction={direction(mode === 'pnl' ? item.pnl : item.today)}>{percent(mode === 'pnl' ? item.pnl : item.today)}</b></button>)}
      </div>
      <div className={styles.heatmapFrame}>
        <div ref={canvas} className={styles.map}>
          <PortfolioHeatmap layout={map} width={size.width} height={size.height} mode={mode} modeLabel={modeLabel}
            selectedSymbol={selected?.symbol} percent={percent} weight={weight} onSelect={select} />
        </div>
        <div className={styles.mapFooter}>
          <span>면적 = 평가금액 · 색 = {modeLabel}</span>
          <div className={styles.colorScale} aria-label={`${modeLabel} 색상 범례`}>
            {(mode === 'today' ? [-3, -2, -1, 0, 1, 2, 3] : [-30, -20, -10, 0, 10, 20, 30]).map(value => <span key={value} style={{ background: heatmapColor(value, mode) }}>{value > 0 ? '+' : ''}{value}%</span>)}
          </div>
        </div>
      </div>
      {smallItems.length > 0 && <button className={styles.smallNotice} aria-expanded={expanded} aria-controls={pickerId} onClick={() => { setExpanded(true); picker.current?.focus(); }}>
        작은 칸 {smallItems.length}종목은 목록에서 보기 <ChevronDown size={13} aria-hidden="true" />
      </button>}
      {selected && <div className={styles.detail} aria-live="polite">
        <div className={styles.detailHeader}>
          <strong className={styles.selectedName}>{selected.label}</strong>
          <button className={styles.close} aria-label="종목 상세 닫기" onClick={closeSelection} data-capture="exclude"><X size={15} /></button>
        </div>
          <dl className={styles.keyMetrics}>
            <div><dt>투자 비중</dt><dd>{weight(selected.weight)}</dd></div>
            <div><dt>{modeLabel}</dt><dd data-direction={direction(selectedReturn)}>{percent(selectedReturn)}</dd></div>
          </dl>
        <dl className={styles.valueMetric}><dt>현재 평가금액</dt><dd>{formatter.format(selected.value)}</dd></dl>
        <div className={styles.detailActions}>
          {selectedHistory && <details className={styles.history}><summary>가격 흐름 <ChevronDown size={13} aria-hidden="true" /></summary><div data-direction={direction(selectedHistory.change)}><div className={styles.historyCaption}><span>{selectedHistory.start}–{selectedHistory.end} 종가</span><b>기간 {percent(selectedHistory.change)}</b></div><PriceTrace history={selectedHistory} /><p>표시된 기간의 가격 변화로, 매입 이후 수익률과 다를 수 있어요.</p></div></details>}
          {onCellClick && <button className={styles.analysisLink} onClick={() => onCellClick(selected.symbol)}>{selected.label} 분석 보기 <ArrowUpRight size={14} /></button>}
        </div>
      </div>}
      <details className={styles.help} data-map-key>
        <summary aria-label="포트폴리오 맵 읽는 법">
          <span className={styles.guideMark} aria-hidden="true"><i /><i /><i /></span>
          <span className={styles.guideHeading}><strong>포트폴리오 맵 읽는 법</strong><small>크기와 색으로 내 투자 한눈에 보기</small></span>
          <ChevronDown className={styles.guideChevron} size={18} aria-hidden="true" />
        </summary>
        <div className={styles.guideGrid}>
          <div className={styles.guideStep}>
            <div className={styles.sizeExample} aria-hidden="true"><span>60%</span><span>30%</span><span>10%</span></div>
            <h3>큰 칸일수록, 큰 비중</h3>
            <p>현재 평가금액이 클수록 넓게 보여요. 같은 그룹 안에서 크기를 비교해보세요.</p>
          </div>
          <div className={styles.guideStep}>
            <div className={styles.colorExample} aria-hidden="true"><span>−</span><span>0</span><span>+</span><span>?</span></div>
            <h3>색은 방향, 숫자는 수익률</h3>
            <p>빨강은 하락, 초록은 상승, 회색은 보합이에요. 빗금은 수익률 미확인이에요.</p>
          </div>
          <div className={styles.guideStep}>
            <div className={styles.tapExample} aria-hidden="true"><span>종목<small>+2.5%</small></span><ArrowUpRight size={20} /><div>투자 비중<strong>평가금액</strong></div></div>
            <h3>궁금한 종목을 눌러보세요</h3>
            <p>칸을 누르면 투자 비중과 현재 평가금액을 자세히 볼 수 있어요.</p>
          </div>
        </div>
        <div className={styles.guideFootnote}>
          <span>지금 보는 기준 <strong>{modeLabel}</strong></span>
          <p>업종·ETF 상품 유형별로 묶고, 분류를 모르면 미분류로 표시해요. 그룹 제목은 비중에 포함되지 않아요.</p>
          <p>{mode === 'today' ? '±3%' : '±30%'}를 넘어도 색은 같지만 숫자는 실제 수익률이에요. 누적 수익률은 입력한 매입금액 기준이에요.</p>
          <small>위 그림은 읽는 방법을 설명하는 예시예요.</small>
        </div>
      </details>
      {missing > 0 && <p className={styles.note}>시세가 없는 {missing}개 종목은 비중 계산에서 제외했어요.</p>}
      {variant === 'compact' && onExpand && <button className={styles.more} onClick={onExpand}>전체 분석 보기 <ArrowUpRight size={15} /></button>}
    </>}
    {shareError && <p role="status" className={styles.note}>{shareError}</p>}
  </section>;
}
