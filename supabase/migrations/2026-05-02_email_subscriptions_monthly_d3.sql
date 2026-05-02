-- email_subscriptions에 monthly_d3_enabled 컬럼 추가
-- 정책 SSOT: docs/NOTIFICATION_POLICY.md §7
--
-- 모닝브리프와 동일 패턴으로 월말 D-3 리마인더도 이메일 백업 채널 제공.
-- 두 토글은 독립 (사용자가 일별 알림은 받고 월간만 끄거나, 그 반대 가능).
--
-- 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행

alter table email_subscriptions
  add column if not exists monthly_d3_enabled boolean not null default false;

create index if not exists idx_email_subs_d3
  on email_subscriptions (monthly_d3_enabled)
  where monthly_d3_enabled = true;
