'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const ADMIN_EMAILS = ['sunu.dev@gmail.com'];
const GEMINI_RPD_PER_KEY = 500;

interface GeminiKeyUsage { key_index: number; count: number }
interface UserAiUsage { user_id: string; count: number }

interface Stats {
  totalUsers: number;
  todayActiveUsers: number;
  totalAiCalls: number;
  todayAiCalls: number;
  topStocks: { symbol: string; count: number }[];
  recentLogs: { action: string; symbol: string; created_at: string }[];
  geminiUsage: GeminiKeyUsage[];
  userAiUsage: UserAiUsage[];
  limits: { guest: number; user: number; total: number };
}

function getTodayKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

// ── UI 헬퍼 ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24 }}>
      <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>
        {value.toLocaleString()}
        <span style={{ fontSize: 14, fontWeight: 400, color: '#8B95A1', marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  );
}

function QuotaBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const barColor = pct >= 90 ? '#EF4452' : pct >= 70 ? '#FF9500' : color;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#191F28' }}>{label}</span>
        <span style={{ fontSize: 13, color: barColor, fontWeight: 700 }}>
          {used.toLocaleString()} / {total.toLocaleString()} RPD ({pct}%)
        </span>
      </div>
      <div style={{ height: 8, background: '#F2F4F6', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setError('로그인이 필요합니다.'); return; }
    if (!ADMIN_EMAILS.includes(user.email || '')) { setError('관리자 권한이 없습니다.'); return; }
    fetchStats();
  }, [user, loading]);

  async function fetchStats() {
    setRefreshing(true);
    try {
      const today = getTodayKST();

      const [
        { count: totalUsers },
        { data: todayLogs, count: todayAiCalls },
        { count: totalAiCalls },
        { data: activeLogs },
        { data: stockLogs },
        { data: recentLogs },
        { data: geminiRaw },
        { data: userUsageRaw },
      ] = await Promise.all([
        supabase.from('user_portfolios').select('*', { count: 'exact', head: true }),
        supabase.from('api_logs').select('*', { count: 'exact' }).eq('action', 'ai_analysis').gte('created_at', today + 'T00:00:00'),
        supabase.from('api_logs').select('*', { count: 'exact', head: true }).eq('action', 'ai_analysis'),
        supabase.from('api_logs').select('user_id').gte('created_at', today + 'T00:00:00'),
        supabase.from('api_logs').select('symbol').eq('action', 'ai_analysis').not('symbol', 'is', null),
        supabase.from('api_logs').select('action, symbol, created_at').order('created_at', { ascending: false }).limit(20),
        supabase.from('gemini_key_usage').select('key_index').eq('date', today),
        supabase.from('ai_usage').select('user_id').eq('date', today).not('user_id', 'is', null),
      ]);

      // 오늘 활성 유저
      const uniqueActiveUsers = new Set((activeLogs || []).map(l => l.user_id)).size;

      // 인기 종목
      const stockCounts: Record<string, number> = {};
      (stockLogs || []).forEach(l => { if (l.symbol) stockCounts[l.symbol] = (stockCounts[l.symbol] || 0) + 1; });
      const topStocks = Object.entries(stockCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([symbol, count]) => ({ symbol, count }));

      // Gemini 키별 사용량 집계
      const geminiCounts: Record<number, number> = {};
      (geminiRaw || []).forEach(r => { geminiCounts[r.key_index] = (geminiCounts[r.key_index] || 0) + 1; });
      const geminiUsage: GeminiKeyUsage[] = [0, 1].map(ki => ({ key_index: ki, count: geminiCounts[ki] || 0 }));

      // 유저별 AI 사용량 집계
      const userCounts: Record<string, number> = {};
      (userUsageRaw || []).forEach(r => { if (r.user_id) userCounts[r.user_id] = (userCounts[r.user_id] || 0) + 1; });
      const userAiUsage: UserAiUsage[] = Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([user_id, count]) => ({ user_id, count }));

      void todayLogs;

      setStats({
        totalUsers: totalUsers || 0,
        todayActiveUsers: uniqueActiveUsers,
        totalAiCalls: totalAiCalls || 0,
        todayAiCalls: todayAiCalls || 0,
        topStocks,
        recentLogs: recentLogs || [],
        geminiUsage,
        userAiUsage,
        limits: { guest: 3, user: 10, total: 250 },
      });
    } catch (e) {
      setError('통계를 불러올 수 없습니다.');
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#8B95A1' }}>로딩 중...</div>;
  if (!user && !loading) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>관리자 페이지</div>
      <div style={{ fontSize: 14, color: '#8B95A1' }}>로그인이 필요합니다.</div>
    </div>
  );
  if (error) return <div style={{ padding: 48, textAlign: 'center', color: '#EF4452' }}>{error}</div>;
  if (!stats) return <div style={{ padding: 48, textAlign: 'center', color: '#8B95A1' }}>통계를 불러오는 중...</div>;

  const totalGeminiUsed = stats.geminiUsage.reduce((s, k) => s + k.count, 0);
  const totalGeminiMax = GEMINI_RPD_PER_KEY * 2;
  const quotaWarnPct = Math.round((totalGeminiUsed / totalGeminiMax) * 100);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px', fontFamily: 'Pretendard Variable, sans-serif' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#191F28', marginBottom: 4 }}>솔비서 관리자</h1>
          <p style={{ fontSize: 13, color: '#8B95A1' }}>{getTodayKST()} 기준 · KST</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={refreshing}
          style={{ padding: '8px 20px', background: refreshing ? '#F2F4F6' : '#3182F6', color: refreshing ? '#8B95A1' : '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer' }}
        >
          {refreshing ? '로딩 중...' : '새로고침'}
        </button>
      </div>

      {/* 쿼터 경고 배너 */}
      {quotaWarnPct >= 70 && (
        <div style={{
          background: quotaWarnPct >= 90 ? 'rgba(239,68,82,0.08)' : 'rgba(255,149,0,0.08)',
          border: `1px solid ${quotaWarnPct >= 90 ? 'rgba(239,68,82,0.2)' : 'rgba(255,149,0,0.2)'}`,
          borderRadius: 12, padding: '12px 16px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>{quotaWarnPct >= 90 ? '🚨' : '⚠️'}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: quotaWarnPct >= 90 ? '#EF4452' : '#FF9500' }}>
            오늘 Gemini 쿼터 {quotaWarnPct}% 사용됨 — {quotaWarnPct >= 90 ? '즉시 확인 필요' : '주의 필요'}
          </span>
        </div>
      )}

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="총 가입자" value={stats.totalUsers} unit="명" color="#3182F6" />
        <StatCard label="오늘 활성 유저" value={stats.todayActiveUsers} unit="명" color="#00C6BE" />
        <StatCard label="총 AI 분석" value={stats.totalAiCalls} unit="회" color="#AF52DE" />
        <StatCard label="오늘 AI 분석" value={stats.todayAiCalls} unit="회" color="#FF9500" />
      </div>

      {/* Gemini 쿼터 + 한도 설정 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Gemini 쿼터 게이지 */}
        <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: '#191F28' }}>Gemini 쿼터 (오늘)</h3>
          {stats.geminiUsage.map(k => (
            <QuotaBar
              key={k.key_index}
              label={`키 ${k.key_index + 1}`}
              used={k.count}
              total={GEMINI_RPD_PER_KEY}
              color="#3182F6"
            />
          ))}
          <div style={{ borderTop: '1px solid #F2F4F6', paddingTop: 16, marginTop: 4 }}>
            <QuotaBar label="전체 합산" used={totalGeminiUsed} total={totalGeminiMax} color="#191F28" />
          </div>
          <p style={{ fontSize: 11, color: '#B0B8C1', marginTop: 8 }}>* 다른 Google 계정 키 × 500 RPD</p>
        </div>

        {/* AI 한도 현황 */}
        <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: '#191F28' }}>AI 분석 한도 설정</h3>
          {[
            { label: '비로그인 유저', key: 'guest', value: stats.limits.guest, unit: '회/일' },
            { label: '로그인 유저', key: 'user', value: stats.limits.user, unit: '회/일' },
            { label: '전체 일일 한도', key: 'total', value: stats.limits.total, unit: '회/일' },
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F7F8FA' }}>
              <span style={{ fontSize: 13, color: '#4E5968' }}>{item.label}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#191F28' }}>
                {item.value}<span style={{ fontSize: 12, color: '#8B95A1', marginLeft: 2 }}>{item.unit}</span>
              </span>
            </div>
          ))}
          <p style={{ fontSize: 11, color: '#B0B8C1', marginTop: 16 }}>
            Vercel 환경변수에서 변경<br />
            AI_DAILY_LIMIT_GUEST / AI_DAILY_LIMIT_USER / AI_DAILY_LIMIT_TOTAL
          </p>
        </div>
      </div>

      {/* 유저별 AI 사용량 + 인기 종목 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* 유저별 오늘 AI 사용량 */}
        <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#191F28' }}>유저별 AI 사용량 (오늘)</h3>
          {stats.userAiUsage.length > 0 ? stats.userAiUsage.map((u, i) => (
            <div key={u.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: i > 0 ? '1px solid #F7F8FA' : 'none' }}>
              <span style={{ fontSize: 13, color: '#4E5968', fontFamily: 'monospace' }}>
                {u.user_id.slice(0, 8)}…
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: u.count >= stats.limits.user ? '#EF4452' : '#3182F6' }}>
                {u.count}회
              </span>
            </div>
          )) : (
            <div style={{ fontSize: 13, color: '#B0B8C1', padding: '20px 0', textAlign: 'center' }}>오늘 AI 사용 없음</div>
          )}
        </div>

        {/* 인기 분석 종목 */}
        <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#191F28' }}>인기 분석 종목 TOP 10</h3>
          {stats.topStocks.length > 0 ? stats.topStocks.map((s, i) => (
            <div key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: i > 0 ? '1px solid #F7F8FA' : 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{i + 1}. {s.symbol}</span>
              <span style={{ fontSize: 13, color: '#3182F6', fontWeight: 600 }}>{s.count}회</span>
            </div>
          )) : (
            <div style={{ fontSize: 13, color: '#B0B8C1', padding: '20px 0', textAlign: 'center' }}>아직 데이터가 없어요</div>
          )}
        </div>
      </div>

      {/* 최근 활동 */}
      <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#191F28' }}>최근 활동</h3>
        {stats.recentLogs.length > 0 ? stats.recentLogs.map((log, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i > 0 ? '1px solid #F7F8FA' : 'none' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{log.action}</span>
              {log.symbol && <span style={{ fontSize: 12, color: '#8B95A1', marginLeft: 8 }}>{log.symbol}</span>}
            </div>
            <span style={{ fontSize: 11, color: '#B0B8C1' }}>
              {new Date(log.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )) : (
          <div style={{ fontSize: 13, color: '#B0B8C1', padding: '20px 0', textAlign: 'center' }}>아직 활동 내역이 없어요</div>
        )}
      </div>

    </div>
  );
}
