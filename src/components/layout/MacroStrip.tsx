'use client';

import { useEffect, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { MACRO_IND } from '@/config/constants';
import type { MacroEntry } from '@/config/constants';
import type { FearGreedData } from '@/app/api/fear-greed/route';

// ─── Fear & Greed helpers ────────────────────────────────────────────────────
function fgColor(score: number): string {
  if (score <= 25) return '#EF4452';
  if (score <= 45) return '#FF9500';
  if (score <= 55) return '#F59E0B';
  if (score <= 75) return '#34C759';
  return '#00C6BE';
}

function fgBg(score: number): string {
  if (score <= 25) return 'rgba(239,68,82,0.08)';
  if (score <= 45) return 'rgba(255,149,0,0.08)';
  if (score <= 55) return 'rgba(245,158,11,0.08)';
  if (score <= 75) return 'rgba(52,199,89,0.08)';
  return 'rgba(0,198,190,0.08)';
}

// Mini 5-segment bar
function FgBar({ score }: { score: number }) {
  const segments = [
    { max: 25,  color: '#EF4452' },
    { max: 45,  color: '#FF9500' },
    { max: 55,  color: '#F59E0B' },
    { max: 75,  color: '#34C759' },
    { max: 100, color: '#00C6BE' },
  ];
  const pct = score / 100;

  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center', marginTop: 4 }}>
      {segments.map((seg, i) => {
        const segStart = i === 0 ? 0 : segments[i - 1].max;
        const segEnd   = seg.max;
        const filled   = score >= segEnd ? 1
          : score <= segStart ? 0
          : (score - segStart) / (segEnd - segStart);
        return (
          <div
            key={i}
            style={{
              height: 3,
              flex: 1,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${seg.color} ${filled * 100}%, rgba(0,0,0,0.08) ${filled * 100}%)`,
            }}
          />
        );
      })}
      {/* dot indicator */}
      <div style={{
        position: 'absolute',
        left: `${pct * 100}%`,
      }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MacroStrip() {
  const { macroData } = usePortfolioStore();
  const [fg, setFg] = useState<FearGreedData | null>(null);

  useEffect(() => {
    fetch('/api/fear-greed')
      .then(r => r.ok ? r.json() : null)
      .then((d: FearGreedData | null) => { if (d?.score) setFg(d); })
      .catch(() => {});
  }, []);

  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide py-3 mb-4 border-b border-[#F2F4F6] dark:border-[var(--border-light)]">
      {MACRO_IND.map((ind, idx) => {
        const d = (macroData[ind.label] as MacroEntry) || {};
        const v  = d.value;
        const cp = d.changePercent || 0;
        const change = d.change || 0;
        const isGain = cp >= 0;

        return (
          <div key={ind.label} className="flex items-center shrink-0">
            <div className="px-5 py-1.5">
              <div className="text-[12px] text-[#8B95A1] font-medium whitespace-nowrap dark:text-[var(--text-tertiary)]">
                {ind.label}
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-[15px] font-bold text-[#191F28] tabular-nums whitespace-nowrap dark:text-[var(--text-primary)]">
                  {v != null ? (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v) : '--'}
                </span>
                <span className={`text-[12px] font-semibold tabular-nums whitespace-nowrap ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                  {isGain ? '+' : ''}{change.toLocaleString(undefined, { maximumFractionDigits: 2 })}({isGain ? '+' : ''}{cp.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className="w-px h-8 bg-[#F2F4F6] dark:bg-[var(--border-light)] shrink-0" />
          </div>
        );
      })}

      {/* ── Fear & Greed Index ── */}
      {fg ? (
        <div className="flex items-center shrink-0">
          <div className="px-5 py-1.5" style={{ minWidth: 110 }}>
            <div className="text-[12px] text-[#8B95A1] font-medium whitespace-nowrap dark:text-[var(--text-tertiary)]">
              공포탐욕지수
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-[15px] font-bold tabular-nums"
                style={{ color: fgColor(fg.score) }}
              >
                {fg.score}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: fgColor(fg.score),
                  background: fgBg(fg.score),
                  padding: '1px 6px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                {fg.ratingKr}
              </span>
            </div>
            <FgBar score={fg.score} />
            {fg.previousClose !== null && (
              <div style={{ fontSize: 10, color: '#B0B8C1', marginTop: 2 }}>
                전일 {fg.previousClose} · CNN
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 로딩 중 placeholder — 레이아웃 흔들림 방지 */
        <div className="flex items-center shrink-0">
          <div className="px-5 py-1.5" style={{ minWidth: 110 }}>
            <div className="text-[12px] text-[#8B95A1] font-medium">공포탐욕지수</div>
            <div style={{ height: 20, width: 80, background: '#F2F4F6', borderRadius: 4, marginTop: 4 }} />
          </div>
        </div>
      )}
    </div>
  );
}
