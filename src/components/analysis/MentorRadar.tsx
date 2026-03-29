'use client';

import { MENTORS } from '@/config/mentors';
import type { MentorScores } from '@/utils/mentorScores';

interface Props {
  scores: MentorScores;
  onSelectMentor: (mentorId: string) => void;
}

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 80;
const LABEL_RADIUS = RADIUS + 28;
const LEVELS = 5;

function polarToXY(angle: number, r: number): [number, number] {
  // Start from top (270°), go clockwise
  const rad = ((angle - 90) * Math.PI) / 180;
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}

export default function MentorRadar({ scores, onSelectMentor }: Props) {
  const mentorIds = MENTORS.map(m => m.id);
  const scoreMap: Record<string, number> = { ...scores };
  const values = mentorIds.map(id => scoreMap[id] || 3);
  const angleStep = 360 / mentorIds.length;

  // Grid lines (pentagon levels)
  const gridLines = Array.from({ length: LEVELS }, (_, level) => {
    const r = (RADIUS / LEVELS) * (level + 1);
    const points = mentorIds.map((_, i) => polarToXY(i * angleStep, r).join(',')).join(' ');
    return points;
  });

  // Data polygon
  const dataPoints = values.map((v, i) => {
    const r = (v / 5) * RADIUS;
    return polarToXY(i * angleStep, r).join(',');
  }).join(' ');

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>
        관점별 적합도
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 12 }}>
        6가지 투자 관점에서 본 이 종목의 적합도예요
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Grid */}
          {gridLines.map((points, i) => (
            <polygon
              key={i}
              points={points}
              fill="none"
              stroke="var(--border-light, #F2F4F6)"
              strokeWidth={1}
            />
          ))}

          {/* Axis lines */}
          {mentorIds.map((_, i) => {
            const [x, y] = polarToXY(i * angleStep, RADIUS);
            return (
              <line
                key={i}
                x1={CENTER} y1={CENTER}
                x2={x} y2={y}
                stroke="var(--border-light, #F2F4F6)"
                strokeWidth={1}
              />
            );
          })}

          {/* Data polygon */}
          <polygon
            points={dataPoints}
            fill="rgba(49, 130, 246, 0.12)"
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
                cx={x} cy={y} r={4}
                fill="#3182F6"
                stroke="#fff"
                strokeWidth={2}
              />
            );
          })}

          {/* Labels (clickable) */}
          {MENTORS.map((m, i) => {
            const [x, y] = polarToXY(i * angleStep, LABEL_RADIUS);
            const score = values[i];
            return (
              <g
                key={m.id}
                onClick={() => onSelectMentor(m.id)}
                style={{ cursor: 'pointer' }}
              >
                <text
                  x={x} y={y - 6}
                  textAnchor="middle"
                  style={{ fontSize: 18 }}
                >
                  {m.icon}
                </text>
                <text
                  x={x} y={y + 10}
                  textAnchor="middle"
                  fill="var(--text-secondary, #8B95A1)"
                  style={{ fontSize: 9, fontWeight: 600 }}
                >
                  {m.nameKr}
                </text>
                <text
                  x={x} y={y + 21}
                  textAnchor="middle"
                  fill={m.color}
                  style={{ fontSize: 10, fontWeight: 700 }}
                >
                  {score}/5
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', textAlign: 'center', marginTop: 4 }}>
        각 관점을 탭하면 상세 분석을 볼 수 있어요 · AI 참고 점수이며 투자 권유가 아닙니다
      </div>
    </div>
  );
}
