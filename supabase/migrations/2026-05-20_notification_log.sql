-- Notification log — cron 멱등성 보장용
--
-- morning-brief / monthly-d3 등 시스템 알림이 Vercel cron retry 시
-- 같은 KST 일자에 같은 사용자에게 중복 발송되는 사고 차단.
--
-- UNIQUE(user_id, notification_type, sent_date)로 idempotency key.
-- 송신 직전 INSERT 시도 → 위반 = 이미 발송됨 → skip.
--
-- 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행 (베타 출시 D-6 BLOCKER)

create table if not exists notification_log (
  user_id uuid not null,
  notification_type text not null,  -- 'morning_brief' | 'monthly_d3' | (확장)
  sent_date date not null,           -- KST 일자
  sent_at timestamptz not null default now(),
  channel text,                       -- 'push' | 'email' | 'push+email'
  status text,                        -- 'sent' | 'failed' | 'skipped' | 'partial'
  error_message text,
  primary key (user_id, notification_type, sent_date)
);

create index if not exists idx_notification_log_user_date
  on notification_log (user_id, sent_date desc);

create index if not exists idx_notification_log_type_date
  on notification_log (notification_type, sent_date desc);

-- RLS: 서비스 키만 접근 (사용자 본인 SELECT는 추후 필요 시 추가)
alter table notification_log enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notification_log' and policyname = 'service-only'
  ) then
    drop policy "service-only" on notification_log;
  end if;
end $$;

create policy "service-only" on notification_log for all using (false);
