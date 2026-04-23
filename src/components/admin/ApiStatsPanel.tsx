'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface EndpointStat {
  endpoint: string;
  count: number;
  errors: number;
  errorRate: number;
  p50: number | null;
  p95: number | null;
  avg: number | null;
}

interface TopUser {
  userKey: string;
  count: number;
  isAnon: boolean;
}

interface ErrorDist { code: string; count: number }

interface TimeBucket {
  hoursAgo: number;
  label: string;
  total: number;
  errors: number;
}

interface ProviderInfo {
  gemini: { keys: number };
  claude: {
    available: boolean;
    used: number;
    limit: number;
    remaining: number;
    estimatedCostUsd: string;
  };
}

interface ApiStats {
  hours: number;
  total: number;
  successes: number;
  errors: number;
  successRate: number;
  endpoints: EndpointStat[];
  topUsers: TopUser[];
  errorDist: ErrorDist[];
  timeline: TimeBucket[];
  provider?: ProviderInfo;
}

export default function ApiStatsPanel() {
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hours, setHours] = useState(24);

  useEffect(() => {
    fetchStats();
  }, [hours]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchStats() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError('로그인 필요'); return; }

      const res = await fetch(`/api/admin/api-stats?hours=${hours}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(`API error: ${res.status}`);
        return;
      }
      const data = await res.json();
      setStats(data);
      setError('');
    } catch (e) {
      setError('API 통계 로드 실패');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#8B95A1' }}>API 통계 로딩 중...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#EF4452' }}>{error}</div>;
  if (!stats) return null;

  const maxBucket = Math.max(...stats.timeline.map(b => b.total), 1);

  return (
    <div>
      {/* 기간 선택 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[6, 24, 72, 168].map(h => (
          <button
            key={h}
            onClick={() => setHours(h)}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: hours === h ? 700 : 400,
              color: hours === h ? '#fff' : '#4E5968',
              background: hours === h ? '#191F28' : '#F2F4F6',
              border: 'none', borderRadius: 20, cursor: 'pointer',
            }}
          >
            최근 {h === 168 ? '7일' : `${h}시간`}
          </button>
        ))}
      </div>

      {/* AI Provider 상태 */}
      {stats.provider && (
        <Section title="AI Provider 상태">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {/* Gemini */}
            <div style={{ padding: 14, background: '#fff', border: '1px solid #F2F4F6', borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: '#8B95A1', marginBottom: 6 }}>🟢 Gemini (primary)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#191F28' }}>
                {stats.provider.gemini.keys > 0 ? `${stats.provider.gemini.keys}개 키 활성` : '키 없음'}
              </div>
              <div style={{ fontSize: 11, color: '#B0B8C1', marginTop: 4 }}>
                Flash Lite: $0.10/1M in, $0.40/1M out
              </div>
            </div>

            {/* Claude */}
            <div style={{
              padding: 14,
              background: stats.provider.claude.available ? '#fff' : '#F8F9FA',
              border: `1px solid ${stats.provider.claude.available ? '#F2F4F6' : '#E5E8EB'}`,
              borderRadius: 12,
              opacity: stats.provider.claude.available ? 1 : 0.6,
            }}>
              <div style={{ fontSize: 11, color: '#8B95A1', marginBottom: 6 }}>
                🟣 Claude Haiku (fallback)
              </div>
              {stats.provider.claude.available ? (
                <>
                  <div style={{
                    fontSize: 16, fontWeight: 700,
                    color: stats.provider.claude.remaining < 50 ? '#EF4452' : stats.provider.claude.used > 0 ? '#FF9500' : '#191F28',
                  }}>
                    {stats.provider.claude.used} / {stats.provider.claude.limit} 회
                  </div>
                  <div style={{ fontSize: 11, color: '#B0B8C1', marginTop: 4 }}>
                    예상 비용 ${stats.provider.claude.estimatedCostUsd} / 오늘
                  </div>
                  {/* 진행 바 */}
                  <div style={{ marginTop: 8, height: 4, background: '#F2F4F6', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, (stats.provider.claude.used / stats.provider.claude.limit) * 100)}%`,
                        background: stats.provider.claude.used / stats.provider.claude.limit > 0.8 ? '#EF4452' : stats.provider.claude.used > 0 ? '#FF9500' : '#20C997',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#8B95A1' }}>
                  비활성 (ANTHROPIC_API_KEY 설정 필요)
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* 총괄 카드 3개 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="총 호출 수" value={stats.total.toLocaleString()} unit="회" color="#191F28" />
        <StatCard
          label="성공률"
          value={`${stats.successRate}%`}
          unit=""
          color={stats.successRate >= 95 ? '#16A34A' : stats.successRate >= 85 ? '#FF9500' : '#EF4452'}
        />
        <StatCard
          label="에러 수"
          value={stats.errors.toLocaleString()}
          unit="회"
          color={stats.errors === 0 ? '#16A34A' : stats.errors > 20 ? '#EF4452' : '#FF9500'}
        />
      </div>

      {/* 타임라인 히스토그램 */}
      <Section title="시간별 호출 추이">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, padding: '12px 0', overflowX: 'auto' }}>
          {stats.timeline.map(b => {
            const pct = (b.total / maxBucket) * 100;
            const errPct = b.total > 0 ? (b.errors / b.total) * 100 : 0;
            return (
              <div
                key={b.hoursAgo}
                title={`${b.label}\n총 ${b.total}회 / 에러 ${b.errors}`}
                style={{
                  flex: '0 0 12px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  position: 'relative',
                }}
              >
                <div style={{
                  height: `${pct}%`,
                  background: errPct > 20 ? '#EF4452' : errPct > 5 ? '#FF9500' : '#3182F6',
                  borderRadius: '2px 2px 0 0',
                  transition: 'all 0.3s',
                  minHeight: b.total > 0 ? 2 : 0,
                }} />
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: '#B0B8C1', textAlign: 'center', marginTop: 4 }}>
          과거 ← → 최근 · 빨강: 에러 20%+
        </div>
      </Section>

      {/* 엔드포인트별 */}
      <Section title="엔드포인트별">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stats.endpoints.length === 0 && (
            <div style={{ padding: 16, color: '#8B95A1', fontSize: 13 }}>호출 없음</div>
          )}
          {stats.endpoints.map(e => (
            <div
              key={e.endpoint}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                gap: 8, padding: '10px 14px', borderRadius: 10,
                background: '#fff', border: '1px solid #F2F4F6',
                alignItems: 'center', fontSize: 12,
              }}
            >
              <code style={{ fontSize: 12, color: '#191F28', fontWeight: 700 }}>{e.endpoint}</code>
              <div><strong>{e.count.toLocaleString()}</strong> 회</div>
              <div style={{ color: e.errorRate > 10 ? '#EF4452' : e.errorRate > 1 ? '#FF9500' : '#16A34A' }}>
                에러 {e.errors} ({e.errorRate.toFixed(1)}%)
              </div>
              <div style={{ color: '#8B95A1' }}>p50 {e.p50 ?? '-'}ms</div>
              <div style={{ color: '#8B95A1' }}>p95 {e.p95 ?? '-'}ms</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Top 유저 */}
      <Section title="Top 10 호출자">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stats.topUsers.length === 0 && (
            <div style={{ padding: 16, color: '#8B95A1', fontSize: 13 }}>호출자 없음</div>
          )}
          {stats.topUsers.map((u, i) => (
            <div
              key={u.userKey}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                background: '#fff', borderRadius: 10, border: '1px solid #F2F4F6',
                fontSize: 12,
              }}
            >
              <span style={{ width: 24, color: '#B0B8C1', fontWeight: 700 }}>#{i + 1}</span>
              <span style={{
                padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                background: u.isAnon ? '#F2F4F6' : 'rgba(49,130,246,0.1)',
                color: u.isAnon ? '#8B95A1' : '#3182F6',
              }}>
                {u.isAnon ? '비로그인' : '로그인'}
              </span>
              <code style={{ flex: 1, fontSize: 11, color: '#4E5968', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {u.userKey}
              </code>
              <strong>{u.count}회</strong>
            </div>
          ))}
        </div>
      </Section>

      {/* 에러 코드 분포 */}
      {stats.errorDist.length > 0 && (
        <Section title="에러 코드 분포">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {stats.errorDist.map(e => (
              <div
                key={e.code}
                style={{
                  padding: '8px 14px', borderRadius: 10,
                  background: '#FFF5F5', border: '1px solid rgba(239,68,82,0.15)',
                  fontSize: 12,
                }}
              >
                <code style={{ fontSize: 11, color: '#EF4452', fontWeight: 700, marginRight: 8 }}>{e.code}</code>
                <strong>{e.count}</strong>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function StatCard({ label, value, unit, color }: { label: string; value: string | number; unit: string; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 20 }}>
      <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 400, color: '#8B95A1', marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#191F28', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
