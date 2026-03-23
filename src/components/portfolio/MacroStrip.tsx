'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import { MACRO_IND } from '@/config/constants';
import type { MacroEntry } from '@/config/constants';

export default function MacroStrip() {
  const { macroData } = usePortfolioStore();

  return (
    <div className="mb-4 overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-0 min-w-max bg-white rounded-xl px-1 py-2">
        {MACRO_IND.map((ind, idx) => {
          const d = (macroData[ind.label] as MacroEntry) || {};
          const v = d.value;
          const cp = d.changePercent || 0;
          const isGain = cp >= 0;

          return (
            <div key={ind.label} className="flex items-center">
              <div className="px-3 py-1 text-center">
                <div className="text-[10px] text-[#8B95A1] font-medium whitespace-nowrap">{ind.label}</div>
                <div className="text-[13px] font-bold text-[#191F28] tracking-tight whitespace-nowrap">
                  {v != null ? (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : v) : '--'}
                </div>
                <div className={`text-[10px] font-semibold whitespace-nowrap ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                  {isGain ? '▲' : '▼'}{Math.abs(cp).toFixed(2)}%
                </div>
              </div>
              {idx < MACRO_IND.length - 1 && (
                <div className="w-[1px] h-6 bg-[#F2F4F6] flex-none" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
