-- ─────────────────────────────────────────────────────────────────────────
-- PII Retention 정책 — L1 정합성 결함 대응
-- ─────────────────────────────────────────────────────────────────────────
--
-- 정책:
--   - ai_usage.ip   → 90일  후 NULL 익명화 (분석 가치 유지)
--   - api_calls.ip  → 30일  후 NULL 익명화 (관측성 위주)
--   - 두 테이블 모두 365일+ 행 hard DELETE
--
-- 실행 주체:
--   Vercel Cron → /api/cron/cleanup-pii (매주 일요일 4am KST)
--
-- 본 SQL은 cleanup cron 성능을 위한 인덱스 + 검증 쿼리 모음.
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 인덱스 (cleanup 성능 + 일반 조회 가속) ─────────────────────────────
-- created_at 단독으로 충분. ip not null 조건은 partial index로 가속 가능.
create index if not exists idx_ai_usage_created_at
  on public.ai_usage (created_at);

create index if not exists idx_ai_usage_created_ip_partial
  on public.ai_usage (created_at)
  where ip is not null;

create index if not exists idx_api_calls_created_at
  on public.api_calls (created_at);

create index if not exists idx_api_calls_created_ip_partial
  on public.api_calls (created_at)
  where ip is not null;

-- ─── 수동 검증 — 정책 예상 영향 종목 수 ─────────────────────────────────
-- 90일 이상 익명화 대상 (ai_usage)
select count(*) as ai_usage_to_anonymize
  from public.ai_usage
  where created_at < now() - interval '90 days'
    and ip is not null;

-- 30일 이상 익명화 대상 (api_calls)
select count(*) as api_calls_to_anonymize
  from public.api_calls
  where created_at < now() - interval '30 days'
    and ip is not null;

-- 365일+ hard DELETE 대상
select count(*) as ai_usage_to_delete
  from public.ai_usage
  where created_at < now() - interval '365 days';

select count(*) as api_calls_to_delete
  from public.api_calls
  where created_at < now() - interval '365 days';

-- ─── (선택) DB 직접 cleanup — pg_cron 사용 시 ─────────────────────────────
-- Vercel Cron 대신 Supabase pg_cron으로 수행하려면 다음 활성화:
--
-- create extension if not exists pg_cron;
--
-- select cron.schedule(
--   'cleanup-pii-weekly',
--   '0 19 * * 6',  -- 토요일 19:00 UTC (= 일요일 04:00 KST)
--   $$
--     update public.ai_usage  set ip = null where created_at < now() - interval '90 days'  and ip is not null;
--     update public.api_calls set ip = null where created_at < now() - interval '30 days'  and ip is not null;
--     delete from public.ai_usage  where created_at < now() - interval '365 days';
--     delete from public.api_calls where created_at < now() - interval '365 days';
--   $$
-- );
