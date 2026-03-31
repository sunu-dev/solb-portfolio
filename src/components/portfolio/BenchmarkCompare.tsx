'use client';

import { useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { QuoteData, MacroEntry } from '@/config/constants';

export default function BenchmarkCompare() {
  const { stocks, macroData } = usePortfolioStore();

  const data = useMemo(() => {
    const investing = stocks.investing || [];
    if (investing.length === 0) return null;

    // 내 포트폴리오 총 수익률
    let totalCost = 0;
    let totalValue = 0;
    investing.forEach(s => {
      const q = macroData[s.symbol] as QuoteData | undefined;
      if (q?.c && s.avgCost > 0 && s.shares > 0) {
        totalCost += s.avgCost * s.shares;
        totalValue += q.c * s.shares;
      }
    });

    if (totalCost === 0) return null;
    const myReturn = ((totalValue - totalCost) / totalCost) * 100;

    // S&P 500 YTD (올해 초부터 지금까지)
    const sp = macroData['S&P 500'] as MacroEntry | undefined;
    const spReturn = sp?.changePercent || 0; // 일일 변동만 있으므로 간이 비교

    return { myReturn, spReturn, isWinning: myReturn > spReturn };
  }, [stocks, macroData]);

  if (!data) return null;

  const barMax = Math.max(Math.abs(data.myReturn), Math.abs(data.spReturn), 1);

  return (
    <div style={{
      padding: '16px 20px',
      borderRadius: 12,
      background: 'var(--bg-subtle, #F8F9FA)',
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 12 }}>
        시장 대비 내 성과
      </div>

      {/* 내 수익률 */}
      <div style={{ marginBottom: 10 }}>
        <div className="flex items-center justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>내 포트폴리오</span>
          <span style={{ fontWeight: 700, color: data.myReturn >= 0 ? '#EF4452' : '#3182F6' }}>
            {data.myReturn >= 0 ? '+' : ''}{data.myReturn.toFixed(2)}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--surface, #fff)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            borderRadius: 4,
            width: `${Math.min(Math.abs(data.myReturn) / barMax * 100, 100)}%`,
            background: data.myReturn >= 0 ? '#EF4452' : '#3182F6',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* S&P 500 */}
      <div style={{ marginBottom: 10 }}>
        <div className="flex items-center justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>S&P 500 (오늘)</span>
          <span style={{ fontWeight: 700, color: data.spReturn >= 0 ? '#EF4452' : '#3182F6' }}>
            {data.spReturn >= 0 ? '+' : ''}{data.spReturn.toFixed(2)}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--surface, #fff)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            borderRadius: 4,
            width: `${Math.min(Math.abs(data.spReturn) / barMax * 100, 100)}%`,
            background: data.spReturn >= 0 ? 'rgba(239,68,82,0.4)' : 'rgba(49,130,246,0.4)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* 결과 한 줄 */}
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', textAlign: 'center', marginTop: 4 }}>
        {data.isWinning
          ? '시장 평균보다 좋은 성과를 내고 있어요 👏'
          : '시장 평균에 비해 아쉬운 성과예요. 포트폴리오를 점검해보세요.'}
      </div>
    </div>
  );
}
