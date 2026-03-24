'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { searchStocks } from '@/hooks/useStockData';
import { STOCK_KR } from '@/config/constants';
import type { StockItem } from '@/config/constants';
import { Search, Plus } from 'lucide-react';

interface SearchBarProps {
  onClose?: () => void;
}

export default function SearchBar({ onClose }: SearchBarProps) {
  const { apiKey, stocks, currentTab, addStock, updateMacroEntry } = usePortfolioStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ symbol: string; description: string }[]>([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-search-panel]')) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

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
    for (const c of ['investing', 'watching', 'sold'] as const) {
      if ((stocks[c] || []).some(s => s.symbol === sym)) {
        alert(`${sym} 이미 있습니다.`);
        return;
      }
    }
    if (name && !STOCK_KR[sym]) STOCK_KR[sym] = name;

    // Determine target category
    let targetCat: 'investing' | 'watching' | 'sold' = 'watching';
    if (currentTab === 'investing') targetCat = 'investing';
    else if (currentTab === 'sold') targetCat = 'sold';

    const ns: StockItem = { symbol: sym, avgCost: 0, shares: 0, targetReturn: 0 };
    if (targetCat === 'watching') ns.buyBelow = 0;

    addStock(targetCat, ns);
    setQuery('');
    setShowResults(false);
    setResults([]);
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${apiKey}`);
      const d = await r.json();
      if (d?.c) updateMacroEntry(sym, d);
    } catch { /* silent */ }
    if (onClose) onClose();
  }, [apiKey, stocks, currentTab, addStock, updateMacroEntry, onClose]);

  return (
    <div data-search-panel className="bg-white rounded-xl shadow-lg ring-1 ring-black/[0.06] overflow-hidden">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B0B8C1] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onKeyDown={(e) => { if (e.key === 'Escape' && onClose) onClose(); }}
          placeholder="종목명 또는 심볼 검색"
          className="w-full pl-10 pr-4 py-3 bg-white text-[14px] text-[#191F28] placeholder-[#B0B8C1] outline-none border-b border-[#F2F4F6]"
        />
      </div>

      {/* Results */}
      {showResults && results.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto">
          {results.map((item, idx) => (
            <button
              key={`${item.symbol}-${idx}`}
              onClick={() => handleAdd(item.symbol, item.description)}
              className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#F7F8FA] transition-colors text-left cursor-pointer ${
                idx < results.length - 1 ? 'border-b border-[#F2F4F6]' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F2F4F6] flex items-center justify-center">
                  <span className="text-[11px] font-bold text-[#4E5968]">{item.symbol.charAt(0)}</span>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#191F28]">{item.symbol}</div>
                  <div className="text-[11px] text-[#8B95A1] truncate max-w-[200px]">{item.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[#3182F6] shrink-0">
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold">추가</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {query.length > 0 && !showResults && results.length === 0 && (
        <div className="px-4 py-6 text-center text-[13px] text-[#8B95A1]">
          검색 결과가 없습니다
        </div>
      )}
    </div>
  );
}
