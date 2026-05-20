-- 인앱 버그/피드백 신고 채널 SSOT
--
-- 베타 출시 후 사용자가 사장 카톡으로 1:1 인입되는 운영 SLA 붕괴를 차단.
-- 인앱 폼 → /api/feedback/report → bug_reports + Slack #beta-bug webhook.
--
-- 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행 (베타 출시 D-6)

create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,                       -- null = 비로그인 사용자
  user_email text,                    -- 익명 신고 시 응답 받을 곳
  category text default 'bug',        -- 'bug' | 'feedback' | 'praise' | 'payment'
  page text,                          -- 신고 발생 페이지 (e.g. '/news', '/portfolio')
  message text not null,
  user_agent text,
  viewport text,                      -- e.g. '375x812' (디바이스 추적)
  app_version text,
  status text default 'open',         -- 'open' | 'triaged' | 'in_progress' | 'resolved' | 'wontfix'
  resolved_at timestamptz,
  internal_note text                  -- 운영자 메모
);

create index if not exists idx_bug_reports_status_created
  on bug_reports (status, created_at desc);

create index if not exists idx_bug_reports_user
  on bug_reports (user_id, created_at desc)
  where user_id is not null;

-- RLS: 신고는 누구나 INSERT 가능 (스팸 방지는 rate limiter 미들웨어에서)
alter table bug_reports enable row level security;

do $$
begin
  -- 모든 사용자 INSERT 허용
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bug_reports' and policyname = 'anyone-insert'
  ) then
    create policy "anyone-insert" on bug_reports for insert with check (true);
  end if;
  -- 사용자 본인 SELECT
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bug_reports' and policyname = 'user-read-own'
  ) then
    create policy "user-read-own" on bug_reports for select using (auth.uid() = user_id);
  end if;
end $$;
