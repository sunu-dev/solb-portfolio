'use client';

import { useState, useCallback, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { searchStocks } from '@/hooks/useStockData';
import { STOCK_KR } from '@/config/constants';
import type { StockItem } from '@/config/constants';

export default function SearchBar() {
  const { apiKey, stocks, currentTab, addStock, updateMacroEntry } = usePortfolioStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ symbol: string; description: string }[]>([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (value.length < 1) { setShowResults(false); setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const items = await searchStocks(value, apiKey);
      setResults(items);
      setShowResults(items.length > 0);
    }, 300);
  }, [apiKey]);

  const handleAdd = useCallback(async (symbol: string, name: string) => {
    const sym = symbol.toUpperCase();
    for (const c in stocks) {
      if (stocks[c as keyof typeof stocks].some(s => s.symbol === sym)) {
        alert(`${sym} 이미 있습니다.`); return;
      }
    }
    if (name && !STOCK_KR[sym]) STOCK_KR[sym] = name;
    const ns: StockItem = { symbol: sym, avgCost: 0, shares: 0, targetReturn: 0 };
    if (currentTab === 'short') { ns.targetSell = 0; ns.stopLoss = 0; }
    else if (currentTab === 'long') { ns.buyZones = []; ns.weight = 0; }
    else { ns.buyBelow = 0; }
    addStock(currentTab, ns);
    setQuery(''); setShowResults(false); setResults([]);
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${apiKey}`);
      const d = await r.json();
      if (d?.c) updateMacroEntry(sym, d);
    } catch { /* silent */ }
  }, [apiKey, stocks, currentTab, addStock, updateMacroEntry]);

  return (
    <div className="relative mb-4">
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input type="text" value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="종목 검색"
          className="w-full pl-10 pr-4 py-2.5 bg-[#F2F4F6] rounded-xl text-[13px] text-[#191F28] placeholder-[#B0B8C1] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all"
        />
      </div>
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg overflow-hidden z-50">
          {results.map((item, idx) => (
            <button key={`${item.symbol}-${idx}`} onClick={() => handleAdd(item.symbol, item.description)}
              className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#F7F8FA] transition-colors text-left ${
                idx < results.length - 1 ? 'border-b border-[#F2F4F6]' : ''
              }`}>
              <span className="text-[14px] font-semibold text-[#191F28]">{item.symbol}</span>
              <span className="text-[12px] text-[#8B95A1] truncate ml-3 max-w-[180px]">{item.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
