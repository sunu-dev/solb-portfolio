-- push_subscriptions에 created_at 컬럼 보장
-- 정책 SSOT: docs/NOTIFICATION_POLICY.md §3.1 (신규 유저 7일 ramp-up)
--
-- check-alerts cron이 가입 후 7일 미만 유저에게는 stoploss·portfolio-down만 푸시.
-- 이를 위해 구독 시점(created_at)이 필요.
--
-- 기존 행에는 NOW()가 채워지므로 legacy 구독자는 ramp-up이 즉시 종료된 상태로 처리됨.
--
-- 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행

alter table push_subscriptions
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_push_subs_created_at
  on push_subscriptions (created_at);
