'use client';

import { useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';

/**
 * Stock Pulse — 종목별 최근 30일 가격을 ECG(심전도) 파형으로 시각화
 *
 * 디자인 의도:
 * - 숫자 나열 대신 "살아있는" 포트폴리오 느낌
 * - 변동성 큰 종목일수록 파형이 날카로움
 * - 수익 종목은 빨강 파형, 손실은 파랑
 * - 맥박 애니메이션으로 실시간성 강조
 */
export default function StockPulse() {
  const { stocks, macroData, rawCandles, setAnalysisSymbol } = usePortfolioStore();

  const pulses = useMemo(() => {
    const investing = (stocks.investing || []).filter(s => s.avgCost > 0 && s.shares > 0);
    return investing
      .map(s => {
        const candles: CandleRaw | undefined = rawCandles[s.symbol];
        const q = macroData[s.symbol] as QuoteData | undefined;
        if (!candles?.c?.length || !q?.c) return null;

        // 최근 30일 종가 추출
        const cutoffTs = Date.now() / 1000 - 30 * 86400;
        const recent: number[] = [];
        for (let i = 0; i < candles.t.length; i++) {
          if (candles.t[i] >= cutoffTs && candles.c[i]) recent.push(candles.c[i]);
        }
        if (recent.length < 5) return null;

        // 현재가 포함
        recent.push(q.c);

        // 정규화 (0~1)
        const min = Math.min(...recent);
        const max = Math.max(...recent);
        const range = max - min || 1;
        const normalized = recent.map(p => (p - min) / range);

        // 변동성 (표준편차 기반 — 파형 "날카로움" 척도)
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length;
        const stddev = Math.sqrt(variance);
        const volatilityPct = (stddev / mean) * 100;

        // 전체 기간 추세 (첫값 → 마지막값)
        const periodReturn = ((recent[recent.length - 1] - recent[0]) / recent[0]) * 100;

        // 유저 P&L (현재가 vs 평균 매수가) — 색상 결정
        const userPL = s.avgCost > 0 ? ((q.c - s.avgCost) / s.avgCost) * 100 : 0;

        return {
          symbol: s.symbol,
          points: normalized,
          current: q.c,
          volatilityPct,
          periodReturn,
          userPL,
        };
      })
      .filter(Boolean) as Array<{
        symbol: string;
        points: number[];
        current: number;
        volatilityPct: number;
        periodReturn: number;
        userPL: number;
      }>;
  }, [stocks.investing, macroData, rawCandles]);

  if (pulses.length === 0) return null;

  return (
    <div
      style={{
        marginBottom: 32,
        padding: '20px',
        background: 'var(--surface, #FFFFFF)',
        borderRadius: 16,
        border: '1px solid var(--border-light, #F2F4F6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
            💓 종목 맥박
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600, color: 'var(--color-danger, #EF4452)',
            padding: '2px 8px', borderRadius: 10,
            background: 'var(--color-danger-bg, rgba(239,68,82,0.08))',
          }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: 'var(--color-danger, #EF4452)',
              animation: 'pulse-heart 1.2s ease-in-out infinite',
            }} />
            LIVE
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
          최근 30일 · 수익색=내 손익
        </span>
      </div>

      <style>{`
        @keyframes pulse-heart {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(1.4); }
        }
        @keyframes pulse-draw {
          0%   { stroke-dashoffset: 1000; opacity: 0; }
          10%  { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pulses.map(p => (
          <PulseRow key={p.symbol} pulse={p} onClick={() => setAnalysisSymbol(p.symbol)} />
        ))}
      </div>
    </div>
  );
}

// ─── 한 행 (종목 하나) ───────────────────────────────────────────────────────
function PulseRow({
  pulse, onClick,
}: {
  pulse: {
    symbol: string;
    points: number[];
    current: number;
    volatilityPct: number;
    periodReturn: number;
    userPL: number;
  };
  onClick: () => void;
}) {
  const { symbol, points, current, volatilityPct, periodReturn, userPL } = pulse;
  const kr = STOCK_KR[symbol] || symbol;
  const avatarColor = getAvatarColor(symbol);

  // 유저 P&L 기반 색 (빨강=수익, 파랑=손실)
  const isPL_Positive = userPL >= 0;
  const waveColor = isPL_Positive ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)';
  const waveBg = isPL_Positive ? 'var(--color-gain-bg, rgba(239,68,82,0.08))' : 'var(--color-loss-bg, rgba(49,130,246,0.08))';

  // 변동성 라벨
  const volLabel =
    volatilityPct > 8 ? { text: '격동', color: '#EF4452' }
    : volatilityPct > 4 ? { text: '활발', color: '#FF9500' }
    : volatilityPct > 2 ? { text: '보통', color: '#20C997' }
    : { text: '안정', color: '#8B95A1' };

  // SVG 파형 생성
  const svgWidth = 200;
  const svgHeight = 40;
  const padY = 4;
  const pathD = points
    .map((y, i) => {
      const x = (i / (points.length - 1)) * svgWidth;
      const invertedY = svgHeight - padY - y * (svgHeight - padY * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${invertedY.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onClick(); }}
      className="cursor-pointer"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 12,
        background: 'var(--bg-subtle, #F8F9FA)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover, #F2F4F6)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle, #F8F9FA)')}
    >
      {/* 아바타 */}
      <div
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{symbol.charAt(0)}</span>
      </div>

      {/* 종목명 */}
      <div style={{ minWidth: 72, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #191F28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {kr}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)' }}>
          ${current.toFixed(2)}
        </div>
      </div>

      {/* 파형 (ECG) */}
      <div style={{ flex: 1, minWidth: 0, background: waveBg, borderRadius: 8, padding: '4px 6px' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: svgHeight, display: 'block' }} preserveAspectRatio="none">
          <path
            d={pathD}
            fill="none"
            stroke={waveColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 1000,
              strokeDashoffset: 0,
              animation: 'pulse-draw 1.8s ease-out',
            }}
          />
          {/* 끝점 dot (맥박 뜀) */}
          <circle
            cx={svgWidth}
            cy={svgHeight - 4 - points[points.length - 1] * (svgHeight - 8)}
            r="3"
            fill={waveColor}
          >
            <animate
              attributeName="r"
              values="3;5;3"
              dur="1.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="1;0.5;1"
              dur="1.4s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      </div>

      {/* 변동성 라벨 */}
      <div style={{ textAlign: 'right', minWidth: 60, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: volLabel.color }}>
          {volLabel.text}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', fontVariantNumeric: 'tabular-nums' }}>
          σ {volatilityPct.toFixed(1)}%
        </div>
      </div>

      {/* 30일 수익률 */}
      <div style={{ textAlign: 'right', minWidth: 56, flexShrink: 0 }}>
        <div
          style={{
            fontSize: 12, fontWeight: 700,
            color: periodReturn >= 0 ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
          }}
        >
          {periodReturn >= 0 ? '+' : ''}{periodReturn.toFixed(1)}%
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-tertiary, #B0B8C1)' }}>30일</div>
      </div>
    </div>
  );
}
