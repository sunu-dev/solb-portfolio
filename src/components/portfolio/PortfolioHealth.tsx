'use client';

import { calcHealthScore, getHealthColor, getHealthLabel, type HealthStock } from '@/utils/portfolioHealth';

interface Props {
  stocks: HealthStock[];
}

function ScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getHealthColor(score);
  const label = getHealthLabel(score);

  return (
    <div style={{ position: 'relative', width: 100, height: 100 }}>
      <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border-light, #F2F4F6)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #8B95A1)', marginTop: 2 }}>{label}</span>
      </div>
    </div>
  );
}

function getScoreLabel(score: number, max: number): string {
  const ratio = score / max;
  if (ratio >= 0.8) return '건강';
  if (ratio >= 0.5) return '주의';
  return '위험';
}

function MetricRow({ label, score, max, detail, color }: { label: string; score: number; max: number; detail: string; color: string }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const statusLabel = getScoreLabel(score, max);
  const ratio = max > 0 ? score / max : 0;
  const bgVar = ratio >= 0.8
    ? 'var(--color-success-bg, rgba(22,163,74,0.08))'
    : ratio >= 0.5
      ? 'var(--color-warning-bg, rgba(255,149,0,0.08))'
      : 'var(--color-danger-bg, rgba(239,68,82,0.08))';
  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 70, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', flexShrink: 0 }}>{label}</div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-subtle, #F2F4F6)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.7s ease-out' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color, padding: '1px 6px', borderRadius: 4, background: bgVar }}>
            {statusLabel}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', width: 32, textAlign: 'right' }}>{score}/{max}</span>
        </div>
      </div>
      <div style={{ marginTop: 4, paddingLeft: 82, fontSize: 11, color: 'var(--text-tertiary, #8B95A1)', lineHeight: 1.4 }}>
        {detail}
      </div>
    </div>
  );
}

export default function PortfolioHealth({ stocks }: Props) {
  const health = calcHealthScore(stocks);

  if (stocks.length === 0) return null;

  return (
    <div data-slot="portfolio-health" style={{ marginBottom: 32, background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 16, padding: '20px 20px 12px' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 16 }}>포트폴리오 건강 점수</div>

      <div className="health-layout" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <style>{`
          @media (max-width: 768px) {
            .health-layout { flex-direction: column !important; align-items: center !important; }
            .health-layout > div:first-child { margin-bottom: 8px; }
          }
        `}</style>
        <ScoreRing score={health.total} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <MetricRow label="집중도" score={health.concentration.score} max={30} detail={health.concentration.detail} color={health.concentration.color} />
          <MetricRow label="섹터 분산" score={health.diversification.score} max={25} detail={health.diversification.detail} color={health.diversification.color} />
          <MetricRow label="목표 설정" score={health.goalSetting.score} max={25} detail={health.goalSetting.detail} color={health.goalSetting.color} />
          <MetricRow label="손익 밸런스" score={health.profitBalance.score} max={20} detail={health.profitBalance.detail} color={health.profitBalance.color} />
        </div>
      </div>

      {/* 개선 제안 */}
      {(() => {
        const tips: { icon: string; text: string }[] = [];
        if (health.concentration.score < 15) tips.push({ icon: '⚠️', text: `${health.concentration.detail}. 분산 투자를 고려해보세요.` });
        if (health.diversification.score < 15) tips.push({ icon: '💡', text: `${health.diversification.detail}. 다른 섹터 종목을 추가해보세요.` });
        if (health.goalSetting.score < 20) tips.push({ icon: '🎯', text: `${health.goalSetting.detail} — 목표 수익률을 설정하면 매도 시점을 판단하기 쉬워요.` });
        if (health.profitBalance.score < 10) tips.push({ icon: '📉', text: `${health.profitBalance.detail} — 손절 기준을 점검해보세요.` });
        if (tips.length === 0 && health.total >= 80) tips.push({ icon: '🎉', text: '포트폴리오가 잘 관리되고 있어요!' });
        if (tips.length === 0 && health.total >= 60) tips.push({ icon: '👍', text: '전반적으로 양호해요. 약한 부분을 보완하면 더 좋아져요.' });
        if (tips.length === 0) tips.push({ icon: '🔍', text: '포트폴리오 구성을 점검해보세요.' });

        return (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--surface, #FFFFFF)', fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0 }}>{tip.icon}</span>
                <span>{tip.text}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
