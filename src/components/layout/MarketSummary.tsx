'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import type { MacroEntry } from '@/config/constants';
import { getMarketStatus } from '@/utils/marketStatus';

export default function MarketSummary() {
  const { macroData } = usePortfolioStore();

  const sp = macroData['S&P 500'] as MacroEntry | undefined;
  const nasdaq = macroData['NASDAQ'] as MacroEntry | undefined;
  const usdkrw = macroData['USD/KRW'] as MacroEntry | undefined;

  // No data yet
  if (!sp?.value && !nasdaq?.value) {
    return (
      <div style={{ background: 'var(--surface, white)', borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
      <div
        className="flex items-center mx-auto market-summary-bar"
        style={{ maxWidth: '1200px', padding: '14px 48px', gap: '8px' }}
      >
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-subtle, #F8F9FA)', fontSize: '10px' }}
        >
          📊
        </div>
        <span className="market-summary-text" style={{ fontSize: '14px', color: '#8B95A1', fontWeight: 500 }}>
          시장 데이터를 불러오는 중...
        </span>
      </div>
      </div>
    );
  }

  // Build summary text
  const spCp = sp?.changePercent || 0;
  const nasdaqCp = nasdaq?.changePercent || 0;
  const krwVal = usdkrw?.value || 0;

  // Determine overall sentiment
  const avgChange = (spCp + nasdaqCp) / 2;
  let sentiment = '보합세';
  if (avgChange < -1) sentiment = '기술주 중심 하락세';
  else if (avgChange < 0) sentiment = '소폭 하락세';
  else if (avgChange > 1) sentiment = '상승세';
  else if (avgChange > 0) sentiment = '소폭 상승세';

  const isDown = (v: number) => v < 0;

  return (
    <div style={{ background: 'var(--surface, white)', borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
    <div
      className="flex items-center mx-auto market-summary-bar"
      style={{ maxWidth: '1200px', padding: '14px 48px', gap: '8px', overflow: 'hidden' }}
    >
      <style>{`
        @media (max-width: 1024px) {
          .market-summary-bar { padding: 10px 24px !important; }
        }
        @media (max-width: 768px) {
          .market-summary-bar { padding: 8px 16px !important; }
          .market-summary-text { font-size: 12px !important; }
          .market-usdkrw { display: none !important; }
        }
        @media (max-width: 400px) {
          .market-summary-text { font-size: 11px !important; }
          .market-sentiment { display: none !important; }
        }
      `}</style>
      <span className="market-summary-text" style={{ fontSize: '13px', color: 'var(--text-primary, #191F28)', fontWeight: 500, lineHeight: 1.5 }}>
        S&P 500{' '}
        <span className={`font-bold ${isDown(spCp) ? 'text-[#3182F6]' : 'text-[#EF4452]'}`}>
          {spCp >= 0 ? '+' : ''}{spCp.toFixed(2)}%
        </span>
        {' '}나스닥{' '}
        <span className={`font-bold ${isDown(nasdaqCp) ? 'text-[#3182F6]' : 'text-[#EF4452]'}`}>
          {nasdaqCp >= 0 ? '+' : ''}{nasdaqCp.toFixed(2)}%
        </span>
        <span className="market-sentiment">{' '}&mdash; {sentiment}</span>
        {krwVal > 0 && (() => {
          const krwCp = usdkrw?.changePercent || 0;
          const krwWeakening = krwCp > 0;
          return (
            <span className="market-usdkrw">
              {' '}· 환율 {krwVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}원{' '}
              <span style={{ fontWeight: 700, color: krwWeakening ? '#EF4452' : '#3182F6' }}>
                {krwWeakening ? '▲' : '▼'}{Math.abs(krwCp).toFixed(1)}%
              </span>
            </span>
          );
        })()}
      </span>
      {(() => {
        const ms = getMarketStatus();
        return (
          <span className="shrink-0 hidden md:inline-flex items-center" style={{ fontSize: '11px', marginLeft: 'auto', gap: 4 }}>
            <span style={{ color: ms.kr.color, fontWeight: 600 }}>🇰🇷{ms.kr.dot}{ms.kr.labelSimple}</span>
            <span style={{ color: 'var(--text-tertiary, #B0B8C1)' }}>{ms.kr.nextEvent}</span>
            <span style={{ color: 'var(--text-tertiary, #B0B8C1)' }}>·</span>
            <span style={{ color: ms.us.color, fontWeight: 600 }}>🇺🇸{ms.us.dot}{ms.us.labelSimple}</span>
            <span style={{ color: 'var(--text-tertiary, #B0B8C1)' }}>{ms.us.nextEvent}</span>
            <span style={{ color: 'var(--text-tertiary, #B0B8C1)' }}>· 15분 지연</span>
          </span>
        );
      })()}
    </div>
    </div>
  );
}
