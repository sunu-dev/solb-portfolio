'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { searchStocks } from '@/hooks/useStockData';
import { STOCK_KR } from '@/config/constants';
import type { StockItem } from '@/config/constants';
import { Search, Plus } from 'lucide-react';
import { logApiCall } from '@/lib/apiLogger';

interface SearchBarProps {
  onClose?: () => void;
}

export default function SearchBar({ onClose }: SearchBarProps) {
  const { apiKey, stocks, currentTab, addStock, updateMacroEntry } = usePortfolioStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ symbol: string; description: string }[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
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
      // Search both US (Finnhub) and KR (local API) stocks
      const [usItems, krItems] = await Promise.all([
        searchStocks(value, apiKey),
        fetch('/api/kr-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: value }) })
          .then(r => r.json())
          .then(d => (d.results || []).map((r: { symbol: string; name: string }) => ({ symbol: r.symbol, description: `${r.name} (KRX)` })))
          .catch(() => []),
      ]);
      const combined = [...krItems, ...usItems];
      setResults(combined.slice(0, 8));
      setShowResults(combined.length > 0);
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
    logApiCall('stock_add', sym);
    setQuery('');
    setShowResults(false);
    setResults([]);
    try {
      if (sym.endsWith('.KS') || sym.endsWith('.KQ')) {
        // Korean stock — use our API route
        const r = await fetch(`/api/kr-quote?symbol=${sym}`);
        const d = await r.json();
        if (d?.c) updateMacroEntry(sym, d);
      } else {
        // US stock — use Finnhub
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${apiKey}`);
        const d = await r.json();
        if (d?.c) updateMacroEntry(sym, d);
      }
    } catch { /* silent */ }
    if (onClose) onClose();
  }, [apiKey, stocks, currentTab, addStock, updateMacroEntry, onClose]);

  return (
    <div
      data-search-panel
      style={{
        background: 'white',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        border: '1px solid #F2F4F6',
        overflow: 'hidden',
      }}
    >
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <Search
          style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 18,
            height: 18,
            color: '#B0B8C1',
            pointerEvents: 'none',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onBlur={() => setTimeout(() => setShowResults(false), 400)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onKeyDown={(e) => { if (e.key === 'Escape' && onClose) onClose(); }}
          placeholder="종목명 또는 심볼 검색"
          style={{
            width: '100%',
            padding: '14px 16px 14px 44px',
            fontSize: 16,
            border: 'none',
            outline: 'none',
            background: 'white',
            color: '#191F28',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Results */}
      {showResults && results.length > 0 && (
        <div style={{ maxHeight: 'min(320px, calc(100vh - 160px))', overflowY: 'auto' }}>
          {results.map((item, idx) => (
            <button
              key={`${item.symbol}-${idx}`}
              onClick={() => handleAdd(item.symbol, item.description)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '14px 20px',
                borderTop: '1px solid #F7F8FA',
                border: 'none',
                borderTopStyle: 'solid',
                borderTopWidth: 1,
                borderTopColor: '#F7F8FA',
                cursor: 'pointer',
                background: hoveredIdx === idx ? '#F9FAFB' : 'white',
                textAlign: 'left',
                boxSizing: 'border-box',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#F2F4F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#4E5968' }}>
                    {item.symbol.charAt(0)}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#191F28' }}>
                    {item.symbol}
                  </div>
                  <div style={{ fontSize: 12, color: '#8B95A1', marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.description}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Plus style={{ width: 14, height: 14, color: '#3182F6' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#3182F6' }}>추가</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {query.length > 0 && !showResults && results.length === 0 && (
        <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: '#8B95A1' }}>
          검색 결과가 없습니다
        </div>
      )}
    </div>
  );
}
