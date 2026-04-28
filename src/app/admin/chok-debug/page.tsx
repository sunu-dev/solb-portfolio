'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const ADMIN_EMAILS = ['soonooya@gmail.com', 'sunu.develop@gmail.com'];
const ADMIN_IDS = ['8d5fc5d7-978c-4365-a647-af90c237222b'];

interface DetailRow {
  symbol: string;
  krName: string;
  sectorTag: string;
  sectorLabel: string;
  currentPrice: number | null;
  peRatio: number | null;
  week52Position: number | null;
  yearReturn: number | null;
  todayChangePct: number | null;
}

interface DebugResp {
  ok: boolean;
  ranAt: string;
  coverage: { total: number; currentPrice: number; peRatio: number; week52Position: number; yearReturn: number; month1Return: number };
  coveragePct: { currentPrice: string; peRatio: string; week52Position: string };
  sectorDistribution: Record<string, number>;
  missingPeSymbols: string[];
  missing52wSymbols: string[];
  todayGainers: DetailRow[];
  todayLosers: DetailRow[];
  detail: DetailRow[];
}

export default function ChokDebugPage() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<DebugResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = !!user && (ADMIN_EMAILS.includes(user.email || '') || ADMIN_IDS.includes(user.id));

  async function fetchDebug() {
    setBusy(true); setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErr('로그인 필요'); return; }
      const res = await fetch('/api/admin/chok-debug', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || `HTTP ${res.status}`); return; }
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { if (isAdmin) fetchDebug(); }, [isAdmin]);

  if (loading) return <div style={{ padding: 40 }}>로딩…</div>;
  if (!user) return <div style={{ padding: 40 }}>로그인이 필요합니다.</div>;
  if (!isAdmin) return <div style={{ padding: 40 }}>관리자만 접근 가능합니다.</div>;

  const fmt = (n: number | null, suffix = '') => n === null ? '—' : `${n.toFixed(suffix === '%' ? 1 : 2)}${suffix}`;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 32, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>AI 촉 데이터 진단</h1>
        <button
          onClick={fetchDebug}
          disabled={busy}
          style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: busy ? '#F2F4F6' : '#191F28', color: busy ? '#B0B8C1' : '#fff',
            border: 'none', cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? '갱신 중…' : '새로 받기'}
        </button>
      </div>

      {err && (
        <div style={{ padding: 16, background: 'rgba(239,68,82,0.06)', border: '1px solid rgba(239,68,82,0.2)', borderRadius: 8, color: '#EF4452', fontSize: 13, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {data && (
        <>
          {/* 채움률 */}
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#4E5968' }}>필드 채움률 (universe {data.coverage.total}종)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {[
                { label: '현재가', n: data.coverage.currentPrice, pct: data.coveragePct.currentPrice },
                { label: 'PER', n: data.coverage.peRatio, pct: data.coveragePct.peRatio },
                { label: '52주 위치', n: data.coverage.week52Position, pct: data.coveragePct.week52Position },
                { label: '1Y 수익률', n: data.coverage.yearReturn, pct: ((data.coverage.yearReturn / data.coverage.total) * 100).toFixed(1) + '%' },
              ].map(c => {
                const v = parseFloat(c.pct);
                const color = v >= 80 ? '#1B6B3A' : v >= 50 ? '#FF9500' : '#EF4452';
                return (
                  <div key={c.label} style={{ padding: 14, border: '1px solid #F2F4F6', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: '#8B95A1', marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color }}>
                      {c.pct} <span style={{ fontSize: 11, color: '#B0B8C1', fontWeight: 500 }}>({c.n}/{data.coverage.total})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 부족 종목 */}
          <section style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 14, background: 'rgba(255,149,0,0.05)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#FF9500', marginBottom: 6 }}>PER 미수집 ({data.missingPeSymbols.length})</div>
              <div style={{ fontSize: 11, color: '#4E5968', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {data.missingPeSymbols.join(', ') || '없음'}
              </div>
            </div>
            <div style={{ padding: 14, background: 'rgba(255,149,0,0.05)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#FF9500', marginBottom: 6 }}>52주 위치 미수집 ({data.missing52wSymbols.length})</div>
              <div style={{ fontSize: 11, color: '#4E5968', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {data.missing52wSymbols.join(', ') || '없음'}
              </div>
            </div>
          </section>

          {/* Today movers (오늘 universe 내 상위·하위) */}
          <section style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 14, background: 'rgba(239,68,82,0.04)', border: '1px solid rgba(239,68,82,0.18)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#C72C2C', marginBottom: 8 }}>오늘 universe TOP 5 상승</div>
              {data.todayGainers.length === 0 ? (
                <div style={{ fontSize: 11, color: '#B0B8C1' }}>데이터 없음</div>
              ) : data.todayGainers.map(g => (
                <div key={g.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px dotted #F2F4F6' }}>
                  <span><strong>{g.symbol}</strong> <span style={{ color: '#8B95A1' }}>{g.krName}</span></span>
                  <span style={{ color: '#C72C2C', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>+{g.todayChangePct?.toFixed(2)}%</span>
                </div>
              ))}
            </div>
            <div style={{ padding: 14, background: 'rgba(49,130,246,0.04)', border: '1px solid rgba(49,130,246,0.18)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1B5BC9', marginBottom: 8 }}>오늘 universe TOP 5 하락</div>
              {data.todayLosers.length === 0 ? (
                <div style={{ fontSize: 11, color: '#B0B8C1' }}>데이터 없음</div>
              ) : data.todayLosers.map(g => (
                <div key={g.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px dotted #F2F4F6' }}>
                  <span><strong>{g.symbol}</strong> <span style={{ color: '#8B95A1' }}>{g.krName}</span></span>
                  <span style={{ color: '#1B5BC9', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{g.todayChangePct?.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* 섹터 분포 */}
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#4E5968' }}>섹터 분포</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(data.sectorDistribution).sort((a, b) => b[1] - a[1]).map(([sec, n]) => (
                <span key={sec} style={{
                  padding: '4px 10px', borderRadius: 12,
                  background: '#F2F4F6', fontSize: 12, color: '#4E5968',
                }}>
                  {sec} <strong style={{ color: '#191F28' }}>{n}</strong>
                </span>
              ))}
            </div>
          </section>

          {/* 종목별 상세 */}
          <section>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#4E5968' }}>종목별 상세 ({data.detail.length})</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8F9FA', textAlign: 'left' }}>
                    <th style={{ padding: 8, borderBottom: '1px solid #E5E8EB' }}>심볼</th>
                    <th style={{ padding: 8, borderBottom: '1px solid #E5E8EB' }}>이름</th>
                    <th style={{ padding: 8, borderBottom: '1px solid #E5E8EB' }}>섹터</th>
                    <th style={{ padding: 8, borderBottom: '1px solid #E5E8EB', textAlign: 'right' }}>현재가</th>
                    <th style={{ padding: 8, borderBottom: '1px solid #E5E8EB', textAlign: 'right' }}>PER</th>
                    <th style={{ padding: 8, borderBottom: '1px solid #E5E8EB', textAlign: 'right' }}>52w 위치</th>
                    <th style={{ padding: 8, borderBottom: '1px solid #E5E8EB', textAlign: 'right' }}>1Y</th>
                  </tr>
                </thead>
                <tbody>
                  {data.detail.map(d => (
                    <tr key={d.symbol} style={{ borderBottom: '1px solid #F2F4F6' }}>
                      <td style={{ padding: 8, fontFamily: 'monospace', fontWeight: 600 }}>{d.symbol}</td>
                      <td style={{ padding: 8, color: '#4E5968' }}>{d.krName}</td>
                      <td style={{ padding: 8, color: '#8B95A1', fontSize: 11 }}>{d.sectorLabel}</td>
                      <td style={{ padding: 8, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {d.currentPrice !== null ? `$${d.currentPrice.toFixed(2)}` : <span style={{ color: '#B0B8C1' }}>—</span>}
                      </td>
                      <td style={{ padding: 8, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: d.peRatio === null ? '#B0B8C1' : '#191F28' }}>
                        {fmt(d.peRatio)}
                      </td>
                      <td style={{ padding: 8, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: d.week52Position === null ? '#B0B8C1' : '#191F28' }}>
                        {fmt(d.week52Position, '%')}
                      </td>
                      <td style={{ padding: 8, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                        color: d.yearReturn === null ? '#B0B8C1' : (d.yearReturn >= 0 ? '#EF4452' : '#3182F6') }}>
                        {d.yearReturn !== null ? `${d.yearReturn >= 0 ? '+' : ''}${d.yearReturn.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div style={{ marginTop: 24, fontSize: 11, color: '#B0B8C1', textAlign: 'right' }}>
            데이터 시각: {new Date(data.ranAt).toLocaleString('ko-KR')}
          </div>
        </>
      )}
    </div>
  );
}
