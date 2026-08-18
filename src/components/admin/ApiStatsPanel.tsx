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

interface AiCostBreakdown {
  feature: string;
  provider: string;
  model: string;
  calls: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  avgLatencyMs: number;
  cacheHitRate: number;
}

interface AiCostStats {
  available: boolean;
  message: string | null;
  calls: number;
  totalCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  breakdown: AiCostBreakdown[];
  monthlyBudget: {
    enabled: boolean;
    allowed: boolean;
    budgetUsd: number;
    stopAtUsd: number;
    spentUsd: number;
    remainingUsd: number;
    usagePercent: number;
    reason?: 'budget_reached' | 'ledger_unavailable';
  };
  projection: {
    monthSpentUsd: number;
    monthCalls: number;
    avgCostPerCallUsd: number | null;
    projectedMonthEndUsd: number | null;
    remainingCallsAtBudget: number | null;
  } | null;
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
  aiCost?: AiCostStats;
  safety?: {
    overall: 'good' | 'warning' | 'danger';
    checks: Array<{ id: string; label: string; value: string; level: 'good' | 'warning' | 'danger'; detail: string }>;
  };
}

const formatUsd = (value: number) => value < 0.01
  ? `$${value.toFixed(6)}`
  : `$${value.toFixed(2)}`;

const formatTokens = (value: number) => value >= 1_000_000
  ? `${(value / 1_000_000).toFixed(2)}M`
  : value >= 1_000
    ? `${(value / 1_000).toFixed(1)}K`
    : value.toLocaleString();

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
      {stats.safety && (
        <Section title="무료 베타 운영 안전 상태">
          <div style={{ padding: 14, marginBottom: 10, borderRadius: 12, background: stats.safety.overall === 'good' ? '#EDFCF2' : stats.safety.overall === 'danger' ? '#FFF0F0' : '#FFF8E8', color: stats.safety.overall === 'good' ? '#16803C' : stats.safety.overall === 'danger' ? '#C92A3A' : '#8A5A00', fontSize: 13, fontWeight: 700 }}>
            {stats.safety.overall === 'good' ? '모든 핵심 비용 가드가 보수적으로 설정돼 있어요.' : stats.safety.overall === 'danger' ? '즉시 확인할 안전 설정이 있어요.' : '확인하거나 설정할 비용 가드가 있어요.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {stats.safety.checks.map(check => {
              const color = check.level === 'good' ? '#16A34A' : check.level === 'danger' ? '#EF4452' : '#FF9500';
              return (
                <div key={check.id} style={{ padding: 12, background: '#fff', border: '1px solid var(--border-light, #F2F4F6)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                    <strong style={{ color: '#191F28' }}>{check.label}</strong>
                    <span style={{ color, fontWeight: 700 }}>{check.level === 'good' ? '정상' : check.level === 'danger' ? '위험' : '확인'}</span>
                  </div>
                  <div style={{ marginTop: 5, fontSize: 13, fontWeight: 700, color }}>{check.value}</div>
                  <div style={{ marginTop: 4, fontSize: 10.5, color: '#8B95A1', lineHeight: 1.5 }}>{check.detail}</div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* AI Provider 상태 */}
      {stats.provider && (
        <Section title="AI Provider 상태">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {/* Gemini */}
            <div style={{ padding: 14, background: '#fff', border: '1px solid var(--border-light, #F2F4F6)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8B95A1', marginBottom: 6 }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A' }} />
                Gemini (primary)
              </div>
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
              border: `1px solid ${stats.provider.claude.available ? 'var(--border-light, #F2F4F6)' : 'var(--border-light, #E5E8EB)'}`,
              borderRadius: 12,
              opacity: stats.provider.claude.available ? 1 : 0.6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8B95A1', marginBottom: 6 }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: '#AF52DE' }} />
                Claude Haiku (fallback)
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

      {/* 실제 토큰 기반 AI 비용 */}
      {stats.aiCost && (
        <Section title="AI 비용 원장">
          {!stats.aiCost.available ? (
            <div style={{ padding: 16, background: '#FFF8E8', border: '1px solid rgba(255,149,0,0.2)', borderRadius: 12, color: '#8A5A00', fontSize: 13 }}>
              {stats.aiCost.message}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
                <StatCard label="추정 비용" value={formatUsd(stats.aiCost.totalCostUsd)} unit="" color="#AF52DE" />
                <StatCard label="계측된 AI 호출" value={stats.aiCost.calls.toLocaleString()} unit="회" color="#3182F6" />
                <StatCard label="평균 지연시간" value={stats.aiCost.avgLatencyMs.toLocaleString()} unit="ms" color="#FF9500" />
                <StatCard label="캐시 적중률" value={`${stats.aiCost.cacheHitRate}%`} unit="" color="#16A34A" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                <StatCard
                  label="이번 달 누적 비용"
                  value={stats.aiCost.projection ? formatUsd(stats.aiCost.projection.monthSpentUsd) : '계산 대기'}
                  unit=""
                  color="#191F28"
                />
                <StatCard
                  label="월말 예상 비용"
                  value={stats.aiCost.projection?.projectedMonthEndUsd == null ? '계산 대기' : formatUsd(stats.aiCost.projection.projectedMonthEndUsd)}
                  unit=""
                  color="#AF52DE"
                />
                <StatCard
                  label="예산 내 예상 잔여 호출"
                  value={stats.aiCost.projection?.remainingCallsAtBudget == null ? '계산 대기' : stats.aiCost.projection.remainingCallsAtBudget.toLocaleString()}
                  unit={stats.aiCost.projection?.remainingCallsAtBudget == null ? '' : '회'}
                  color="#3182F6"
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, fontSize: 11, color: '#4E5968' }}>
                <TokenPill label="입력" value={stats.aiCost.inputTokens} />
                <TokenPill label="출력" value={stats.aiCost.outputTokens} />
                <TokenPill label="캐시 입력" value={stats.aiCost.cachedInputTokens} />
                <TokenPill label="추론" value={stats.aiCost.reasoningTokens} />
              </div>

              <div style={{ padding: 12, marginBottom: 12, background: '#F8F9FA', border: '1px solid var(--border-light, #F2F4F6)', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                  <strong style={{ color: '#191F28' }}>월 예산 하드캡</strong>
                  {stats.aiCost.monthlyBudget.enabled ? (
                    <span style={{ color: stats.aiCost.monthlyBudget.allowed ? '#16A34A' : '#EF4452', fontWeight: 700 }}>
                      {formatUsd(stats.aiCost.monthlyBudget.spentUsd)} / {formatUsd(stats.aiCost.monthlyBudget.budgetUsd)}
                      {' '}({stats.aiCost.monthlyBudget.usagePercent}%)
                    </span>
                  ) : (
                    <span style={{ color: '#8B95A1' }}>비활성 · AI_MONTHLY_BUDGET_USD 설정 필요</span>
                  )}
                </div>
                {stats.aiCost.monthlyBudget.enabled && (
                  <div style={{ height: 5, marginTop: 8, background: '#E5E8EB', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, stats.aiCost.monthlyBudget.usagePercent)}%`,
                      height: '100%',
                      background: stats.aiCost.monthlyBudget.allowed ? '#3182F6' : '#EF4452',
                    }} />
                  </div>
                )}
              </div>

              {stats.aiCost.breakdown.length === 0 ? (
                <div style={{ padding: 16, color: '#8B95A1', fontSize: 13 }}>선택한 기간에 계측된 AI 호출이 없어요.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: 820, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {stats.aiCost.breakdown.map(row => (
                      <div
                        key={`${row.feature}:${row.provider}:${row.model}`}
                        style={{
                          display: 'grid', gridTemplateColumns: '1.1fr 1.5fr 0.7fr 0.8fr 1fr 0.8fr 0.8fr',
                          gap: 8, padding: '10px 12px', alignItems: 'center',
                          background: '#fff', border: '1px solid var(--border-light, #F2F4F6)', borderRadius: 10,
                          fontSize: 11,
                        }}
                      >
                        <strong style={{ color: '#191F28' }}>{row.feature}</strong>
                        <code style={{ color: '#4E5968' }}>{row.model}</code>
                        <span>{row.calls.toLocaleString()}회</span>
                        <strong style={{ color: '#AF52DE' }}>{formatUsd(row.costUsd)}</strong>
                        <span style={{ color: '#8B95A1' }}>in {formatTokens(row.inputTokens)} / out {formatTokens(row.outputTokens)}</span>
                        <span style={{ color: '#8B95A1' }}>{row.avgLatencyMs.toLocaleString()}ms</span>
                        <span style={{ color: row.cacheHitRate > 0 ? '#16A34A' : '#8B95A1' }}>캐시 {row.cacheHitRate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p style={{ fontSize: 10, color: '#B0B8C1', marginTop: 8 }}>
                월말 비용과 잔여 호출은 이번 달 실제 호출당 평균 비용을 기준으로 계산해요. 청구서와 소폭 다를 수 있어요.
              </p>
            </>
          )}
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
                background: '#fff', border: '1px solid var(--border-light, #F2F4F6)',
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
                background: '#fff', borderRadius: 10, border: '1px solid var(--border-light, #F2F4F6)',
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
    <div style={{ background: '#fff', border: '1px solid var(--border-light, #F2F4F6)', borderRadius: 16, padding: 20 }}>
      <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 400, color: '#8B95A1', marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  );
}

function TokenPill({ label, value }: { label: string; value: number }) {
  return (
    <span style={{ padding: '5px 9px', background: '#F8F9FA', border: '1px solid var(--border-light, #F2F4F6)', borderRadius: 8 }}>
      {label} <strong style={{ color: '#191F28' }}>{formatTokens(value)}</strong>
    </span>
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
