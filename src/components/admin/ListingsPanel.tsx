'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Listing {
  symbol: string;
  exchange: string;
  description: string | null;
  kr_name: string | null;
  listed_at: string | null;
  market_cap: number | null;
  status: string;
  first_seen: string;
  last_seen: string;
  reviewed_at: string | null;
  notes: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  watch:     { label: '검토 대기',   color: '#FF9500' },
  eligible:  { label: '후보',         color: '#3182F6' },
  universe:  { label: 'Universe 편입', color: '#16A34A' },
  rejected:  { label: '부적격',       color: '#8B95A1' },
  delisted:  { label: '상폐',         color: '#EF4452' },
};

const STATUS_ORDER = ['watch', 'eligible', 'universe', 'rejected', 'delisted'] as const;

export default function ListingsPanel() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('watch');
  const [filterExchange, setFilterExchange] = useState<string>('');
  const [search, setSearch] = useState('');
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [krDraft, setKrDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError('로그인 필요'); return; }

      const params = new URLSearchParams();
      params.set('status', filterStatus);
      if (filterExchange) params.set('exchange', filterExchange);
      if (search) params.set('q', search);

      const res = await fetch(`/api/admin/listings?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError(`API ${res.status}`); return; }
      const data = await res.json();
      setListings(data.listings || []);
      setCounts(data.countsByStatus || {});
      setError('');
    } catch (e) {
      console.error(e);
      setError('목록 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterExchange, search]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  async function patchListing(symbol: string, payload: Partial<{ status: string; kr_name: string; notes: string }>) {
    setBusy(prev => new Set(prev).add(symbol));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/admin/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol, ...payload }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      await fetchListings();
    } catch (e) {
      console.error(e);
      alert('업데이트 실패');
    } finally {
      setBusy(prev => { const ns = new Set(prev); ns.delete(symbol); return ns; });
    }
  }

  async function generateKr(symbol: string) {
    setBusy(prev => new Set(prev).add(symbol));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/admin/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const krName = data.kr_name;
      const confident = data.is_confident;
      const ok = confident
        ? confirm(`Gemini 추천: "${krName}" — 적용하시겠어요?`)
        : confirm(`Gemini 추천 (불확실): "${krName}" — 검토 후 적용하시겠어요?`);
      if (ok) {
        await patchListing(symbol, { kr_name: krName });
      }
    } catch (e) {
      console.error(e);
      alert('한국어명 생성 실패');
    } finally {
      setBusy(prev => { const ns = new Set(prev); ns.delete(symbol); return ns; });
    }
  }

  function startEdit(l: Listing) {
    setEditingSymbol(l.symbol);
    setKrDraft(l.kr_name || '');
    setNotesDraft(l.notes || '');
  }

  async function saveEdit(symbol: string) {
    await patchListing(symbol, { kr_name: krDraft, notes: notesDraft });
    setEditingSymbol(null);
  }

  return (
    <div>
      {/* 상태 필터 칩 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {STATUS_ORDER.map(s => {
          const info = STATUS_LABELS[s];
          const isActive = filterStatus === s;
          const cnt = counts[s] || 0;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: isActive ? 700 : 400,
                color: isActive ? '#fff' : info.color,
                background: isActive ? info.color : '#fff',
                border: `1px solid ${info.color}33`,
                borderRadius: 16, cursor: 'pointer',
              }}
            >
              {info.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* 거래소 + 검색 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select
          value={filterExchange}
          onChange={(e) => setFilterExchange(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #E5E8EB', background: '#fff' }}
        >
          <option value="">전체 거래소</option>
          <option value="US">미국 (US)</option>
          <option value="KS">코스피 (KS)</option>
          <option value="KQ">코스닥 (KQ)</option>
        </select>
        <input
          type="text"
          placeholder="symbol / 영문 / 한글 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #E5E8EB' }}
        />
        <button
          onClick={fetchListings}
          style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, background: '#191F28', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          새로고침
        </button>
      </div>

      {loading && <div style={{ padding: 24, textAlign: 'center', color: '#8B95A1' }}>로딩 중...</div>}
      {error && <div style={{ padding: 24, textAlign: 'center', color: '#EF4452' }}>{error}</div>}

      {!loading && !error && listings.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#8B95A1', fontSize: 13 }}>
          해당 상태의 종목이 없어요
        </div>
      )}

      {!loading && !error && listings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {listings.map(l => {
            const isEditing = editingSymbol === l.symbol;
            const isBusy = busy.has(l.symbol);
            return (
              <div
                key={l.symbol}
                style={{
                  padding: '12px 14px', background: '#fff', borderRadius: 10,
                  border: '1px solid #F2F4F6',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}
              >
                {/* 첫 줄: symbol, 거래소, 영문명 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <code style={{ fontWeight: 700, color: '#191F28' }}>{l.symbol}</code>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#F2F4F6', color: '#8B95A1' }}>{l.exchange}</span>
                  <span style={{ flex: 1, color: '#4E5968', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.description || '(설명 없음)'}
                  </span>
                  <span style={{ fontSize: 10, color: '#B0B8C1' }}>
                    {new Date(l.first_seen).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {/* 두 번째 줄: 한국어명 + notes */}
                {isEditing ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="한국어명"
                      value={krDraft}
                      onChange={(e) => setKrDraft(e.target.value)}
                      style={{ flex: 1, minWidth: 140, padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #E5E8EB' }}
                    />
                    <input
                      type="text"
                      placeholder="메모"
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      style={{ flex: 2, minWidth: 140, padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #E5E8EB' }}
                    />
                    <button
                      onClick={() => saveEdit(l.symbol)}
                      disabled={isBusy}
                      style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#fff', background: '#3182F6', border: 'none', borderRadius: 6, cursor: isBusy ? 'default' : 'pointer' }}
                    >저장</button>
                    <button
                      onClick={() => setEditingSymbol(null)}
                      style={{ padding: '6px 12px', fontSize: 11, color: '#8B95A1', background: '#F2F4F6', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >취소</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: l.kr_name ? '#191F28' : '#B0B8C1', fontWeight: l.kr_name ? 600 : 400 }}>
                      🇰🇷 {l.kr_name || '미정'}
                    </span>
                    {l.notes && <span style={{ color: '#8B95A1', fontSize: 11 }}>📝 {l.notes}</span>}
                    <button
                      onClick={() => startEdit(l)}
                      style={{ padding: '2px 8px', fontSize: 10, color: '#3182F6', background: 'none', border: '1px solid rgba(49,130,246,0.2)', borderRadius: 4, cursor: 'pointer' }}
                    >편집</button>
                    <button
                      onClick={() => generateKr(l.symbol)}
                      disabled={isBusy}
                      style={{ padding: '2px 8px', fontSize: 10, color: '#FF9500', background: 'none', border: '1px solid rgba(255,149,0,0.3)', borderRadius: 4, cursor: isBusy ? 'default' : 'pointer' }}
                    >
                      🤖 한국어 자동
                    </button>
                  </div>
                )}

                {/* 세 번째 줄: 상태 변경 액션 */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {l.status !== 'rejected' && (
                    <button
                      onClick={() => patchListing(l.symbol, { status: 'rejected' })}
                      disabled={isBusy}
                      style={{ padding: '4px 10px', fontSize: 10, color: '#8B95A1', background: '#F2F4F6', border: 'none', borderRadius: 6, cursor: isBusy ? 'default' : 'pointer' }}
                    >부적격</button>
                  )}
                  {l.status !== 'eligible' && l.status !== 'universe' && (
                    <button
                      onClick={() => patchListing(l.symbol, { status: 'eligible' })}
                      disabled={isBusy}
                      style={{ padding: '4px 10px', fontSize: 10, color: '#3182F6', background: 'rgba(49,130,246,0.08)', border: 'none', borderRadius: 6, cursor: isBusy ? 'default' : 'pointer' }}
                    >후보로</button>
                  )}
                  {l.status === 'eligible' && (
                    <button
                      onClick={() => {
                        if (!l.kr_name) { alert('한국어명을 먼저 채워주세요'); return; }
                        if (confirm(`${l.symbol} 를 universe에 편입하시겠어요? 코드 PR로 CHOK_UNIVERSE에 추가해야 실제 적용됩니다.`)) {
                          patchListing(l.symbol, { status: 'universe' });
                        }
                      }}
                      disabled={isBusy}
                      style={{ padding: '4px 10px', fontSize: 10, color: '#fff', background: '#16A34A', border: 'none', borderRadius: 6, cursor: isBusy ? 'default' : 'pointer' }}
                    >✓ Universe 편입</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 24, padding: 14, fontSize: 11, color: '#B0B8C1', background: '#FAFBFF', borderRadius: 10, lineHeight: 1.6 }}>
        <strong style={{ color: '#4E5968' }}>운영 가이드</strong><br />
        • 검토대기 → 부적격: 소형주·페이퍼·스팩 등<br />
        • 검토대기/부적격 → 후보: 관찰 가치 있는 종목<br />
        • 후보 → Universe 편입: 한국어명 채운 뒤. 코드 PR로 CHOK_UNIVERSE 갱신 필요.<br />
        • Universe 편입 기준: 상장 12개월+ / 시총 $5B (1조원)+ / 데이터 정상 — <code>docs/UNIVERSE_INCLUSION_CRITERIA.md</code>
      </div>
    </div>
  );
}
