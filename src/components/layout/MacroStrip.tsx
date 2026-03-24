'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import { MACRO_IND } from '@/config/constants';
import type { MacroEntry } from '@/config/constants';

export default function MacroStrip() {
  const { macroData } = usePortfolioStore();

  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide py-3 mb-4 border-b border-[#F2F4F6]">
      {MACRO_IND.map((ind, idx) => {
        const d = (macroData[ind.label] as MacroEntry) || {};
        const v = d.value;
        const cp = d.changePercent || 0;
        const change = d.change || 0;
        const isGain = cp >= 0;

        return (
          <div key={ind.label} className="flex items-center shrink-0">
            <div className="px-5 py-1.5">
              <div className="text-[12px] text-[#8B95A1] font-medium whitespace-nowrap">{ind.label}</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-[15px] font-bold text-[#191F28] tabular-nums whitespace-nowrap">
                  {v != null ? (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v) : '--'}
                </span>
                <span className={`text-[12px] font-semibold tabular-nums whitespace-nowrap ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                  {isGain ? '+' : ''}{change.toLocaleString(undefined, { maximumFractionDigits: 2 })}({isGain ? '+' : ''}{cp.toFixed(2)}%)
                </span>
              </div>
            </div>
            {idx < MACRO_IND.length - 1 && (
              <div className="w-px h-8 bg-[#F2F4F6] shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
