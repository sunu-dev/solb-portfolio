-- ============================================================================
-- API 관측 & Rate Limiting 테이블
-- ============================================================================
-- src/lib/rateLimiter.ts 에서 사용
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================================

create table if not exists public.api_calls (
  id          bigserial primary key,
  endpoint    text        not null,              -- '/api/ai-chok' 등
  user_key    text        not null,              -- user_id 또는 'ip:xxx'
  user_id     uuid        null,                  -- 로그인 유저만
  ip          text        null,
  status      smallint    not null,              -- HTTP status code
  latency_ms  integer     null,
  error_code  text        null,                  -- 'rate_limit' / 'parse_failed' 등
  created_at  timestamptz not null default now()
);

-- Rate limit 윈도우 집계용 복합 인덱스
create index if not exists idx_api_calls_user_endpoint_time
  on public.api_calls (user_key, endpoint, created_at desc);

-- 관리자 대시보드 집계용 인덱스
create index if not exists idx_api_calls_created
  on public.api_calls (created_at desc);

create index if not exists idx_api_calls_endpoint_created
  on public.api_calls (endpoint, created_at desc);

-- ============================================================================
-- RLS: 읽기/쓰기 모두 서비스 레벨에서만 (익명 읽기 차단)
-- ============================================================================
alter table public.api_calls enable row level security;

-- 서비스 롤은 기본적으로 RLS 우회. anon 키는 쓰기만 허용 (읽기 차단)
drop policy if exists "api_calls_insert_all" on public.api_calls;
create policy "api_calls_insert_all"
  on public.api_calls for insert
  with check (true);

-- anon이 읽어야 하는 경우 (rate limit 체크 시 count 조회) — 필요 시 활성화
drop policy if exists "api_calls_select_own" on public.api_calls;
create policy "api_calls_select_own"
  on public.api_calls for select
  using (true);  -- 전체 count만 조회하므로 민감한 데이터 아님

-- ============================================================================
-- Housekeeping: 30일 이상 오래된 로그 정리 (cron)
-- ============================================================================
-- Supabase pg_cron 활성화 후 아래 실행:
-- select cron.schedule('cleanup-api-calls', '0 3 * * *',
--   $$delete from public.api_calls where created_at < now() - interval '30 days'$$);