'use client';

import { useEffect, useRef } from 'react';
import { tsToDate } from '@/store/portfolioStore';
import type { CandleRaw } from '@/config/constants';

interface StockChartProps {
  raw: CandleRaw;
  sma5: number[];
  sma20: number[];
  sma60: number[];
  level?: 'basic' | 'analysis' | 'expert';
  bollingerBands?: { middle: number; upper: number; lower: number }[];
  macdData?: { macd: number[]; signal: number[]; histogram: number[] };
  rsiData?: number[];
}

export default function StockChart({
  raw, sma5, sma20, sma60,
  level = 'basic',
  bollingerBands,
  macdData,
  rsiData,
}: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);
  const macdChartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);

  useEffect(() => {
    if (!containerRef.current || !raw?.t?.length) return;

    let isMounted = true;

    import('lightweight-charts').then((LightweightCharts) => {
      if (!isMounted || !containerRef.current) return;

      // Clean up previous charts
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
      if (macdChartRef.current) { macdChartRef.current.remove(); macdChartRef.current = null; }
      if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null; }

      const chartOpts = {
        width: containerRef.current.clientWidth,
        height: level === 'basic' ? 280 : 220,
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
      };

      const chart = LightweightCharts.createChart(containerRef.current, chartOpts);
      chartRef.current = chart;

      // Candlestick -- Korean convention: RED for up, BLUE for down
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

      // SMA lines helper
      const addLine = (arr: number[], startIdx: number, color: string, width: number = 1) => {
        const line = chart.addSeries(LightweightCharts.LineSeries, {
          color,
          lineWidth: width as 1 | 2 | 3 | 4,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        const data = arr.map((v, i) => ({
          time: tsToDate(raw.t[startIdx + i]) as string,
          value: v,
        }));
        line.setData(data);
      };

      // Always show MA 20 and 60
      if (sma20.length) addLine(sma20, raw.t.length - sma20.length, '#ffa726', 1);
      if (sma60.length) addLine(sma60, raw.t.length - sma60.length, '#a29bfe', 1);

      // Expert: also show MA 5
      if (level === 'expert' && sma5.length) {
        addLine(sma5, raw.t.length - sma5.length, '#4fc3f7', 1);
      }

      // Analysis / Expert: Bollinger Bands
      if ((level === 'analysis' || level === 'expert') && bollingerBands && bollingerBands.length) {
        const startIdx = raw.t.length - bollingerBands.length;
        const upperLine = chart.addSeries(LightweightCharts.LineSeries, {
          color: 'rgba(139, 149, 161, 0.4)',
          lineWidth: 1,
          lineStyle: 2, // dashed
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        const lowerLine = chart.addSeries(LightweightCharts.LineSeries, {
          color: 'rgba(139, 149, 161, 0.4)',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        upperLine.setData(bollingerBands.map((b, i) => ({
          time: tsToDate(raw.t[startIdx + i]) as string,
          value: b.upper,
        })));
        lowerLine.setData(bollingerBands.map((b, i) => ({
          time: tsToDate(raw.t[startIdx + i]) as string,
          value: b.lower,
        })));
      }

      chart.timeScale().fitContent();

      // Resize observer for main chart
      const ro = new ResizeObserver(entries => {
        for (const e of entries) {
          if (chartRef.current) chartRef.current.resize(e.contentRect.width, level === 'basic' ? 280 : 220);
        }
      });
      ro.observe(containerRef.current!);

      // MACD sub-chart
      if ((level === 'analysis' || level === 'expert') && macdData && macdContainerRef.current) {
        const macdChart = LightweightCharts.createChart(macdContainerRef.current, {
          width: macdContainerRef.current.clientWidth,
          height: 100,
          layout: {
            background: { type: LightweightCharts.ColorType.Solid, color: '#FFFFFF' },
            textColor: '#8B95A1',
            fontFamily: "'Pretendard Variable', sans-serif",
            fontSize: 10,
          },
          grid: { vertLines: { color: '#F2F4F6' }, horzLines: { color: '#F2F4F6' } },
          rightPriceScale: { borderColor: '#E5E8EB' },
          timeScale: { borderColor: '#E5E8EB', timeVisible: false },
        });
        macdChartRef.current = macdChart;

        // MACD histogram
        const histStart = raw.t.length - macdData.histogram.length;
        const histSeries = macdChart.addSeries(LightweightCharts.HistogramSeries, {
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        });
        histSeries.setData(macdData.histogram.map((v, i) => ({
          time: tsToDate(raw.t[histStart + i]) as string,
          value: v,
          color: v >= 0 ? 'rgba(239,68,82,0.4)' : 'rgba(49,130,246,0.4)',
        })));

        // MACD line
        const macdStart = raw.t.length - macdData.macd.length;
        const macdLineSeries = macdChart.addSeries(LightweightCharts.LineSeries, {
          color: '#3182F6',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        macdLineSeries.setData(macdData.macd.map((v, i) => ({
          time: tsToDate(raw.t[macdStart + i]) as string,
          value: v,
        })));

        // Signal line
        const signalStart = raw.t.length - macdData.signal.length;
        const signalLineSeries = macdChart.addSeries(LightweightCharts.LineSeries, {
          color: '#ffa726',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        signalLineSeries.setData(macdData.signal.map((v, i) => ({
          time: tsToDate(raw.t[signalStart + i]) as string,
          value: v,
        })));

        macdChart.timeScale().fitContent();

        const ro2 = new ResizeObserver(entries => {
          for (const e of entries) {
            if (macdChartRef.current) macdChartRef.current.resize(e.contentRect.width, 100);
          }
        });
        ro2.observe(macdContainerRef.current!);
      }

      // RSI sub-chart (analysis/expert)
      if ((level === 'analysis' || level === 'expert') && rsiData && rsiData.length && rsiContainerRef.current) {
        const rsiChart = LightweightCharts.createChart(rsiContainerRef.current, {
          width: rsiContainerRef.current.clientWidth,
          height: 80,
          layout: {
            background: { type: LightweightCharts.ColorType.Solid, color: '#FFFFFF' },
            textColor: '#8B95A1',
            fontFamily: "'Pretendard Variable', sans-serif",
            fontSize: 10,
          },
          grid: { vertLines: { color: '#F2F4F6' }, horzLines: { color: '#F2F4F6' } },
          rightPriceScale: { borderColor: '#E5E8EB' },
          timeScale: { borderColor: '#E5E8EB', timeVisible: false },
        });
        rsiChartRef.current = rsiChart;

        const rsiStart = raw.t.length - rsiData.length;
        const rsiLineSeries = rsiChart.addSeries(LightweightCharts.LineSeries, {
          color: '#a29bfe',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        rsiLineSeries.setData(rsiData.map((v, i) => ({
          time: tsToDate(raw.t[rsiStart + i]) as string,
          value: v,
        })));

        rsiChart.timeScale().fitContent();

        const ro3 = new ResizeObserver(entries => {
          for (const e of entries) {
            if (rsiChartRef.current) rsiChartRef.current.resize(e.contentRect.width, 80);
          }
        });
        ro3.observe(rsiContainerRef.current!);
      }

      return () => {
        ro.disconnect();
      };
    });

    return () => {
      isMounted = false;
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
      if (macdChartRef.current) { macdChartRef.current.remove(); macdChartRef.current = null; }
      if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null; }
    };
  }, [raw, sma5, sma20, sma60, level, bollingerBands, macdData, rsiData]);

  return (
    <div>
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />

      {(level === 'analysis' || level === 'expert') && macdData && (
        <>
          <div className="text-[11px] text-[#B0B8C1] mt-3 mb-1 font-medium">MACD</div>
          <div ref={macdContainerRef} className="w-full rounded-lg overflow-hidden" />
        </>
      )}

      {(level === 'analysis' || level === 'expert') && rsiData && rsiData.length > 0 && (
        <>
          <div className="text-[11px] text-[#B0B8C1] mt-3 mb-1 font-medium">RSI</div>
          <div ref={rsiContainerRef} className="w-full rounded-lg overflow-hidden" />
        </>
      )}

      <div className="flex gap-4 mt-2 text-[11px] text-[#8B95A1] justify-center flex-wrap">
        <span><span className="text-[#ffa726]">━</span> 20일</span>
        <span><span className="text-[#a29bfe]">━</span> 60일</span>
        {level === 'expert' && <span><span className="text-[#4fc3f7]">━</span> 5일</span>}
        {(level === 'analysis' || level === 'expert') && bollingerBands && (
          <span><span className="text-[#8B95A1]">┄</span> 볼린저</span>
        )}
      </div>
    </div>
  );
}
