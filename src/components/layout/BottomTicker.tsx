'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import { MACRO_IND } from '@/config/constants';
import type { MacroEntry } from '@/config/constants';

export default function BottomTicker() {
  const { macroData } = usePortfolioStore();

  const items = MACRO_IND.map(ind => {
    const d = (macroData[ind.label] as MacroEntry) || {};
    const v = d.value;
    const change = d.change || 0;
    const cp = d.changePercent || 0;
    const isGain = cp >= 0;
    return { label: ind.label, value: v, change, cp, isGain };
  }).filter(item => {
    // Always show USD/KRW if available
    if (item.label === 'USD/KRW') return item.value != null;
    // Skip items with no real data (null, undefined, or 0 value with 0 change)
    if (item.value == null || (item.value === 0 && item.cp === 0)) return false;
    return true;
  });

  // Duplicate for seamless scrolling
  const tickerContent = [...items, ...items];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-white flex items-center overflow-hidden"
      style={{ height: '32px', borderTop: '1px solid #F2F4F6', fontSize: '12px' }}
    >
      {/* Label */}
      <div className="shrink-0 px-4 border-r border-[#F2F4F6] h-full flex items-center">
        <span className="text-[#8B95A1] font-medium whitespace-nowrap">실시간</span>
      </div>

      {/* Scrolling ticker */}
      <div className="flex-1 overflow-hidden">
        <div className="animate-ticker flex items-center whitespace-nowrap gap-6 px-4">
          {tickerContent.map((item, idx) => (
            <div key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5">
              <span className="text-[#8B95A1] font-medium">
                {item.label === 'NASDAQ' ? '나스닥' : item.label}
              </span>
              <span className="font-semibold text-[#191F28] tabular-nums">
                {item.value != null
                  ? typeof item.value === 'number'
                    ? item.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : item.value
                  : '--'}
              </span>
              <span className={`font-medium tabular-nums ${item.isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                {item.cp !== 0 ? `${item.isGain ? '+' : ''}${item.cp.toFixed(2)}%` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
