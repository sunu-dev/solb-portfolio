"use client";

import { calcHealthScore, type HealthStock } from '@/utils/portfolioHealth';

export default function PortfolioHealth({ stocks }: { stocks: HealthStock[] }) {
  if (!stocks.length) return null;
  const health = calcHealthScore(stocks);
  const targetCount = stocks.filter(stock => stock.targetReturn > 0).length;
  const facts = [
    { title: '종목별 비중', value: health.concentration.detail.replace(/ — .*/, ''), description: '비중이 큰 종목의 변화가 전체 평가금액에 더 크게 반영돼요.' },
    { title: '사업 분야', value: health.sectorBreakdown.classifiable ? `${health.sectorBreakdown.topSector} ${health.sectorBreakdown.topSectorPct}%` : '일부 종목의 사업 분야 미확인', description: '대표 사업 기준의 간이 분류예요. ETF 안에 담긴 종목까지 나눈 결과는 아니에요.' },
    { title: '내가 정한 목표', value: `${stocks.length}개 중 ${targetCount}개에 기록했어요`, description: targetCount === stocks.length ? '목표는 내가 남긴 기준이에요. 기업의 실적이나 상황이 바뀌었는지 함께 살펴보세요.' : '목표를 기록하지 않은 상태예요. 이것만으로 투자 위험이 커졌다는 뜻은 아니에요.' },
  ];
  return <section data-slot="portfolio-health" style={{ marginBottom: 32, border: '1px solid var(--border-light)', borderRadius: 16, padding: 20 }}>
    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>내 투자 구성 살펴보기</h3>
    <p className="reading-copy" style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>종목의 비중과 기록한 기준을 함께 확인해요.</p>
    <dl style={{ marginTop: 12 }}>{facts.map(fact => <div key={fact.title} style={{ padding: '16px 0', borderTop: '1px solid var(--border-light)' }}>
      <dt style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>{fact.title}</dt>
      <dd style={{ margin: 0 }}><strong style={{ fontSize: 15 }}>{fact.value}</strong><p className="reading-copy" style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.7, marginTop: 6 }}>{fact.description}</p></dd>
    </div>)}</dl>
    <details style={{ borderTop: '1px solid var(--border-light)', fontSize: 13 }}>
      <summary style={{ minHeight: 44, padding: '12px 0', cursor: 'pointer', color: 'var(--text-secondary)' }}>기존 점수와 계산 기준</summary>
      <p className="reading-copy" style={{ color: 'var(--text-body)', lineHeight: 1.7 }}>참고 점수 {health.total}/100. 종목 집중도 30점, 사업 분야 분산 25점, 목표 설정·달성 25점, 현재 손익 구성 20점을 합친 값이에요. 투자 안전성이나 앞으로의 수익률을 평가한 점수는 아니에요.</p>
    </details>
  </section>;
}
