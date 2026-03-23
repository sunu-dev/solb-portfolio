'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import { useStockData, useMacroData } from '@/hooks/useStockData';

export default function Header() {
  const { lastUpdate } = usePortfolioStore();
  const { refreshAll } = useStockData();
  const { fetchMacro } = useMacroData();

  const handleRefresh = async () => {
    await fetchMacro();
    await refreshAll();
  };

  return (
    <header className="sticky top-0 z-40 bg-white">
      <div className="flex items-center justify-between h-[52px] px-5">
        <h1 className="text-[18px] font-bold tracking-tight">
          <span className="text-[#3182F6]">SOLB</span>
          <span className="text-[#191F28]"> PORTFOLIO</span>
        </h1>
        <div className="flex items-center gap-1">
          {lastUpdate && (
            <span className="text-[11px] text-[#B0B8C1] mr-1">{lastUpdate}</span>
          )}
          <button onClick={handleRefresh} className="p-2 -mr-1 rounded-full hover:bg-[#F2F4F6] active:bg-[#E8EBED] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B95A1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('toggle-settings'))} className="p-2 -mr-2 rounded-full hover:bg-[#F2F4F6] active:bg-[#E8EBED] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B95A1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
