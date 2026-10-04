'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, type QuoteData } from '@/config/constants';
import { useNow } from '@/hooks/useNow';
import { getStockCurrency } from '@/utils/stockCurrency';
import { formatNativeAmount } from '@/utils/koreanNumber';
import { quoteTimestamp } from '@/utils/quotePresentation';
import { changeColor, signedChange } from '@/utils/stockTrendPresentation';
import styles from './StockPulse.module.css';

export default function StockPulse() {
  const { investing, macroData, rawCandles, setAnalysisSymbol } = usePortfolioStore(useShallow(state => ({
    investing: state.stocks.investing, macroData: state.macroData,
    rawCandles: state.rawCandles, setAnalysisSymbol: state.setAnalysisSymbol,
  })));
  const currentTime = useNow();
  const pulses = useMemo(() => {
    const seen = new Set<string>();
    return investing.flatMap(stock => {
      if (currentTime === 0 || stock.shares <= 0 || seen.has(stock.symbol)) return [];
      seen.add(stock.symbol);
      const candles = rawCandles[stock.symbol];
      const quote = macroData[stock.symbol] as QuoteData | undefined;
      if (!candles?.c?.length || !quote?.c || !Number.isFinite(quote.c) || quote.c <= 0) return [];
      const cutoff = currentTime / 1000 - 30 * 86400;
      const recent = candles.c.filter((price, index) => candles.t[index] >= cutoff
        && candles.t[index] <= currentTime / 1000 && Number.isFinite(price) && price > 0);
      if (recent.length < 5) return [];
      recent.push(quote.c);
      const low = Math.min(...recent);
      const range = Math.max(...recent) - low;
      return [{ symbol: stock.symbol, name: STOCK_KR[stock.symbol] || stock.name || stock.symbol,
        nativeCurrency: getStockCurrency(stock.symbol, stock.currency), current: quote.c, asOf: quoteTimestamp(quote.t),
        points: recent.map(price => range > 0 ? (price - low) / range : .5),
        change: (quote.c - recent[0]) / recent[0] * 100 }];
    });
  }, [investing, macroData, rawCandles, currentTime]);

  if (!pulses.length) return <p className={styles.empty}>보유 종목의 최근 가격 자료가 충분하지 않아요. 종목과 시세가 준비되면 흐름을 보여드려요.</p>;

  return <section className={styles.root} aria-label="보유 종목의 최근 30일 가격 흐름">
    <p className={styles.hint}>최근 30일의 종가와 마지막 시세를 연결했어요. 색상과 등락률은 이 기간의 가격 변화이며, 내 투자 수익률과는 달라요.</p>
    <div className={styles.list}>{pulses.map(pulse => {
      const path = pulse.points.map((point, index) => `${index ? 'L' : 'M'} ${index / (pulse.points.length - 1) * 120} ${36 - point * 30}`).join(' ');
      const color = changeColor(pulse.change);
      return <button type="button" key={pulse.symbol} className={styles.row} onClick={() => setAnalysisSymbol(pulse.symbol)} aria-label={`${pulse.name} 가격 흐름 살펴보기`}>
        <div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{pulse.name.charAt(0)}</span>
          <div><strong>{pulse.name}</strong><span>{formatNativeAmount(pulse.current, pulse.nativeCurrency)}</span></div></div>
        <div className={styles.trend}><svg viewBox="0 0 120 42" aria-hidden="true"><path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" /></svg>
          <span style={{ color }}>{signedChange(pulse.change)}%<small>최근 30일</small></span></div>
        <p className={styles.asOf}>{pulse.asOf ? `${pulse.asOf} 시세 기준 · 한국시간` : '시세 기준 시각 미확인'} · 지연 가능</p>
      </button>;
    })}</div>
    {pulses.length < new Set(investing.map(stock => stock.symbol)).size && <p className={styles.hint}>최근 가격이 충분한 {pulses.length}개 종목을 표시했어요.</p>}
  </section>;
}
