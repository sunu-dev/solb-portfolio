-- AI 촉 캐시 테이블 — 기존에 콘솔로 만든 테이블이 git에 누락되어 idempotent 정의로 등록.
-- 신규 컬럼 excluded_recent: 새로고침 시 직전 추천 종목 누적 (다양성 강제용)
-- 신규 컬럼 created_at: 24h 이내 가장 최근 캐시 fallback 용
--
-- 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행

create table if not exists ai_chok_cache (
  user_key   text not null,
  date       text not null,           -- 'YYYY-MM-DD_session_vix' 합성 키
  picks      jsonb not null,
  use_count  int  not null default 0,
  excluded_recent text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_key, date)
);

-- 기존 테이블이 이미 있을 수 있으니 누락 컬럼만 추가
alter table ai_chok_cache
  add column if not exists excluded_recent text[] not null default '{}';

alter table ai_chok_cache
  add column if not exists created_at timestamptz not null default now();

alter table ai_chok_cache
  add column if not exists updated_at timestamptz not null default now();

-- 24h 이내 가장 최근 캐시 lookup 용 (사용자별 최신 1건)
create index if not exists idx_chok_cache_user_recent
  on ai_chok_cache (user_key, created_at desc);

-- RLS — 서비스 키만 접근
alter table ai_chok_cache enable row level security;

-- 정책 멱등 적용 — 이미 있으면 drop 후 recreate
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
