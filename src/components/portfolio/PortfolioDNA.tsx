'use client';

import { useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { QuoteData } from '@/config/constants';
import { calcPortfolioDNA } from '@/utils/portfolioDNA';

/**
 * 포트폴리오 DNA — 캐릭터 타입 + 4축 레이더 + 태그
 * 컴팩트 버전 (Dashboard/RightSidebar에 삽입)
 */
export default function PortfolioDNA({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const { stocks, macroData } = usePortfolioStore();

  const dna = useMemo(() => {
    const investing = stocks.investing || [];
    const dnaStocks = investing
      .filter(s => s.avgCost > 0 && s.shares > 0)
      .map(s => {
        const q = macroData[s.symbol] as QuoteData | undefined;
        return {
          symbol: s.symbol,
          avgCost: s.avgCost,
          shares: s.shares,
          currentPrice: q?.c || 0,
          value: (q?.c || 0) * s.shares,
          targetReturn: s.targetReturn,
          dp: q?.dp,
        };
      });
    return calcPortfolioDNA(dnaStocks);
  }, [stocks.investing, macroData]);

  if (!dna) return null;

  const { type, axis, traits } = dna;

  if (variant === 'compact') {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12,
          background: 'var(--bg-subtle, #F8F9FA)',
        }}
      >
        <span style={{ fontSize: 28, lineHeight: 1 }}>{type.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
            {type.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {type.tagline}
          </div>
        </div>
      </div>
    );
  }

  // Full variant: 대형 캐릭터 + 레이더 + 설명
  return (
    <div
      style={{
        padding: '20px',
        borderRadius: 16,
        background: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border-light, #F2F4F6)',
        marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 14 }}>
        🧬 포트폴리오 DNA
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* 캐릭터 + 이름 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 120 }}>
          <div
            style={{
              fontSize: 64, lineHeight: 1,
              padding: 16, borderRadius: '50%',
              background: 'var(--bg-subtle, #F8F9FA)',
              border: '1px solid var(--border-light, #F2F4F6)',
            }}
            aria-hidden="true"
          >
            {type.emoji}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #191F28)', marginTop: 8 }}>
            {type.name}
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary, #B0B8C1)' }}>
            {type.tagline}
          </div>
        </div>

        {/* 4축 레이더 */}
        <RadarChart axis={axis} />
      </div>

      {/* 태그 */}
      {traits.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {traits.map(t => (
            <span
              key={t}
              style={{
                fontSize: 11, fontWeight: 600,
                padding: '3px 10px', borderRadius: 20,
                background: 'var(--color-info-bg, rgba(49,130,246,0.08))',
                color: 'var(--color-info, #3182F6)',
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* 설명 */}
      <div
        style={{
          marginTop: 14,
          padding: '12px 14px',
          borderRadius: 10,
          background: 'var(--bg-subtle, #F8F9FA)',
          fontSize: 12,
          color: 'var(--text-secondary, #4E5968)',
          lineHeight: 1.7,
          wordBreak: 'keep-all',
        }}
      >
        {type.description}
      </div>
    </div>
  );
}

// ─── 4축 레이더 차트 ─────────────────────────────────────────────────────────
function RadarChart({ axis }: { axis: { concentration: number; volatility: number; growth: number; defense: number } }) {
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 50;

  // 4개 축: 위(집중), 오른쪽(변동성), 아래(성장), 왼쪽(방어)
  // 각도: 위 = -90°, 오른쪽 = 0°, 아래 = 90°, 왼쪽 = 180°
  const points = [
    { angle: -90, value: axis.concentration, label: '집중' },
    { angle:   0, value: axis.volatility,    label: '변동성' },
    { angle:  90, value: axis.growth,        label: '성장' },
    { angle: 180, value: axis.defense,       label: '방어' },
  ];

  const toXY = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
  };

  // 데이터 polygon
  const polyPoints = points
    .map(p => {
      const r = (p.value / 100) * radius;
      const { x, y } = toXY(p.angle, r);
      return `${x},${y}`;
    })
    .join(' ');

  // 레퍼런스 polygon (100%)
  const refPoints = points.map(p => {
    const { x, y } = toXY(p.angle, radius);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        {/* 레퍼런스 격자 */}
        {[0.25, 0.5, 0.75, 1].map(k => (
          <polygon
            key={k}
            points={points.map(p => {
              const { x, y } = toXY(p.angle, radius * k);
              return `${x},${y}`;
            }).join(' ')}
            fill="none"
            stroke="var(--border-light, #F2F4F6)"
            strokeWidth="1"
          />
        ))}
        {/* 축 선 */}
        {points.map(p => {
          const { x, y } = toXY(p.angle, radius);
          return (
            <line
              key={p.label}
              x1={cx} y1={cy} x2={x} y2={y}
              stroke="var(--border-light, #F2F4F6)"
              strokeWidth="1"
            />
          );
        })}
        {/* 데이터 폴리곤 */}
        <polygon
          points={polyPoints}
          fill="var(--color-info-bg, rgba(49,130,246,0.15))"
          stroke="var(--color-info, #3182F6)"
          strokeWidth="1.5"
        />
        {/* 점 */}
        {points.map(p => {
          const r = (p.value / 100) * radius;
          const { x, y } = toXY(p.angle, r);
          return (
            <circle key={p.label} cx={x} cy={y} r={3} fill="var(--color-info, #3182F6)" />
          );
        })}
      </svg>
      {/* 라벨 — 레이더 외곽에 SVG 밖 HTML */}
      {points.map(p => {
        const { x, y } = toXY(p.angle, radius + 12);
        return (
          <div
            key={p.label}
            style={{
              position: 'absolute',
              left: `${(x / size) * 100}%`,
              top:  `${(y / size) * 100}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-tertiary, #B0B8C1)',
              whiteSpace: 'nowrap',
            }}
          >
            {p.label} <span style={{ color: 'var(--color-info, #3182F6)' }}>{p.value}</span>
          </div>
        );
      })}
    </div>
  );
}
