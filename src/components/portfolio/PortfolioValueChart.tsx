'use client';

import { useMemo, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';

type RangeKey = '1m' | '3m' | '6m' | '1y';
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '1m', label: '1개월', days: 30 },
  { key: '3m', label: '3개월', days: 90 },
  { key: '6m', label: '6개월', days: 180 },
  { key: '1y', label: '1년',   days: 365 },
];

/**
 * 포트폴리오 총 가치 시계열 차트 (retrospective)
 * - 현재 보유 수량 × 과거 일별 종가 = 가설적 포트폴리오 가치
 * - 실제 과거 매매 이력 반영 안 함 (근사치)
 */
export default function PortfolioValueChart() {
  const { stocks, macroData, rawCandles, currency } = usePortfolioStore();
  const [range, setRange] = useState<RangeKey>('3m');

  const chartData = useMemo(() => {
    const investing = (stocks.investing || []).filter(s => s.avgCost > 0 && s.shares > 0);
    if (investing.length === 0) return null;

    const rangeDays = RANGES.find(r => r.key === range)!.days;
    const cutoffTs = Date.now() / 1000 - rangeDays * 86400;

    // 공통 timestamp 세트 구성 (첫 종목의 timestamps 기준, 이후 교집합 체크)
    const firstSymbol = investing.find(s => rawCandles[s.symbol]?.t?.length);
    if (!firstSymbol) return null;
    const firstCandles = rawCandles[firstSymbol.symbol];

    // timestamps: cutoff 이후만
    const timestamps: number[] = [];
    for (const ts of firstCandles.t) {
      if (ts >= cutoffTs) timestamps.push(ts);
    }
    if (timestamps.length < 2) return null;

    // 각 timestamp에 대해 총 포트폴리오 가치 계산
    const values: Array<{ ts: number; value: number }> = [];
    for (const ts of timestamps) {
      let total = 0;
      let coverage = 0;
      for (const s of investing) {
        const c: CandleRaw | undefined = rawCandles[s.symbol];
        if (!c?.t?.length) continue;
        const idx = c.t.indexOf(ts);
        if (idx >= 0 && c.c[idx]) {
          total += c.c[idx] * s.shares;
          coverage++;
        }
      }
      if (coverage > investing.length * 0.5) values.push({ ts, value: total });
    }
    if (values.length < 2) return null;

    // 현재가 포인트 추가
    let nowValue = 0;
    let nowCoverage = 0;
    for (const s of investing) {
      const q = macroData[s.symbol] as QuoteData | undefined;
      if (q?.c) { nowValue += q.c * s.shares; nowCoverage++; }
    }
    if (nowCoverage > investing.length * 0.5) {
      values.push({ ts: Date.now() / 1000, value: nowValue });
    }

    const startValue = values[0].value;
    const endValue = values[values.length - 1].value;
    const minValue = Math.min(...values.map(v => v.value));
    const maxValue = Math.max(...values.map(v => v.value));
    const totalReturn = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
    const totalDelta = endValue - startValue;

    return {
      values,
      startValue,
      endValue,
      minValue,
      maxValue,
      totalReturn,
      totalDelta,
      coverage: nowCoverage / investing.length,
    };
  }, [stocks.investing, macroData, rawCandles, range]);

  if (!chartData) return null;

  const usdKrw = (macroData['USD/KRW'] as { value?: number } | undefined)?.value || 1400;
  const isGain = chartData.totalReturn >= 0;
  const accent = isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)';
  const accentBg = isGain ? 'var(--color-gain-bg, rgba(239,68,82,0.06))' : 'var(--color-loss-bg, rgba(49,130,246,0.06))';

  const fmt = (usd: number) => currency === 'KRW'
    ? formatKRW(Math.round(Math.abs(usd) * usdKrw))
    : `$${Math.abs(usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // SVG 파라미터
  const svgWidth = 600;
  const svgHeight = 180;
  const padX = 0;
  const padY = 12;

  const xScale = (i: number) => padX + (i / (chartData.values.length - 1)) * (svgWidth - padX * 2);
  const yRange = chartData.maxValue - chartData.minValue || 1;
  const yScale = (v: number) => padY + (1 - (v - chartData.minValue) / yRange) * (svgHeight - padY * 2);

  const pathD = chartData.values
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(2)} ${yScale(p.value).toFixed(2)}`)
    .join(' ');

  // 영역 fill path (하단 x축 포함)
  const fillPath = `${pathD} L ${xScale(chartData.values.length - 1).toFixed(2)} ${svgHeight - padY} L ${xScale(0).toFixed(2)} ${svgHeight - padY} Z`;

  // 시작/종료 날짜 라벨
  const startDate = new Date(chartData.values[0].ts * 1000);
  const endDate = new Date(chartData.values[chartData.values.length - 1].ts * 1000);
  const fmtDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

  return (
    <div
      style={{
        marginBottom: 32,
        padding: '20px',
        borderRadius: 16,
        background: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border-light, #F2F4F6)',
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 2 }}>
            📈 포트폴리오 가치 흐름
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
            현재 보유 수량 기준 회고 (과거 매매 반영 X)
          </div>
        </div>
        {/* 기간 선택 */}
        <div className="flex scrollbar-hide" style={{ gap: 4, overflowX: 'auto' }}>
          {RANGES.map(r => {
            const active = range === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                style={{
                  padding: '5px 11px', borderRadius: 16, fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#fff' : 'var(--text-secondary, #8B95A1)',
                  background: active ? 'var(--text-primary, #191F28)' : 'transparent',
                  border: `1px solid ${active ? 'var(--text-primary, #191F28)' : 'var(--border-light, #F2F4F6)'}`,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 주요 수치 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary, #191F28)' }}>
          {fmt(chartData.endValue)}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: accent,
          padding: '3px 10px', borderRadius: 10, background: accentBg,
        }}>
          {isGain ? '+' : '-'}{fmt(chartData.totalDelta)} ({isGain ? '+' : ''}{chartData.totalReturn.toFixed(2)}%)
        </span>
      </div>

      {/* SVG 차트 */}
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 180, display: 'block' }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="pv-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 영역 */}
          <path d={fillPath} fill="url(#pv-grad)" />

          {/* 라인 */}
          <path
            d={pathD}
            fill="none"
            stroke={accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 시작 / 종료 dot */}
          <circle
            cx={xScale(0)}
            cy={yScale(chartData.values[0].value)}
            r="3"
            fill="var(--surface, #FFFFFF)"
            stroke={accent}
            strokeWidth="2"
          />
          <circle
            cx={xScale(chartData.values.length - 1)}
            cy={yScale(chartData.endValue)}
            r="4"
            fill={accent}
          >
            <animate attributeName="r" values="4;6;4" dur="1.8s" repeatCount="indefinite" />
          </circle>

          {/* 제로 라인 (시작가) — 점선 */}
          <line
            x1={0}
            x2={svgWidth}
            y1={yScale(chartData.startValue)}
            y2={yScale(chartData.startValue)}
            stroke="var(--border-light, #F2F4F6)"
            strokeDasharray="3,3"
            strokeWidth="1"
          />
        </svg>

        {/* X축 라벨 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)' }}>
          <span>{fmtDate(startDate)}</span>
          <span>{fmtDate(endDate)} (오늘)</span>
        </div>
      </div>

      {/* 하단 정보 */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border-light, #F2F4F6)', fontSize: 11, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 2 }}>최고점</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{fmt(chartData.maxValue)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 2 }}>최저점</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{fmt(chartData.minValue)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 2 }}>데이터 포인트</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{chartData.values.length}일</div>
        </div>
        {chartData.coverage < 1 && (
          <div>
            <div style={{ color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 2 }}>커버리지</div>
            <div style={{ fontWeight: 700, color: 'var(--color-warning, #FF9500)' }}>{Math.round(chartData.coverage * 100)}%</div>
          </div>
        )}
      </div>
    </div>
  );
}
