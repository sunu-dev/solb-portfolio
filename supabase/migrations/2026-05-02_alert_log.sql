-- 알림 송신 로그 테이블
-- 정책 SSOT: docs/NOTIFICATION_POLICY.md §4.4
--
-- 푸시 발송 시 1행 기록. 컴플라이언스 분쟁 시 어떤 알림이 언제 누구에게 갔는지 증거.
-- 보관 기간: 1년 (별도 cleanup cron이 365일 경과분 삭제)
--
-- 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행

create table if not exists alert_log (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  user_id uuid,
  symbol text,
  alert_type text not null,
  category text,             -- price | indicator | market | portfolio | celebrate | digest
  channel text not null,     -- 'push' | 'toast' | 'inapp' | 'email'
  message text,
  detail text,
  delivery_status text,      -- 'sent' | 'failed' | 'expired_subscription'
  error_message text
);

create index if not exists idx_alert_log_user_sent
  on alert_log (user_id, sent_at desc);

create index if not exists idx_alert_log_sent
  on alert_log (sent_at desc);

create index if not exists idx_alert_log_symbol
  on alert_log (symbol, sent_at desc);

-- RLS: 본인 로그만 read
alter table alert_log enable row level security;

create policy "users read own alert log" on alert_log
  for select using (auth.uid() = user_id);

-- 1년 경과 자동 삭제 (별도 cron이 호출하거나 pg_cron 설정)
-- 예시: select cron.schedule('alert_log_cleanup', '0 4 * * *',
--   $$ delete from alert_log where sent_at < now() - interval '1 year' $$);
