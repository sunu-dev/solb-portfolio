'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import type { MacroEntry } from '@/config/constants';

export default function MarketSummary() {
  const { macroData } = usePortfolioStore();

  const sp = macroData['S&P 500'] as MacroEntry | undefined;
  const nasdaq = macroData['NASDAQ'] as MacroEntry | undefined;
  const usdkrw = macroData['USD/KRW'] as MacroEntry | undefined;

  // No data yet
  if (!sp?.value && !nasdaq?.value) {
    return (
      <div className="bg-white" style={{ borderBottom: '1px solid #F2F4F6' }}>
      <div
        className="flex items-center mx-auto"
        style={{ maxWidth: '1400px', padding: '14px 24px', gap: '8px' }}
      >
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#F8F9FA', fontSize: '10px' }}
        >
          📊
        </div>
        <span style={{ fontSize: '14px', color: '#8B95A1', fontWeight: 500 }}>
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
    <div className="bg-white" style={{ borderBottom: '1px solid #F2F4F6' }}>
    <div
      className="flex items-center mx-auto"
      style={{ maxWidth: '1400px', padding: '14px 24px', gap: '8px' }}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#FFF0F0', fontSize: '10px' }}
      >
        📉
      </div>
      <span style={{ fontSize: '14px', color: '#191F28', fontWeight: 500, lineHeight: 1.5 }}>
        S&P 500{' '}
        <span className={`font-bold ${isDown(spCp) ? 'text-[#3182F6]' : 'text-[#EF4452]'}`}>
          {spCp >= 0 ? '+' : ''}{spCp.toFixed(2)}%
        </span>
        , 나스닥{' '}
        <span className={`font-bold ${isDown(nasdaqCp) ? 'text-[#3182F6]' : 'text-[#EF4452]'}`}>
          {nasdaqCp >= 0 ? '+' : ''}{nasdaqCp.toFixed(2)}%
        </span>
        {' '}&mdash; {sentiment}
        {krwVal > 0 && (
          <>, USD/KRW {krwVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}원</>
        )}
      </span>
    </div>
    </div>
  );
}
