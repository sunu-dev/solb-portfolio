-- ============================================================================
-- 미적용 마이그레이션 통합 (2026-05-13)
-- ============================================================================
--
-- 적용 방법: Supabase 콘솔 → SQL Editor → 이 파일 전체 붙여넣고 한 번에 RUN
--
-- 모든 statement는 idempotent (CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- → 이미 일부 적용됐어도 안전. 다시 실행해도 데이터 손실 없음.
--
-- 포함된 마이그레이션 7건:
--   1. 2026-04-28_ai_chok_recommendations.sql — AI 촉 백테스트 로깅
--   2. 2026-05-02_alert_log.sql                — 알림 송신 로그
--   3. 2026-05-02_push_subscriptions_created_at.sql — 7일 ramp-up 컬럼
--   4. 2026-05-02_email_subscriptions.sql      — 모닝브리프 이메일 옵트인
--   5. 2026-05-02_email_subscriptions_monthly_d3.sql — D-3 옵트인 추가
--   6. 2026-05-10_ai_chok_cache.sql            — AI 촉 캐시 + 다양성 컬럼
--   7. 2026-05-13_ai_feedback.sql              — 사용자 피드백 1탭
--
-- 이미 적용 완료 (포함 안 됨):
--   - 2026-05-12_user_profiles_tier.sql
--   - 2026-05-12_stock_listings.sql
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────
-- [1/7] AI 촉 추천 백테스트 로깅 (2026-04-28)
-- ─────────────────────────────────────────────────────────────────

create table if not exists ai_chok_recommendations (
  id uuid primary key default gen_random_uuid(),
  recommended_at timestamptz not null default now(),
  user_id uuid,
  ip text,
  investor_type text,
  symbol text not null,
  sector text,
  reason text,
  key_metric text,
  vix_bucket text,
  current_price numeric,
  pe_ratio numeric,
  week52_position numeric,
  price_after_30d numeric,
  return_30d numeric,
  price_after_90d numeric,
  return_90d numeric,
  filled_30d_at timestamptz,
  filled_90d_at timestamptz
);

create index if not exists idx_chok_rec_user
  on ai_chok_recommendations (user_id, recommended_at desc);
create index if not exists idx_chok_rec_pending_30
  on ai_chok_recommendations (recommended_at)
  where filled_30d_at is null;
create index if not exists idx_chok_rec_pending_90
  on ai_chok_recommendations (recommended_at)
  where filled_90d_at is null;

alter table ai_chok_recommendations enable row level security;

drop policy if exists "users read own recs" on ai_chok_recommendations;
create policy "users read own recs" on ai_chok_recommendations
  for select using (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────
-- [2/7] 알림 송신 로그 (2026-05-02)
-- ─────────────────────────────────────────────────────────────────

create table if not exists alert_log (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  user_id uuid,
  symbol text,
  alert_type text not null,
  category text,
  channel text not null,
  message text,
  detail text,
  delivery_status text,
  error_message text
);

create index if not exists idx_alert_log_user_sent
  on alert_log (user_id, sent_at desc);
create index if not exists idx_alert_log_sent
  on alert_log (sent_at desc);
create index if not exists idx_alert_log_symbol
  on alert_log (symbol, sent_at desc);

alter table alert_log enable row level security;

drop policy if exists "users read own alert log" on alert_log;
create policy "users read own alert log" on alert_log
  for select using (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────
-- [3/7] push_subscriptions.created_at 컬럼 추가 (2026-05-02)
-- 7일 ramp-up 위해 필요
-- ─────────────────────────────────────────────────────────────────

alter table push_subscriptions
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_push_subs_created_at
  on push_subscriptions (created_at);


-- ─────────────────────────────────────────────────────────────────
-- [4/7] 이메일 구독 (모닝브리프) (2026-05-02)
-- ─────────────────────────────────────────────────────────────────

create table if not exists email_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  morning_brief_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_subs_morning
  on email_subscriptions (morning_brief_enabled)
  where morning_brief_enabled = true;

alter table email_subscriptions enable row level security;

drop policy if exists "users select own email subs" on email_subscriptions;
create policy "users select own email subs" on email_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "users insert own email subs" on email_subscriptions;
create policy "users insert own email subs" on email_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own email subs" on email_subscriptions;
create policy "users update own email subs" on email_subscriptions
  for update using (auth.uid() = user_id);

drop policy if exists "users delete own email subs" on email_subscriptions;
create policy "users delete own email subs" on email_subscriptions
  for delete using (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────
-- [5/7] email_subscriptions.monthly_d3_enabled 추가 (2026-05-02)
-- ─────────────────────────────────────────────────────────────────

alter table email_subscriptions
  add column if not exists monthly_d3_enabled boolean not null default false;

create index if not exists idx_email_subs_d3
  on email_subscriptions (monthly_d3_enabled)
  where monthly_d3_enabled = true;


-- ─────────────────────────────────────────────────────────────────
-- [6/7] AI 촉 캐시 + 다양성 강제 컬럼 (2026-05-10)
-- ─────────────────────────────────────────────────────────────────

create table if not exists ai_chok_cache (
  user_key   text not null,
  date       text not null,
  picks      jsonb not null,
  use_count  int  not null default 0,
  excluded_recent text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_key, date)
);

alter table ai_chok_cache
  add column if not exists excluded_recent text[] not null default '{}';
alter table ai_chok_cache
  add column if not exists created_at timestamptz not null default now();
alter table ai_chok_cache
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_chok_cache_user_recent
  on ai_chok_cache (user_key, created_at desc);

alter table ai_chok_cache enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_chok_cache' and policyname = 'service-only'
  ) then
    drop policy "service-only" on ai_chok_cache;
  end if;
end $$;

create policy "service-only" on ai_chok_cache
  for all using (false);


-- ─────────────────────────────────────────────────────────────────
-- [7/7] AI 추천 품질 사용자 피드백 (2026-05-13)
-- ─────────────────────────────────────────────────────────────────

create table if not exists ai_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  source      text not null,
  symbol      text,
  rating      smallint not null check (rating in (1, -1)),
  context     jsonb,
  comment     text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ai_feedback_source on ai_feedback (source, created_at desc);
create index if not exists idx_ai_feedback_user   on ai_feedback (user_id, created_at desc);
create index if not exists idx_ai_feedback_symbol on ai_feedback (symbol);

alter table ai_feedback enable row level security;

drop policy if exists "ai_feedback_self_select" on ai_feedback;
create policy "ai_feedback_self_select" on ai_feedback
  for select using (auth.uid() = user_id);

drop policy if exists "ai_feedback_self_insert" on ai_feedback;
create policy "ai_feedback_self_insert" on ai_feedback
  for insert with check (auth.uid() = user_id);


-- ============================================================================
-- 적용 완료 확인 쿼리
-- ============================================================================
--
-- 적용 직후 아래 쿼리로 모든 테이블·컬럼이 생성됐는지 확인:
--
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in (
--       'ai_chok_recommendations', 'alert_log', 'email_subscriptions',
--       'ai_chok_cache', 'ai_feedback', 'push_subscriptions'
--     );
--
-- 6개 row가 나오면 성공.
-- ============================================================================
