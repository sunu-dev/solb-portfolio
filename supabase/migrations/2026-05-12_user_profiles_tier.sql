-- 사용자 멤버십 티어 (free/pro) 관리 테이블
-- AI 호출 한도 분기에 사용. 기본값 'free'.
-- 향후 결제/구독 연동 시 PRO 승급은 update profiles set tier='pro' where id=...
--
-- 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tier        text not null default 'free' check (tier in ('free', 'pro')),
  pro_since   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- tier 인덱스 (pro 전체 조회 등)
create index if not exists idx_profiles_tier on profiles (tier);

-- RLS: 자기 행만 SELECT 가능. UPDATE는 service role만 (사용자가 임의로 pro 승급 불가)
alter table profiles enable row level security;

drop policy if exists "profiles_self_select" on profiles;
create policy "profiles_self_select" on profiles
  for select using (auth.uid() = id);

-- 신규 가입 시 자동으로 free row 생성 (트리거)
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, tier)
  values (new.id, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- 기존 사용자 백필 (이미 가입한 사용자에게도 free row 생성)
insert into profiles (id, tier)
select id, 'free' from auth.users
on conflict (id) do nothing;
