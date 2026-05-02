-- 이메일 알림 구독 테이블
-- 정책 SSOT: docs/NOTIFICATION_POLICY.md §7 (모닝브리프 이메일 백업 채널)
--
-- 푸시 미구독(특히 iOS Safari PWA 미설치) 유저에게 모닝브리프를 이메일로 보내기 위한
-- 명시 동의 저장. push_subscriptions와 분리 — 두 채널은 독립 옵트인.
--
-- 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행

create table if not exists email_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  morning_brief_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_subs_morning
  on email_subscriptions (morning_brief_enabled)
  where morning_brief_enabled = true;

-- RLS: 본인 행만 read/write
alter table email_subscriptions enable row level security;

create policy "users select own email subs" on email_subscriptions
  for select using (auth.uid() = user_id);

create policy "users insert own email subs" on email_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "users update own email subs" on email_subscriptions
  for update using (auth.uid() = user_id);

create policy "users delete own email subs" on email_subscriptions
  for delete using (auth.uid() = user_id);
