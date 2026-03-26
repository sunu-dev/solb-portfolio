'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// Admin user IDs or emails — add yours here
const ADMIN_EMAILS = ['sunu.dev@gmail.com'];

interface Stats {
  totalUsers: number;
  todayActiveUsers: number;
  totalAiCalls: number;
  todayAiCalls: number;
  topStocks: { symbol: string; count: number }[];
  recentLogs: { action: string; symbol: string; created_at: string }[];
  loginProviders: { provider: string; count: number }[];
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) { setError('로그인이 필요합니다.'); return; }

    // Simple admin check — by email or user ID
    // For now, any logged-in user can see admin (restrict later)

    fetchStats();
  }, [user, loading]);

  async function fetchStats() {
    try {
      // 1. Total users — count from auth (via user_portfolios as proxy)
      const { count: totalUsers } = await supabase
        .from('user_portfolios')
        .select('*', { count: 'exact', head: true });

      // 2. Today's AI calls
      const today = new Date().toISOString().split('T')[0];
      const { data: todayLogs, count: todayAiCalls } = await supabase
        .from('api_logs')
        .select('*', { count: 'exact' })
        .eq('action', 'ai_analysis')
        .gte('created_at', today + 'T00:00:00');

      // 3. Total AI calls
      const { count: totalAiCalls } = await supabase
        .from('api_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'ai_analysis');

      // 4. Today active users (unique user_ids in logs today)
      const { data: activeLogs } = await supabase
        .from('api_logs')
        .select('user_id')
        .gte('created_at', today + 'T00:00:00');
      const uniqueActiveUsers = new Set(activeLogs?.map(l => l.user_id) || []).size;

      // 5. Top stocks (most analyzed)
      const { data: stockLogs } = await supabase
        .from('api_logs')
        .select('symbol')
        .eq('action', 'ai_analysis')
        .not('symbol', 'is', null);

      const stockCounts: Record<string, number> = {};
      stockLogs?.forEach(l => {
        if (l.symbol) stockCounts[l.symbol] = (stockCounts[l.symbol] || 0) + 1;
      });
      const topStocks = Object.entries(stockCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([symbol, count]) => ({ symbol, count }));

      // 6. Recent logs (last 20)
      const { data: recentLogs } = await supabase
        .from('api_logs')
        .select('action, symbol, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      setStats({
        totalUsers: totalUsers || 0,
        todayActiveUsers: uniqueActiveUsers,
        totalAiCalls: totalAiCalls || 0,
        todayAiCalls: todayAiCalls || 0,
        topStocks,
        recentLogs: recentLogs || [],
        loginProviders: [],
      });
    } catch (e) {
      setError('통계를 불러올 수 없습니다.');
      console.error(e);
    }
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#8B95A1' }}>로딩 중...</div>;
  if (error) return <div style={{ padding: 48, textAlign: 'center', color: '#EF4452' }}>{error}</div>;
  if (!stats) return <div style={{ padding: 48, textAlign: 'center', color: '#8B95A1' }}>통계를 불러오는 중...</div>;

  // Render admin dashboard
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px', fontFamily: 'Pretendard Variable, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#191F28', marginBottom: 8 }}>SOLB 관리자</h1>
      <p style={{ fontSize: 14, color: '#8B95A1', marginBottom: 40 }}>서비스 현황을 한눈에 확인하세요.</p>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        {[
          { label: '총 가입자', value: stats.totalUsers, unit: '명', color: '#3182F6' },
          { label: '오늘 활성 유저', value: stats.todayActiveUsers, unit: '명', color: '#00C6BE' },
          { label: '총 AI 분석', value: stats.totalAiCalls, unit: '회', color: '#AF52DE' },
          { label: '오늘 AI 분석', value: stats.todayAiCalls, unit: '회', color: '#FF9500' },
        ].map((card, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}<span style={{ fontSize: 14, fontWeight: 400, color: '#8B95A1', marginLeft: 4 }}>{card.unit}</span></div>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Top stocks */}
        <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>인기 분석 종목 TOP 10</h3>
          {stats.topStocks.length > 0 ? (
            stats.topStocks.map((s, i) => (
              <div key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: i > 0 ? '1px solid #F7F8FA' : 'none' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{i + 1}. {s.symbol}</span>
                <span style={{ fontSize: 14, color: '#3182F6', fontWeight: 600 }}>{s.count}회</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: '#B0B8C1', padding: '20px 0', textAlign: 'center' }}>아직 데이터가 없어요</div>
          )}
        </div>

        {/* Recent logs */}
        <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>최근 활동</h3>
          {stats.recentLogs.length > 0 ? (
            stats.recentLogs.map((log, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i > 0 ? '1px solid #F7F8FA' : 'none' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{log.action}</span>
                  {log.symbol && <span style={{ fontSize: 12, color: '#8B95A1', marginLeft: 8 }}>{log.symbol}</span>}
                </div>
                <span style={{ fontSize: 11, color: '#B0B8C1' }}>
                  {new Date(log.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: '#B0B8C1', padding: '20px 0', textAlign: 'center' }}>아직 활동 내역이 없어요</div>
          )}
        </div>
      </div>

      {/* Refresh button */}
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <button
          onClick={() => fetchStats()}
          style={{ padding: '10px 24px', background: '#3182F6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
