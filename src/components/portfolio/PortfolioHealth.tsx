'use client';

import { STOCK_KR } from '@/config/constants';

interface HealthStock {
  symbol: string;
  avgCost: number;
  shares: number;
  targetReturn: number;
  currentPrice: number;
  value: number;
}

interface Props {
  stocks: HealthStock[];
}

// 섹터 추정 (심볼 기반 간이 분류)
const SECTOR_MAP: Record<string, string> = {
  NVDA: 'IT', AMD: 'IT', INTC: 'IT', MU: 'IT', AVGO: 'IT', QCOM: 'IT', TSM: 'IT',
  AAPL: 'IT', MSFT: 'IT', GOOG: 'IT', GOOGL: 'IT', META: 'IT', AMZN: '소비재',
  TSLA: '자동차', NFLX: '미디어', DIS: '미디어',
  JPM: '금융', V: '금융', MA: '금융', BAC: '금융', GS: '금융',
  JNJ: '헬스케어', UNH: '헬스케어', PFE: '헬스케어', ABBV: '헬스케어', LLY: '헬스케어',
  XOM: '에너지', CVX: '에너지', COP: '에너지',
  KO: '소비재', PEP: '소비재', PG: '소비재', WMT: '소비재', COST: '소비재',
};

function getSector(symbol: string): string {
  if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) return '한국주식';
  return SECTOR_MAP[symbol] || '기타';
}

function calcHealthScore(stocks: HealthStock[]): {
  total: number;
  concentration: { score: number; detail: string; color: string };
  diversification: { score: number; detail: string; color: string };
  goalSetting: { score: number; detail: string; color: string };
  profitBalance: { score: number; detail: string; color: string };
} {
  if (stocks.length === 0) {
    return {
      total: 0,
      concentration: { score: 0, detail: '종목 없음', color: '#B0B8C1' },
      diversification: { score: 0, detail: '종목 없음', color: '#B0B8C1' },
      goalSetting: { score: 0, detail: '종목 없음', color: '#B0B8C1' },
      profitBalance: { score: 0, detail: '종목 없음', color: '#B0B8C1' },
    };
  }

  const totalValue = stocks.reduce((s, st) => s + st.value, 0);

  // 1. 집중도 (30점) - 한 종목에 너무 몰려있으면 감점
  const weights = stocks.map(s => totalValue > 0 ? (s.value / totalValue) * 100 : 0);
  const maxWeight = Math.max(...weights);
  let concScore = 30;
  const topSymbol = stocks.length > 0 ? stocks.reduce((a, b) => a.value > b.value ? a : b).symbol : '';
  const topName = STOCK_KR[topSymbol] || topSymbol;
  let concDetail = `${stocks.length}개 종목에 고르게 분산 (최대 ${maxWeight.toFixed(0)}%)`;
  if (maxWeight > 70) { concScore = 5; concDetail = `${topName}에 ${maxWeight.toFixed(0)}% 집중 — 위험`; }
  else if (maxWeight > 50) { concScore = 15; concDetail = `${topName} 비중 ${maxWeight.toFixed(0)}% — 분산 필요`; }
  else if (maxWeight > 35) { concScore = 22; concDetail = `${topName} 비중 ${maxWeight.toFixed(0)}% — 적정 수준`; }

  // 2. 섹터 분산 (25점) - 다양한 섹터에 투자할수록 높음
  const sectors = new Set(stocks.map(s => getSector(s.symbol)));
  let divScore = 25;
  const sectorList = [...sectors];
  let divDetail = `${sectorList.join(', ')} 등 ${sectors.size}개 섹터`;
  if (sectors.size <= 1) { divScore = 5; divDetail = `${sectorList[0] || '알 수 없음'} 섹터에만 투자 중`; }
  else if (sectors.size === 2) { divScore = 15; divDetail = `${sectorList.join(', ')} 2개 섹터 — 더 분산 추천`; }

  // 3. 목표 설정 (25점) - 모든 종목에 목표수익률이 설정됐는지
  const withGoal = stocks.filter(s => s.targetReturn > 0).length;
  const goalRatio = stocks.length > 0 ? withGoal / stocks.length : 0;
  let goalScore = Math.round(goalRatio * 25);
  let goalDetail = goalRatio === 1
    ? `${stocks.length}개 종목 모두 목표 수익률 설정 완료`
    : `${stocks.length}개 중 ${withGoal}개 종목만 목표 설정됨`;

  // 4. 손익 밸런스 (20점) - 수익/손실 종목 비율
  let winCount = 0;
  stocks.forEach(s => {
    if (s.avgCost > 0 && s.currentPrice > s.avgCost) winCount++;
  });
  const winRate = stocks.length > 0 ? winCount / stocks.length : 0;
  let balScore = Math.round(winRate * 20);
  let balDetail = `승률 ${Math.round(winRate * 100)}% (${winCount}/${stocks.length})`;

  const total = concScore + divScore + goalScore + balScore;

  const scoreColor = (s: number, max: number) => {
    const ratio = s / max;
    if (ratio >= 0.8) return '#16A34A';
    if (ratio >= 0.5) return '#FF9500';
    return '#EF4452';
  };

  return {
    total,
    concentration: { score: concScore, detail: concDetail, color: scoreColor(concScore, 30) },
    diversification: { score: divScore, detail: divDetail, color: scoreColor(divScore, 25) },
    goalSetting: { score: goalScore, detail: goalDetail, color: scoreColor(goalScore, 25) },
    profitBalance: { score: balScore, detail: balDetail, color: scoreColor(balScore, 20) },
  };
}

function ScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#16A34A' : score >= 60 ? '#3182F6' : score >= 40 ? '#FF9500' : '#EF4452';
  const label = score >= 80 ? '건강' : score >= 60 ? '양호' : score >= 40 ? '주의' : '위험';

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
          <span style={{ fontSize: 11, fontWeight: 600, color, padding: '1px 6px', borderRadius: 4, background: color === '#16A34A' ? 'rgba(22,163,74,0.08)' : color === '#FF9500' ? 'rgba(255,149,0,0.08)' : 'rgba(239,68,82,0.08)' }}>
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
    <div style={{ marginBottom: 32, background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 16, padding: '20px 20px 12px' }}>
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
        if (health.goalSetting.score < 20) tips.push({ icon: '🎯', text: `${health.goalSetting.detail} — 목표 수익률을 설정하면 매도 타이밍을 잡기 쉬워요.` });
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
