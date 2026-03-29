'use client';

import { ATTRIBUTE_LABELS } from '@/utils/mentorScores';
import type { StockAttributes } from '@/utils/mentorScores';

interface Props {
  scores: StockAttributes;
}

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 70;
const LABEL_RADIUS = RADIUS + 35;
const LEVELS = 5;
const AXES = ATTRIBUTE_LABELS.length;

function polarToXY(angle: number, r: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}

export default function MentorRadar({ scores }: Props) {
  const values = ATTRIBUTE_LABELS.map(a => scores[a.key] || 3);
  const angleStep = 360 / AXES;

  // Grid hexagons
  const gridLines = Array.from({ length: LEVELS }, (_, level) => {
    const r = (RADIUS / LEVELS) * (level + 1);
    return ATTRIBUTE_LABELS.map((_, i) => polarToXY(i * angleStep, r).join(',')).join(' ');
  });

  // Data polygon
  const dataPoints = values.map((v, i) => {
    const r = (v / 5) * RADIUS;
    return polarToXY(i * angleStep, r).join(',');
  }).join(' ');

  // Average score
  const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
          종목 분석 레이더
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)' }}>
          종합 {avg}/5
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Grid */}
          {gridLines.map((points, i) => (
            <polygon
              key={i}
              points={points}
              fill={i === LEVELS - 1 ? 'var(--bg-subtle, #F8F9FA)' : 'none'}
              stroke="var(--border-light, #F2F4F6)"
              strokeWidth={1}
            />
          ))}

          {/* Axis lines */}
          {ATTRIBUTE_LABELS.map((_, i) => {
            const [x, y] = polarToXY(i * angleStep, RADIUS);
            return (
              <line
                key={i}
                x1={CENTER} y1={CENTER}
                x2={x} y2={y}
                stroke="var(--border-light, #E5E8EB)"
                strokeWidth={1}
              />
            );
          })}

          {/* Data polygon - filled */}
          <polygon
            points={dataPoints}
            fill="rgba(49, 130, 246, 0.1)"
            stroke="#3182F6"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {/* Data points */}
          {values.map((v, i) => {
            const r = (v / 5) * RADIUS;
            const [x, y] = polarToXY(i * angleStep, r);
            return (
              <circle
                key={i}
                cx={x} cy={y} r={3.5}
                fill="#3182F6"
                stroke="#fff"
                strokeWidth={2}
              />
            );
          })}

          {/* Labels */}
          {ATTRIBUTE_LABELS.map((attr, i) => {
            const [x, y] = polarToXY(i * angleStep, LABEL_RADIUS);
            const score = values[i];
            return (
              <g key={attr.key}>
                <text
                  x={x} y={y - 5}
                  textAnchor="middle"
                  style={{ fontSize: 15 }}
                >
                  {attr.icon}
                </text>
                <text
                  x={x} y={y + 9}
                  textAnchor="middle"
                  fill="var(--text-primary, #191F28)"
                  style={{ fontSize: 10, fontWeight: 600 }}
                >
                  {attr.label}
                </text>
                <text
                  x={x} y={y + 21}
                  textAnchor="middle"
                  fill={score >= 4 ? '#16A34A' : score <= 2 ? '#EF4452' : '#8B95A1'}
                  style={{ fontSize: 10, fontWeight: 700 }}
                >
                  {score}/5
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Score detail list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginTop: 8 }}>
        {ATTRIBUTE_LABELS.map((attr, i) => {
          const score = values[i];
          const color = score >= 4 ? '#16A34A' : score <= 2 ? '#EF4452' : 'var(--text-secondary, #8B95A1)';
          return (
            <div key={attr.key} className="flex items-center" style={{ gap: 6, fontSize: 11 }}>
              <span>{attr.icon}</span>
              <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>{attr.label}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color }}>{score}/5</span>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', textAlign: 'center', marginTop: 8 }}>
        기술 지표 기반 자동 산출 · 투자 권유가 아닌 참고 자료입니다
      </div>
    </div>
  );
}
