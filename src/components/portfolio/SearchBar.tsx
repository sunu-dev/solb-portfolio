'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { searchStocks } from '@/hooks/useStockData';
import { STOCK_KR } from '@/config/constants';
import type { StockItem } from '@/config/constants';
import { Search, Plus, Clock, X } from 'lucide-react';
import { logApiCall } from '@/lib/apiLogger';
import { useAuth } from '@/hooks/useAuth';
import { eunNeun } from '@/utils/koreanJosa';
import { isBlockedLeverage, LEVERAGE_BLOCK_SHORT } from '@/utils/leverageGuard';
import { getSearchTag, searchTagOrder } from '@/utils/searchAssetClass';

// 검색어가 단일종목 레버리지 의도인지 휴리스틱 판정 — EmptyState 분기에만 사용
function isLeverageQuery(q: string): boolean {
  return /레버리지|인버스|곱버스|곱버|2배|2X|단일종목|TQQQ|SOXL|SOXS|UPRO|TSLL|NVDU|FNGU|FNGD/i.test(q);
}

// 검색 결과 카드 표시명 — 8인 패널 합의 (2026-05-28):
// 한국어 종목명 메인 / 종목코드 보조. 시장 표준(토스·카카오페이·키움) 일치.
// STOCK_KR 매핑 우선 → description의 거래소 suffix 제거 → fallback symbol.
function getDisplayName(item: { symbol: string; description?: string }): string {
  if (STOCK_KR[item.symbol]) return STOCK_KR[item.symbol];
  const desc = (item.description || '').trim();
  // " (KRX)", " (NASDAQ)" 같은 거래소 suffix 제거
  const cleaned = desc.replace(/\s*\([A-Z]+\)\s*$/, '').trim();
  return cleaned || item.symbol;
}

// 좌측 회색 원 — 종목명 첫 글자 (한글 또는 영문). 기존 symbol.charAt(0)("0", "2")는 노이즈.
function getInitial(item: { symbol: string; description?: string }): string {
  const name = getDisplayName(item);
  const first = name.charAt(0);
  return first ? first.toUpperCase() : item.symbol.charAt(0);
}

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
  const [results, setResults] = useState<{ symbol: string; description: string; isNewListing?: boolean; listedAt?: string | null }[]>([]);
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

      // 로컬 매칭 → KRX → Finnhub 순서, 중복 제거 + 단일종목 레버리지 차단 (leverageGuard SSOT)
      const seen = new Set<string>();
      const combined: { symbol: string; description: string }[] = [];
      for (const item of [...localMatches, ...krItems, ...usItems]) {
        if (seen.has(item.symbol)) continue;
        if (isBlockedLeverage(item.symbol, item.description)) continue;
        seen.add(item.symbol);
        combined.push(item);
      }
      // 자산 클래스 정렬 (P0-4): 보통주 → ETF → 우선주 → 혼합.
      // "삼성전자"가 "삼성전자우"보다 먼저 노출되도록. sort는 ES2019+ stable이라
      // 같은 클래스 안에서는 관련도(로컬→KRX→Finnhub) 순서가 보존됨.
      combined.sort(
        (a, b) =>
          searchTagOrder(a.symbol, getDisplayName(a)) -
          searchTagOrder(b.symbol, getDisplayName(b)),
      );
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
    // 단일종목 레버리지·인버스 차단 — 2026-05-27 KRX 상장 대응 (leverageGuard SSOT)
    if (isBlockedLeverage(sym, name)) {
      alert(`${LEVERAGE_BLOCK_SHORT}\n\n일일 N배 추종·음의 복리·발행사 신용 위험이 있어 학습용 앱 범위 밖이에요. 자세한 정보는 발행사 공시·금융감독원 안내를 확인해주세요.`);
      return;
    }
    // Phase M-1.3 — (symbol, broker) 페어 단위 중복 제어
    // SearchBar는 broker 미지정으로 추가하므로, 미지정 broker로 같은 종목이
    // 이미 있을 때만 차단. broker가 다른 곳에 등록돼 있어도 새 broker로 추가 가능
    // (사용자가 모달에서 broker 설정하면 분산 보유 자동 활성화).
    for (const c of ['investing', 'watching', 'sold'] as const) {
      const dup = (stocks[c] || []).find(s => s.symbol === sym && !s.broker);
      if (dup) {
        alert(`${sym} 이미 미지정 증권사로 등록돼 있어요.\n다른 증권사에 추가하려면 기존 종목의 증권사를 먼저 설정해주세요.`);
        return;
      }
      // 다른 broker에 등록된 종목이 있으면 안내 (차단 X)
      const otherBroker = (stocks[c] || []).find(s => s.symbol === sym && s.broker);
      if (otherBroker) {
        const ok = confirm(`${sym}${eunNeun(sym)} 이미 다른 증권사에 등록돼 있어요.\n새 증권사로 추가하시겠어요? (추가 후 증권사를 설정해주세요)`);
        if (!ok) return;
        break;
      }
    }
    // 저장·표시용 정제명 — "삼성전기 (KRX)" 같은 거래소 suffix 제거.
    // (leverageGuard는 위에서 원본 name으로 이미 검사 완료)
    const cleanName = (name || '').replace(/\s*\([A-Z]+\)\s*$/, '').trim() || name;
    if (cleanName && !STOCK_KR[sym]) STOCK_KR[sym] = cleanName;

    // 최근 검색에 저장
    saveRecent({ symbol: sym, description: cleanName });
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
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary, #4E5968)' }}>
                    {getInitial(item)}
                  </span>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getDisplayName(item)}
                    </span>
                    {(() => {
                      // 자산 클래스 칩 (P0-3) — 우선주·ETF·혼합. 위험이 아닌 정보이므로
                      // 중립 회색(토스풍 미니멀, 디자인 메모리 준수). 차단 상품은 결과에서
                      // 이미 필터되므로 여기 칩으로는 안 나타남.
                      const tag = getSearchTag(item.symbol, getDisplayName(item));
                      if (!tag) return null;
                      return (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6, background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #6B7684)', letterSpacing: 0.2, flexShrink: 0 }}>
                          {tag.label}
                        </span>
                      );
                    })()}
                    {item.isNewListing && (
                      <span
                        title={item.listedAt ? `상장일 ${item.listedAt}` : '최근 6개월 이내 신규 감지'}
                        style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: 'rgba(255,149,0,0.12)', color: '#FF9500', letterSpacing: 0.3, flexShrink: 0 }}
                      >
                        📅 신규
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#8B95A1', marginTop: 2, fontFamily: '"SF Mono", Menlo, monospace', letterSpacing: 0.2, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.symbol}
                    {item.isNewListing && (
                      <span style={{ fontSize: 10, color: '#FF9500', marginLeft: 6, fontFamily: 'system-ui' }}>· 데이터 제한</span>
                    )}
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

      {/* Empty state — 3분기 (9인 패널 P0-2): 차단 / 한국 종목 오타·미수록 / 영문 오타.
          "결과 없음"을 막다른 길로 두지 않고, 왜 안 나오는지 + 다음 행동을 안내. */}
      {query.length > 0 && !showResults && results.length === 0 && (
        isLeverageQuery(query) ? (
          // ① 차단 — 단일종목 레버리지·인버스
          <div style={{ padding: '20px', textAlign: 'left', fontSize: 13, color: 'var(--text-secondary, #4E5968)', borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.12)', color: '#B45309', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
              ⚠ 분석 대상 아님
            </div>
            <div style={{ marginBottom: 6, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
              {LEVERAGE_BLOCK_SHORT}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary, #8B95A1)', lineHeight: 1.6 }}>
              단일종목 레버리지·인버스 ETF/ETN은 일일 N배 추종·음의 복리·발행사 신용 위험이 있어 학습용 앱 범위 밖이에요. 자세한 정보는 발행사 공시·금융감독원 안내를 확인해주세요.
            </div>
          </div>
        ) : /[가-힣]/.test(query) ? (
          // ② 한국 종목 추정 — 오타 또는 아직 미수록
          <div style={{ padding: '20px', textAlign: 'left', fontSize: 13, color: 'var(--text-secondary, #4E5968)', borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ marginBottom: 6, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
              ‘{query}’ 검색 결과가 없어요
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary, #8B95A1)', lineHeight: 1.6 }}>
              종목명 철자나 6자리 코드(예: 005930)를 확인해주세요. 일부 한국 종목은 아직 준비 중이라 검색되지 않을 수 있어요.
            </div>
          </div>
        ) : (
          // ③ 영문·심볼 추정 — 오타 안내
          <div style={{ padding: '20px', textAlign: 'left', fontSize: 13, color: 'var(--text-secondary, #4E5968)', borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ marginBottom: 6, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
              ‘{query}’ 검색 결과가 없어요
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary, #8B95A1)', lineHeight: 1.6 }}>
              철자가 맞는지 확인하거나 정확한 심볼(예: AAPL, TSLA)로 검색해보세요.
            </div>
          </div>
        )
      )}
    </div>
  );
}
