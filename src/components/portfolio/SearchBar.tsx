'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { searchStocks } from '@/hooks/useStockData';
import { STOCK_KR } from '@/config/constants';
import type { StockItem } from '@/config/constants';
import { Search, Plus, Clock, X } from 'lucide-react';
import { logApiCall } from '@/lib/apiLogger';
import { useAuth } from '@/hooks/useAuth';

const RECENT_KEY = 'solb_recent_searches';
const MAX_RECENT = 5;

function getRecent(): { symbol: string; description: string }[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

function saveRecent(item: { symbol: string; description: string }) {
  const list = getRecent().filter(r => r.symbol !== item.symbol);
  list.unshift(item);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

function removeRecent(symbol: string) {
  const list = getRecent().filter(r => r.symbol !== symbol);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

interface SearchBarProps {
  onClose?: () => void;
}

export default function SearchBar({ onClose }: SearchBarProps) {
  const { user } = useAuth();
  const { apiKey, stocks, currentTab, addStock, updateMacroEntry, setEditingCat, setEditingIdx } = usePortfolioStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ symbol: string; description: string }[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [recent, setRecent] = useState<{ symbol: string; description: string }[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setRecent(getRecent());
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-search-panel]')) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // 한국어 이름 → 티커 역방향 맵 (로컬 즉시 매칭용)
  const krToTicker = useCallback(() => {
    const map: { symbol: string; description: string }[] = [];
    for (const [sym, name] of Object.entries(STOCK_KR)) {
      map.push({ symbol: sym, description: name });
    }
    return map;
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (value.length < 1) {
      setShowResults(false);
      setResults([]);
      setShowRecent(true);
      return;
    }
    setShowRecent(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const q = value.trim().toLowerCase();
      const hasKorean = /[가-힣]/.test(q);

      // 한국어 입력 시 로컬 STOCK_KR에서 먼저 부분 매칭
      const localMatches = hasKorean
        ? krToTicker().filter(({ description }) => description.toLowerCase().includes(q))
        : [];

      const [usItems, krItems] = await Promise.all([
        searchStocks(value, apiKey),
        fetch('/api/kr-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: value }) })
          .then(r => r.json())
          .then(d => (d.results || []).map((r: { symbol: string; name: string }) => ({ symbol: r.symbol, description: `${r.name} (KRX)` })))
          .catch(() => []),
      ]);

      // 로컬 매칭 → KRX → Finnhub 순서, 중복 제거
      const seen = new Set<string>();
      const combined: { symbol: string; description: string }[] = [];
      for (const item of [...localMatches, ...krItems, ...usItems]) {
        if (!seen.has(item.symbol)) {
          seen.add(item.symbol);
          combined.push(item);
        }
      }
      setResults(combined.slice(0, 8));
      setShowResults(combined.length > 0);
    }, 300);
  }, [apiKey, krToTicker]);

  const handleAdd = useCallback(async (symbol: string, name: string) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('open-login'));
      if (onClose) onClose();
      return;
    }
    const sym = symbol.toUpperCase();
    for (const c of ['investing', 'watching', 'sold'] as const) {
      if ((stocks[c] || []).some(s => s.symbol === sym)) {
        alert(`${sym} 이미 있습니다.`);
        return;
      }
    }
    if (name && !STOCK_KR[sym]) STOCK_KR[sym] = name;

    // 최근 검색에 저장
    saveRecent({ symbol: sym, description: name });
    setRecent(getRecent());

    let targetCat: 'investing' | 'watching' | 'sold' = 'watching';
    if (currentTab === 'investing') targetCat = 'investing';
    else if (currentTab === 'sold') targetCat = 'sold';

    const ns: StockItem = { symbol: sym, avgCost: 0, shares: 0, targetReturn: 0 };
    if (targetCat === 'watching') ns.buyBelow = 0;

    addStock(targetCat, ns);
    logApiCall('stock_add', sym);

    const newIdx = (stocks[targetCat] || []).length;
    setEditingCat(targetCat);
    setEditingIdx(newIdx);

    setQuery('');
    setShowResults(false);
    setResults([]);
    try {
      if (sym.endsWith('.KS') || sym.endsWith('.KQ')) {
        const r = await fetch(`/api/kr-quote?symbol=${sym}`);
        const d = await r.json();
        if (d?.c) updateMacroEntry(sym, d);
      } else {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${apiKey}`);
        const d = await r.json();
        if (d?.c) updateMacroEntry(sym, d);
      }
    } catch { /* silent */ }
    if (onClose) onClose();
  }, [apiKey, stocks, currentTab, addStock, updateMacroEntry, onClose]);

  const handleRemoveRecent = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    removeRecent(symbol);
    setRecent(getRecent());
  };

  const showRecentList = showRecent && query.length === 0 && recent.length > 0;

  return (
    <div
      data-search-panel
      style={{
        background: 'var(--surface, white)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        border: '1px solid var(--border-light, #F2F4F6)',
        overflow: 'hidden',
      }}
    >
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <Search
          style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            width: 18, height: 18, color: 'var(--text-tertiary, #B0B8C1)', pointerEvents: 'none',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onBlur={() => setTimeout(() => { setShowResults(false); setShowRecent(false); }, 400)}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
            else if (query.length === 0) setShowRecent(true);
          }}
          onKeyDown={(e) => { if (e.key === 'Escape' && onClose) onClose(); }}
          placeholder="종목명 또는 심볼 검색"
          style={{
            width: '100%', padding: '14px 16px 14px 44px', fontSize: 16,
            border: 'none', outline: 'none', background: 'var(--surface, white)',
            color: 'var(--text-primary, #191F28)', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* 최근 검색 */}
      {showRecentList && (
        <div style={{ borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
          <div style={{ padding: '10px 20px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)' }}>
            최근 검색
          </div>
          {recent.map((item) => (
            <button
              key={item.symbol}
              onClick={() => handleAdd(item.symbol, item.description)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 20px', border: 'none', cursor: 'pointer',
                background: 'var(--surface, white)', textAlign: 'left', boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock style={{ width: 14, height: 14, color: 'var(--text-tertiary, #B0B8C1)', flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>{item.symbol}</span>
                  <span style={{ fontSize: 12, color: '#8B95A1', marginLeft: 8 }}>{item.description}</span>
                </div>
              </div>
              <div
                onClick={(e) => handleRemoveRecent(e, item.symbol)}
                style={{ padding: 4, cursor: 'pointer', flexShrink: 0 }}
              >
                <X style={{ width: 12, height: 12, color: '#B0B8C1' }} />
              </div>
            </button>
          ))}
        </div>
      )}

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
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '14px 20px',
                borderTop: '1px solid #F7F8FA', border: 'none',
                borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: '#F7F8FA',
                cursor: 'pointer',
                background: hoveredIdx === idx ? 'var(--surface-hover, #F9FAFB)' : 'var(--surface, white)',
                textAlign: 'left', boxSizing: 'border-box', transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--bg-subtle, #F2F4F6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #4E5968)' }}>
                    {item.symbol.charAt(0)}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
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
