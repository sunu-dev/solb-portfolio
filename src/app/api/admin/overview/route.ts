import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { requireServiceClient } from '@/lib/supabaseServer';

export const GET = defineRoute({
  name: '/api/admin/overview',
  auth: 'admin',
  handler: async () => {
      const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const supabase = requireServiceClient();

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
        supabase.from('user_portfolios').select('*', { count: 'exact', head: true }).throwOnError(),
        // ai_usage: 오늘 AI 분석 횟수 (mentor_id != 'ai-chok')
        supabase.from('ai_usage').select('*', { count: 'exact', head: true }).eq('date', today).neq('mentor_id', 'ai-chok').throwOnError(),
        // ai_usage: 전체 누적 AI 분석 횟수
        supabase.from('ai_usage').select('*', { count: 'exact', head: true }).neq('mentor_id', 'ai-chok').throwOnError(),
        // 오늘 활성 유저: ai_usage 기준 (전체)
        supabase.from('ai_usage').select('user_id').eq('date', today).throwOnError(),
        // 인기 종목: ai_usage 기준 (ai-analysis만)
        supabase.from('ai_usage').select('symbol').not('symbol', 'is', null).neq('mentor_id', 'ai-chok').throwOnError(),
        // 최근 활동: api_logs (login, stock_add 등 다양한 액션 포함)
        supabase.from('api_logs').select('action, symbol, created_at').order('created_at', { ascending: false }).limit(20).throwOnError(),
        supabase.from('gemini_key_usage').select('key_index').eq('date', today).throwOnError(),
        supabase.from('ai_usage').select('user_id').eq('date', today).not('user_id', 'is', null).throwOnError(),
        // ai-chok 오늘 호출 횟수
        supabase.from('ai_usage').select('*', { count: 'exact', head: true }).eq('date', today).eq('mentor_id', 'ai-chok').throwOnError(),
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
      const geminiUsage = [0, 1].map(ki => ({ key_index: ki, count: geminiCounts[ki] || 0 }));

      // 유저별 AI 사용량 집계
      const userCounts: Record<string, number> = {};
      (userUsageRaw || []).forEach(r => { if (r.user_id) userCounts[r.user_id] = (userCounts[r.user_id] || 0) + 1; });
      const userAiUsage = Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([user_id, count]) => ({ user_id, count }));

      return NextResponse.json({
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
      }, { headers: { 'Cache-Control': 'private, no-store' } });
  },
});
