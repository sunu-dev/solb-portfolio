'use client';

import { useEffect, useRef } from 'react';
import { tsToDate } from '@/store/portfolioStore';
import type { CandleRaw } from '@/config/constants';

interface StockChartProps {
  raw: CandleRaw;
  sma5: number[];
  sma20: number[];
  sma60: number[];
}

export default function StockChart({ raw, sma5, sma20, sma60 }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);

  useEffect(() => {
    if (!containerRef.current || !raw?.t?.length) return;

    let isMounted = true;

    // Dynamic import for lightweight-charts (needs window/DOM)
    import('lightweight-charts').then((LightweightCharts) => {
      if (!isMounted || !containerRef.current) return;

      // Clean up previous chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const chart = LightweightCharts.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 280,
        layout: {
          background: { type: LightweightCharts.ColorType.Solid, color: '#FFFFFF' },
          textColor: '#8B95A1',
          fontFamily: "'Pretendard Variable', sans-serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: '#F2F4F6' },
          horzLines: { color: '#F2F4F6' },
        },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#E5E8EB' },
        timeScale: { borderColor: '#E5E8EB', timeVisible: false },
      });
      chartRef.current = chart;

      // Candlestick -- Korean convention: RED (#EF4452) for up, BLUE (#3182F6) for down
      const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
        upColor: '#EF4452',
        downColor: '#3182F6',
        borderUpColor: '#EF4452',
        borderDownColor: '#3182F6',
        wickUpColor: '#EF4452',
        wickDownColor: '#3182F6',
      });
      const candleData = raw.t.map((t, i) => ({
        time: tsToDate(t) as string,
        open: raw.o[i],
        high: raw.h[i],
        low: raw.l[i],
        close: raw.c[i],
      }));
      candleSeries.setData(candleData);

      // Volume
      const volSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      const volData = raw.t.map((t, i) => ({
        time: tsToDate(t) as string,
        value: raw.v[i],
        color: raw.c[i] >= raw.o[i] ? 'rgba(239,68,82,0.2)' : 'rgba(49,130,246,0.2)',
      }));
      volSeries.setData(volData);

      // SMA lines
      const addSMALine = (smaArr: number[], startIdx: number, color: string) => {
        const line = chart.addSeries(LightweightCharts.LineSeries, {
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        const data = smaArr.map((v, i) => ({
          time: tsToDate(raw.t[startIdx + i]) as string,
          value: v,
        }));
        line.setData(data);
      };

      if (sma5.length) addSMALine(sma5, raw.t.length - sma5.length, '#4fc3f7');
      if (sma20.length) addSMALine(sma20, raw.t.length - sma20.length, '#ffa726');
      if (sma60.length) addSMALine(sma60, raw.t.length - sma60.length, '#a29bfe');

      chart.timeScale().fitContent();

      // Resize observer
      const ro = new ResizeObserver(entries => {
        for (const e of entries) {
          if (chartRef.current) chartRef.current.resize(e.contentRect.width, 280);
        }
      });
      ro.observe(containerRef.current!);

      return () => {
        ro.disconnect();
      };
    });

    return () => {
      isMounted = false;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [raw, sma5, sma20, sma60]);

  return (
    <div>
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />
      <div className="flex gap-4 mt-2 text-[11px] text-[#8B95A1] justify-center">
        <span><span className="text-[#4fc3f7]">━</span> 5일 평균</span>
        <span><span className="text-[#ffa726]">━</span> 20일 평균</span>
        <span><span className="text-[#a29bfe]">━</span> 60일 평균</span>
      </div>
    </div>
  );
}
