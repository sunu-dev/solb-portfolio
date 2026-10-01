-- 운영에는 테이블이 먼저 존재했으므로 CREATE TABLE IF NOT EXISTS 안의
-- daily_snapshots 정의가 적용되지 않았다. CAS 함수를 우회하지 않고 스키마를 복구한다.
-- 기존 stocks, updated_at, history, 로컬 outbox를 변경하지 않는다.
alter table public.user_portfolios
  add column if not exists daily_snapshots jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
