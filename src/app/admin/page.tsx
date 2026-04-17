'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const ADMIN_EMAILS = ['sunu.dev@gmail.com'];
const ADMIN_IDS = ['8d5fc5d7-978c-4365-a647-af90c237222b'];
const GEMINI_RPD_PER_KEY = 500;

interface GeminiKeyUsage { key_index: number; count: number }
interface UserAiUsage { user_id: string; count: number }

interface Stats {
  totalUsers: number;
  todayActiveUsers: number;
  totalAiCalls: number;
  todayAiCalls: number;
  todayChokCalls: number;
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

type AdminTab = 'stats' | 'growth' | 'codes' | 'config';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');

  useEffect(() => {
    if (loading) return;
    if (!user) { setError('로그인이 필요합니다.'); return; }
    const isAdmin = ADMIN_EMAILS.includes(user.email || '') || ADMIN_IDS.includes(user.id);
    if (!isAdmin) { setError('관리자 권한이 없습니다.'); return; }
    fetchStats();
  }, [user, loading]);

  async function fetchStats() {
    setRefreshing(true);
    try {
      const today = getTodayKST();

      const [
        { count: totalUsers },
        { count: todayAiCalls },
        { count: totalAiCalls },
        { data: activeLogs },
        { data: stockLogs },
        { data: recentLogs },
        { data: geminiRaw },
        { data: userUsageRaw },
        { count: todayChokCalls },
      ] = await Promise.all([
        supabase.from('user_portfolios').select('*', { count: 'exact', head: true }),
        // ai_usage: 오늘 AI 분석 횟수 (mentor_id != 'ai-chok')
        supabase.from('ai_usage').select('*', { count: 'exact', head: true }).eq('date', today).neq('mentor_id', 'ai-chok'),
        // ai_usage: 전체 누적 AI 분석 횟수
        supabase.from('ai_usage').select('*', { count: 'exact', head: true }).neq('mentor_id', 'ai-chok'),
        // 오늘 활성 유저: ai_usage 기준 (전체)
        supabase.from('ai_usage').select('user_id').eq('date', today),
        // 인기 종목: ai_usage 기준 (ai-analysis만)
        supabase.from('ai_usage').select('symbol').not('symbol', 'is', null).neq('mentor_id', 'ai-chok'),
        // 최근 활동: api_logs (login, stock_add 등 다양한 액션 포함)
        supabase.from('api_logs').select('action, symbol, created_at').order('created_at', { ascending: false }).limit(20),
        supabase.from('gemini_key_usage').select('key_index').eq('date', today),
        supabase.from('ai_usage').select('user_id').eq('date', today).not('user_id', 'is', null),
        // ai-chok 오늘 호출 횟수
        supabase.from('ai_usage').select('*', { count: 'exact', head: true }).eq('date', today).eq('mentor_id', 'ai-chok'),
      ]);

      // 오늘 AI 사용한 유니크 유저 수
      const uniqueActiveUsers = new Set((activeLogs || []).map(l => l.user_id).filter(Boolean)).size;

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

      setStats({
        totalUsers: totalUsers || 0,
        todayActiveUsers: uniqueActiveUsers,
        totalAiCalls: totalAiCalls || 0,
        todayAiCalls: todayAiCalls || 0,
        todayChokCalls: todayChokCalls || 0,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#191F28', marginBottom: 4 }}>주비 관리자</h1>
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

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #F2F4F6', marginBottom: 32, gap: 0 }}>
        {([['stats', '📊 통계'], ['growth', '📈 성장'], ['codes', '🎟 코드 관리'], ['config', '⚙️ 서비스 설정']] as [AdminTab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '10px 20px', fontSize: 14, fontWeight: activeTab === id ? 700 : 400,
            color: activeTab === id ? '#191F28' : '#8B95A1',
            background: 'none', border: 'none', borderBottom: activeTab === id ? '2px solid #191F28' : '2px solid transparent',
            cursor: 'pointer', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {activeTab === 'growth' && <GrowthPanel session={user} />}
      {activeTab === 'codes' && <CodesPanel session={user} />}
      {activeTab === 'config' && <ConfigPanel session={user} />}

      {activeTab === 'stats' && <>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="총 가입자" value={stats.totalUsers} unit="명" color="#3182F6" />
        <StatCard label="총 AI 분석 누적" value={stats.totalAiCalls} unit="회" color="#AF52DE" />
        <StatCard label="오늘 활성 유저 (AI 사용)" value={stats.todayActiveUsers} unit="명" color="#00C6BE" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="오늘 AI 분석 (클릭)" value={stats.todayAiCalls} unit="회" color="#FF9500" />
        <StatCard label="오늘 AI 촉 (자동)" value={stats.todayChokCalls} unit="회" color="#34C759" />
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

      </>}  {/* activeTab === 'stats' */}
    </div>
  );
}

// ── 코드 관리 패널 ────────────────────────────────────────────────────────────

function CodesPanel({ session: _session }: { session: unknown }) {
  const [type, setType] = useState('invite');
  const [count, setCount] = useState(10);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [codes, setCodes] = useState<{ code: string; type: string; use_count: number; max_uses: number; is_active: boolean; created_at: string }[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [filterType, setFilterType] = useState('invite');
  const [copied, setCopied] = useState('');

  const getToken = async () => {
    const { supabase: sb } = await import('@/lib/supabase');
    return (await sb.auth.getSession()).data.session?.access_token ?? '';
  };

  const loadCodes = async (t: string) => {
    setLoadingCodes(true);
    const token = await getToken();
    const res = await fetch(`/api/codes/generate?type=${t}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setCodes(data.codes || []);
    setLoadingCodes(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const token = await getToken();
    const res = await fetch('/api/codes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type, count, max_uses: maxUses, expires_at: expiresAt || null, description }),
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.codes.length}개 코드 생성 완료`);
      loadCodes(type);
    } else {
      alert('오류: ' + data.error);
    }
    setGenerating(false);
  };

  const toggleCode = async (code: string, isActive: boolean) => {
    const token = await getToken();
    await fetch('/api/codes/generate', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, is_active: !isActive }),
    });
    loadCodes(filterType);
  };

  const copyAll = () => {
    const active = codes.filter(c => c.is_active && c.use_count < c.max_uses);
    navigator.clipboard.writeText(active.map(c => c.code).join('\n'));
    setCopied('all');
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div>
      {/* 코드 생성 */}
      <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>코드 생성</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: '#8B95A1', display: 'block', marginBottom: 4 }}>타입</label>
            <select value={type} onChange={e => setType(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13 }}>
              <option value="invite">invite — 베타 초대</option>
              <option value="referral">referral — 리퍼럴</option>
              <option value="discount">discount — 할인</option>
              <option value="promo">promo — 프로모션</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8B95A1', display: 'block', marginBottom: 4 }}>생성 수량</label>
            <input type="number" value={count} min={1} max={100} onChange={e => setCount(Number(e.target.value))}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8B95A1', display: 'block', marginBottom: 4 }}>1코드 최대 사용</label>
            <input type="number" value={maxUses} min={1} onChange={e => setMaxUses(Number(e.target.value))}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8B95A1', display: 'block', marginBottom: 4 }}>만료일 (선택)</label>
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="메모 (선택)"
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />
        <button onClick={handleGenerate} disabled={generating}
          style={{ padding: '10px 24px', background: generating ? '#B0B8C1' : '#3182F6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer' }}>
          {generating ? '생성 중...' : `코드 ${count}개 생성`}
        </button>
      </div>

      {/* 코드 목록 */}
      <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {['invite', 'referral', 'discount', 'promo'].map(t => (
              <button key={t} onClick={() => { setFilterType(t); loadCodes(t); }}
                style={{ padding: '6px 14px', background: filterType === t ? '#191F28' : '#F2F4F6', color: filterType === t ? '#fff' : '#4E5968', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t}
              </button>
            ))}
          </div>
          <button onClick={copyAll}
            style={{ padding: '6px 14px', background: copied === 'all' ? '#20C997' : '#F2F4F6', color: copied === 'all' ? '#fff' : '#4E5968', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {copied === 'all' ? '복사됨 ✓' : '미사용 전체 복사'}
          </button>
        </div>

        {loadingCodes ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#8B95A1', fontSize: 13 }}>불러오는 중...</div>
        ) : codes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#B0B8C1', fontSize: 13 }}>코드를 먼저 생성하거나 타입을 선택해주세요</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {codes.map(c => (
              <div key={c.code} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: '#F8F9FA', borderRadius: 10,
                border: '1px solid #F2F4F6', opacity: c.is_active ? 1 : 0.4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>{c.code}</span>
                  <span style={{ fontSize: 11, color: '#8B95A1' }}>{c.use_count}/{c.max_uses}회</span>
                  {c.use_count >= c.max_uses && <span style={{ fontSize: 11, color: '#B0B8C1', background: '#F2F4F6', padding: '2px 6px', borderRadius: 4 }}>소진</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#B0B8C1' }}>
                    {new Date(c.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                  <button onClick={() => { navigator.clipboard.writeText(c.code); setCopied(c.code); setTimeout(() => setCopied(''), 1500); }}
                    style={{ padding: '4px 10px', background: copied === c.code ? '#20C997' : '#F2F4F6', color: copied === c.code ? '#fff' : '#4E5968', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                    {copied === c.code ? '✓' : '복사'}
                  </button>
                  <button onClick={() => toggleCode(c.code, c.is_active)}
                    style={{ padding: '4px 10px', background: c.is_active ? 'rgba(239,68,82,0.08)' : 'rgba(32,201,151,0.08)', color: c.is_active ? '#EF4452' : '#20C997', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                    {c.is_active ? '비활성화' : '활성화'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 서비스 설정 패널 ──────────────────────────────────────────────────────────

function ConfigPanel({ session: _session }: { session: unknown }) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const getToken = async () => {
    const { supabase: sb } = await import('@/lib/supabase');
    return (await sb.auth.getSession()).data.session?.access_token ?? '';
  };

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(({ config: c }) => setConfig(c || {}));
  }, []);

  const update = (key: string, value: string) => setConfig(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    const token = await getToken();
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ updates: config }),
    });
    const data = await res.json();
    if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    else alert('저장 실패: ' + data.error);
    setSaving(false);
  };

  const modeLabels: Record<string, string> = {
    beta: '🔒 베타',
    waitlist: '📋 대기자',
    open: '🌐 오픈',
    maintenance: '🛠 점검',
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 28 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 24 }}>서비스 설정</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#191F28', display: 'block', marginBottom: 8 }}>서비스 모드</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(modeLabels).map(([val, label]) => (
              <button key={val} onClick={() => update('service_mode', val)}
                style={{ padding: '8px 20px', background: config.service_mode === val ? '#191F28' : '#F2F4F6', color: config.service_mode === val ? '#fff' : '#4E5968', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#8B95A1', marginTop: 6 }}>
            현재: <strong>{config.service_mode || '불러오는 중'}</strong>
            {config.service_mode === 'beta' && ' — 초대 코드 있는 사용자만 접근 가능'}
            {config.service_mode === 'open' && ' — 누구나 즉시 가입 가능'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F8F9FA', borderRadius: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>초대 코드 필수</div>
            <div style={{ fontSize: 12, color: '#8B95A1', marginTop: 2 }}>OFF 시 코드 없이 바로 가입 가능</div>
          </div>
          <button onClick={() => update('invite_required', config.invite_required === 'true' ? 'false' : 'true')}
            style={{ width: 48, height: 26, background: config.invite_required === 'true' ? '#3182F6' : '#E5E8EB', border: 'none', borderRadius: 13, cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
            <span style={{ position: 'absolute', top: 3, left: config.invite_required === 'true' ? 24 : 3, width: 20, height: 20, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: '#8B95A1', display: 'block', marginBottom: 4 }}>베타 최대 인원 (0=무제한)</label>
            <input type="number" value={config.beta_max_users || ''} onChange={e => update('beta_max_users', e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8B95A1', display: 'block', marginBottom: 4 }}>베타 자동 종료 날짜</label>
            <input type="date" value={config.beta_end_date || ''} onChange={e => update('beta_end_date', e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#191F28', display: 'block', marginBottom: 8 }}>AI 분석 일일 한도</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {([['ai_beta_limit', '베타 유저'], ['ai_daily_limit', '일반 유저'], ['ai_admin_limit', '관리자 (0=무제한)']] as [string, string][]).map(([key, label]) => (
              <div key={key}>
                <label style={{ fontSize: 12, color: '#8B95A1', display: 'block', marginBottom: 4 }}>{label}</label>
                <input type="number" value={config[key] || ''} onChange={e => update(key, e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
        </div>

        <button onClick={save} disabled={saving}
          style={{ padding: '12px 32px', background: saved ? '#20C997' : saving ? '#B0B8C1' : '#3182F6', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', alignSelf: 'flex-start', transition: 'background 0.2s' }}>
          {saved ? '저장됨 ✓' : saving ? '저장 중...' : '설정 저장'}
        </button>
      </div>
    </div>
  );
}

// ── 성장 패널 ─────────────────────────────────────────────────────────────────

interface GrowthData {
  dateList: string[];
  signupByDate: { date: string; count: number }[];
  dauByDate: { date: string; count: number }[];
  aiByDate: { date: string; count: number }[];
  actionCount: Record<string, number>;
  d7Retention: number | null;
  d1Retention: number | null;
  peakDau: number;
  todayDau: number;
  totalUsers: number;
  totalAiUsage: number;
  checks: { id: string; label: string; target: number; current: number; unit: string; done: boolean }[];
  readinessPct: number;
}

function MiniBarChart({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  const maxVal = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56 }}>
      {data.map(d => {
        const pct = maxVal > 0 ? (d.count / maxVal) * 100 : 0;
        const barH = Math.max(pct * 0.48, pct > 0 ? 3 : 0);
        return (
          <div key={d.date} title={`${d.date}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: '100%', height: barH, background: color, borderRadius: '3px 3px 0 0' }} />
            <span style={{ fontSize: 9, color: '#B0B8C1', whiteSpace: 'nowrap' }}>{d.date.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

function GrowthPanel({ session: _session }: { session: unknown }) {
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);

  const getToken = async () => {
    const { supabase: sb } = await import('@/lib/supabase');
    return (await sb.auth.getSession()).data.session?.access_token ?? '';
  };

  const load = async (d: number) => {
    setLoading(true);
    const token = await getToken();
    const res = await fetch(`/api/admin/growth?days=${d}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => { load(days); }, [days]);

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#8B95A1' }}>성장 데이터 불러오는 중...</div>;
  if (!data) return <div style={{ padding: 48, textAlign: 'center', color: '#EF4452' }}>불러오기 실패</div>;

  const aiRate = data.totalUsers > 0 ? Math.round((data.totalAiUsage / data.totalUsers) * 100) : 0;

  return (
    <div>
      {/* 기간 선택 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[7, 14, 30].map(d => (
          <button key={d} onClick={() => setDays(d)}
            style={{ padding: '6px 16px', background: days === d ? '#191F28' : '#F2F4F6', color: days === d ? '#fff' : '#4E5968', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            최근 {d}일
          </button>
        ))}
      </div>

      {/* 앱스토어 준비도 */}
      <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#191F28' }}>앱스토어 출시 준비도</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 80, height: 8, background: '#F2F4F6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${data.readinessPct}%`, height: '100%', background: data.readinessPct >= 80 ? '#20C997' : data.readinessPct >= 60 ? '#FF9500' : '#3182F6', borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: data.readinessPct >= 80 ? '#20C997' : '#191F28' }}>{data.readinessPct}%</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.checks.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: c.done ? 'rgba(32,201,151,0.06)' : '#F8F9FA', borderRadius: 10, border: `1px solid ${c.done ? 'rgba(32,201,151,0.2)' : '#F2F4F6'}` }}>
              <span style={{ fontSize: 16 }}>{c.done ? '✅' : '⬜'}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: c.done ? '#20C997' : '#191F28' }}>{c.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: c.done ? '#20C997' : '#8B95A1' }}>
                {c.current}{c.unit} / {c.target}{c.unit}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 핵심 지표 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: '총 가입자', value: data.totalUsers, unit: '명', color: '#3182F6' },
          { label: '오늘 DAU', value: data.todayDau, unit: '명', color: '#00C6BE' },
          { label: '최고 DAU', value: data.peakDau, unit: '명', color: '#FF9500' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: c.color }}>
              {c.value.toLocaleString()}
              <span style={{ fontSize: 13, fontWeight: 400, color: '#8B95A1', marginLeft: 4 }}>{c.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'D1 리텐션', value: data.d1Retention, unit: '%', color: '#AF52DE' },
          { label: 'D7 리텐션', value: data.d7Retention, unit: '%', color: '#AF52DE' },
          { label: 'AI 사용률', value: aiRate, unit: '%', color: '#34C759' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: c.value === null ? '#B0B8C1' : c.color }}>
              {c.value === null ? '—' : c.value}
              {c.value !== null && <span style={{ fontSize: 13, fontWeight: 400, color: '#8B95A1', marginLeft: 4 }}>{c.unit}</span>}
            </div>
            {c.value === null && <div style={{ fontSize: 11, color: '#B0B8C1' }}>코호트 데이터 부족</div>}
          </div>
        ))}
      </div>

      {/* 일별 차트 3종 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        {[
          { title: '일별 신규 가입', data: data.signupByDate, color: '#3182F6' },
          { title: '일별 DAU', data: data.dauByDate, color: '#00C6BE' },
          { title: '일별 AI 사용', data: data.aiByDate, color: '#AF52DE' },
        ].map(chart => (
          <div key={chart.title} style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#191F28', marginBottom: 12 }}>{chart.title}</div>
            <MiniBarChart data={chart.data} color={chart.color} />
            <div style={{ fontSize: 12, color: '#8B95A1', marginTop: 8, textAlign: 'right' }}>
              합계 {chart.data.reduce((s, d) => s + d.count, 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* 기능별 사용량 */}
      <div style={{ background: '#fff', border: '1px solid #F2F4F6', borderRadius: 16, padding: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#191F28' }}>기능별 사용량 (최근 {days}일)</h3>
        {Object.keys(data.actionCount).length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {Object.entries(data.actionCount)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 12)
              .map(([action, count]) => {
                const maxCount = Math.max(...Object.values(data.actionCount));
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={action} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: '#4E5968', width: 120, flexShrink: 0, fontFamily: 'monospace' }}>{action}</span>
                    <div style={{ flex: 1, height: 6, background: '#F2F4F6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#3182F6', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#191F28', width: 36, textAlign: 'right' }}>{count}</span>
                  </div>
                );
              })}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#B0B8C1', textAlign: 'center', padding: '20px 0' }}>데이터 없음</div>
        )}
      </div>
    </div>
  );
}
