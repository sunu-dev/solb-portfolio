import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_IDS = ['8d5fc5d7-978c-4365-a647-af90c237222b'];
const ADMIN_EMAILS = ['soonooya@gmail.com', 'sunu.develop@gmail.com'];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

function getKSTDateString(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function getDaysAgo(days: number): string {
  return getKSTDateString(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}

export async function GET(req: NextRequest) {
  // 관리자 인증
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const isAdmin = ADMIN_EMAILS.includes(user.email || '') || ADMIN_IDS.includes(user.id);
  if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const days = parseInt(req.nextUrl.searchParams.get('days') || '14');
  const since = getDaysAgo(days);

  try {
    const [signupsRes, logsRes, aiRes, totalUsersRes, feedbackRes] = await Promise.all([
      // 일별 신규 가입 (user_portfolios.created_at 기준)
      supabaseAdmin
        .from('user_portfolios')
        .select('created_at')
        .gte('created_at', since + 'T00:00:00+09:00'),

      // 일별 활성 유저 (api_logs의 user_id 기준) — metadata는 feature_first_use 채택 코호트용
      supabaseAdmin
        .from('api_logs')
        .select('user_id, action, created_at, metadata')
        .gte('created_at', since + 'T00:00:00+09:00')
        .not('user_id', 'is', null),

      // 일별 AI 사용 (ai_usage 기준)
      supabaseAdmin
        .from('ai_usage')
        .select('date, user_id, mentor_id')
        .gte('date', since),

      // 전체 가입자 수
      supabaseAdmin
        .from('user_portfolios')
        .select('created_at, user_id'),

      // AI 피드백 (ai_feedback 테이블, P0-3)
      supabaseAdmin
        .from('ai_feedback')
        .select('source, rating, created_at')
        .gte('created_at', since + 'T00:00:00+09:00'),
    ]);

    // ── 날짜 배열 생성 (최근 N일) ──────────────────────────────
    const dateList: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      dateList.push(getDaysAgo(i));
    }

    // ── 일별 신규 가입 집계 ────────────────────────────────────
    const signupByDate: Record<string, number> = {};
    dateList.forEach(d => { signupByDate[d] = 0; });
    (signupsRes.data || []).forEach(row => {
      const d = getKSTDateString(new Date(row.created_at));
      if (signupByDate[d] !== undefined) signupByDate[d]++;
    });

    // ── 일별 DAU 집계 ─────────────────────────────────────────
    const dauByDate: Record<string, Set<string>> = {};
    dateList.forEach(d => { dauByDate[d] = new Set(); });
    (logsRes.data || []).forEach(row => {
      const d = getKSTDateString(new Date(row.created_at));
      if (dauByDate[d]) dauByDate[d].add(row.user_id);
    });

    // ── 기능별 사용량 ─────────────────────────────────────────
    const actionCount: Record<string, number> = {};
    (logsRes.data || []).forEach(row => {
      actionCount[row.action] = (actionCount[row.action] || 0) + 1;
    });

    // ── 일별 AI 사용 집계 ─────────────────────────────────────
    const aiByDate: Record<string, number> = {};
    dateList.forEach(d => { aiByDate[d] = 0; });
    (aiRes.data || []).forEach(row => {
      if (aiByDate[row.date] !== undefined) aiByDate[row.date]++;
    });

    // ── D7 리텐션 계산 ────────────────────────────────────────
    // 14일 전 ~ 7일 전 가입자 중 이후 7일 내 재방문한 비율
    const allUsers = signupsRes.data || [];
    const cohortStart = getDaysAgo(14);
    const cohortEnd = getDaysAgo(7);
    const cohortUsers = (totalUsersRes.data || []).filter(u => {
      const d = getKSTDateString(new Date(u.created_at));
      return d >= cohortStart && d <= cohortEnd;
    });

    const activeUserIds = new Set((logsRes.data || []).map(r => r.user_id));
    const returnedCount = cohortUsers.filter(u => activeUserIds.has(u.user_id)).length;
    const d7Retention = cohortUsers.length > 0
      ? Math.round((returnedCount / cohortUsers.length) * 100)
      : null;

    // ── D1 리텐션 ─────────────────────────────────────────────
    const d1CohortStart = getDaysAgo(8);
    const d1CohortEnd = getDaysAgo(2);
    const d1Cohort = (totalUsersRes.data || []).filter(u => {
      const d = getKSTDateString(new Date(u.created_at));
      return d >= d1CohortStart && d <= d1CohortEnd;
    });
    const d1Returned = d1Cohort.filter(u => activeUserIds.has(u.user_id)).length;
    const d1Retention = d1Cohort.length > 0
      ? Math.round((d1Returned / d1Cohort.length) * 100)
      : null;

    // ── 최고 DAU ──────────────────────────────────────────────
    const dauValues = dateList.map(d => dauByDate[d].size);
    const peakDau = Math.max(...dauValues, 0);
    const todayDau = dauByDate[dateList[dateList.length - 1]]?.size ?? 0;

    // ── 전체 통계 ─────────────────────────────────────────────
    const totalUsers = (totalUsersRes.data || []).length;
    const totalAiUsage = (aiRes.data || []).filter(r => r.mentor_id !== 'ai-chok').length;

    // ── 앱스토어 준비도 체크리스트 ────────────────────────────
    const checks = [
      { id: 'users',     label: '가입자 30명 이상',           target: 30,  current: totalUsers,  unit: '명', done: totalUsers >= 30 },
      { id: 'dau',       label: 'DAU 10명 이상 달성',         target: 10,  current: peakDau,     unit: '명', done: peakDau >= 10 },
      { id: 'd7',        label: 'D7 리텐션 30% 이상',         target: 30,  current: d7Retention ?? 0, unit: '%', done: (d7Retention ?? 0) >= 30 },
      { id: 'ai_rate',   label: 'AI 분석 사용률 40% 이상',    target: 40,  current: totalUsers > 0 ? Math.round((totalAiUsage / totalUsers) * 100) : 0, unit: '%', done: totalUsers > 0 && totalAiUsage / totalUsers >= 0.4 },
      { id: 'retention', label: 'D1 리텐션 50% 이상',         target: 50,  current: d1Retention ?? 0, unit: '%', done: (d1Retention ?? 0) >= 50 },
    ];
    const readinessPct = Math.round((checks.filter(c => c.done).length / checks.length) * 100);

    // ── 온보딩 funnel (P0-6) ──────────────────────────────────
    // 각 단계 진입 / 완료 / 스킵 카운트
    const onboardingFunnel = {
      step0: actionCount['onboarding_step_view'] ? 0 : 0,  // detail은 metadata에 있음 — 일단 step별 분리 못함
      view: actionCount['onboarding_step_view'] || 0,
      complete: actionCount['onboarding_complete'] || 0,
      skip: actionCount['onboarding_skip'] || 0,
      samplePortfolio: actionCount['onboarding_sample_portfolio'] || 0,
      stockAdd: actionCount['onboarding_stock_add'] || 0,
    };

    // ── 본 화면 투어 funnel ────────────────────────────────────
    const tourFunnel = {
      started: actionCount['tour_started'] || 0,
      step: actionCount['tour_step'] || 0,
      completed: actionCount['tour_completed'] || 0,
      skipped: actionCount['tour_skipped'] || 0,
      anchorMissing: actionCount['tour_anchor_missing'] || 0,  // 앵커 미마운트(데드앵커 아님)
    };

    // ── 기능 첫 사용(채택) + 투어 코호트 (KPI: 투어 본 코호트가 더 많이 채택하는가) ──
    const tourUserIds = new Set(
      (logsRes.data || [])
        .filter(r => r.action === 'tour_started' || r.action === 'tour_completed')
        .map(r => r.user_id)
    );
    const featUseByUser = new Map<string, Set<string>>();
    (logsRes.data || []).forEach(row => {
      if (row.action !== 'feature_first_use' || !row.user_id) return;
      const fid = (row.metadata as { featureId?: string } | null)?.featureId;
      if (!fid) return;
      if (!featUseByUser.has(row.user_id)) featUseByUser.set(row.user_id, new Set());
      featUseByUser.get(row.user_id)!.add(fid);
    });
    // featureId별 채택 유저 수
    const featureAdoption: Record<string, number> = {};
    featUseByUser.forEach(set => set.forEach(fid => { featureAdoption[fid] = (featureAdoption[fid] || 0) + 1; }));
    // 코호트별 평균 채택 기능 수 (활성 유저 전체 기준 — 0건 포함).
    // ⚠️ tourUserIds는 api_logs(로그인) 기준이라, 게스트로 투어 본 뒤 로그인한 유저는 'notWatched'로 분류될 수 있음
    //    (게스트 tour_started는 tour_events로 감). Phase 2엔 게스트 투어가 거의 없어 편향 작으나, Phase 3에서 보정 필요.
    const avgFeatures = (ids: string[]) =>
      ids.length ? Math.round((ids.reduce((s, u) => s + (featUseByUser.get(u)?.size || 0), 0) / ids.length) * 10) / 10 : 0;
    const activeArr = [...activeUserIds].filter(Boolean) as string[];
    const cohortWatched = activeArr.filter(u => tourUserIds.has(u));
    const cohortNot = activeArr.filter(u => !tourUserIds.has(u));
    const adoptionCohort = {
      tourWatched: { users: cohortWatched.length, avgFeatures: avgFeatures(cohortWatched) },
      notWatched:  { users: cohortNot.length, avgFeatures: avgFeatures(cohortNot) },
    };

    // ── 게스트(비로그인) 투어 funnel — tour_events. 마이그레이션 적용 전엔 available:false (대시보드 무중단) ──
    let guestFunnel: {
      available: boolean; distinctGuests: number;
      started: number; sampleLoaded: number; toLogin: number; anchorMissing: number;
    } = { available: false, distinctGuests: 0, started: 0, sampleLoaded: 0, toLogin: 0, anchorMissing: 0 };
    try {
      const ge = await supabaseAdmin
        .from('tour_events')
        .select('event, anon_id, auth_state')
        .gte('created_at', since + 'T00:00:00+09:00');
      if (!ge.error && ge.data) {
        const guests = new Set<string>();
        let started = 0, sampleLoaded = 0, toLogin = 0, anchorMissing = 0;
        (ge.data as { event: string; anon_id: string; auth_state: string }[]).forEach(row => {
          if (row.auth_state === 'guest' && row.anon_id) guests.add(row.anon_id);
          // 게스트 투어 시작 — 배너(demo_started)·도움말메뉴(tour_started) 모두 집계
          if (row.event === 'demo_started' || row.event === 'tour_started') started++;
          else if (row.event === 'demo_sample_loaded') sampleLoaded++;
          else if (row.event === 'demo_to_login') toLogin++;
          else if (row.event === 'tour_anchor_missing') anchorMissing++;
        });
        guestFunnel = { available: true, distinctGuests: guests.size, started, sampleLoaded, toLogin, anchorMissing };
      }
    } catch { /* tour_events 테이블 미생성 — 대시보드 무중단 */ }

    // ── 도움말 진입 ────────────────────────────────────────────
    const helpOpened = actionCount['help_opened'] || 0;

    // ── AI 피드백 집계 (source별 👍/👎 비율) ────────────────────
    const feedbackBySource: Record<string, { positive: number; negative: number; total: number; satisfaction: number }> = {};
    (feedbackRes.data || []).forEach(row => {
      const source = (row as { source: string; rating: number }).source;
      const rating = (row as { source: string; rating: number }).rating;
      if (!feedbackBySource[source]) feedbackBySource[source] = { positive: 0, negative: 0, total: 0, satisfaction: 0 };
      if (rating === 1) feedbackBySource[source].positive++;
      else if (rating === -1) feedbackBySource[source].negative++;
      feedbackBySource[source].total++;
    });
    for (const src of Object.keys(feedbackBySource)) {
      const f = feedbackBySource[src];
      f.satisfaction = f.total > 0 ? Math.round((f.positive / f.total) * 100) : 0;
    }

    return NextResponse.json({
      dateList,
      signupByDate: dateList.map(d => ({ date: d, count: signupByDate[d] })),
      dauByDate: dateList.map(d => ({ date: d, count: dauByDate[d].size })),
      aiByDate: dateList.map(d => ({ date: d, count: aiByDate[d] })),
      actionCount,
      d7Retention,
      d1Retention,
      peakDau,
      todayDau,
      totalUsers,
      totalAiUsage,
      checks,
      readinessPct,
      // P0-6 신규 KPI
      onboardingFunnel,
      tourFunnel,
      featureAdoption,
      adoptionCohort,
      guestFunnel,
      helpOpened,
      feedbackBySource,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('Growth API error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
