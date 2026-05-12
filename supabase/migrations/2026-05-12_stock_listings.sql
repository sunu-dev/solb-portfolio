-- 신규 상장 종목 감지·검수 테이블
-- 매일 cron이 Finnhub에서 전체 상장 목록을 받아 diff를 채움.
-- 운영자가 admin 페이지에서 검수 후 universe 편입 결정.
--
-- 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행

create table if not exists stock_listings (
  symbol         text primary key,
  exchange       text not null,                                     -- 'US' | 'KS' | 'KQ'
  description    text,                                              -- Finnhub 영문 description
  kr_name        text,                                              -- 한국어 표기 (Gemini 자동 또는 운영자 수동)
  listed_at      date,                                              -- 상장일 (Finnhub /stock/profile2)
  market_cap     bigint,                                            -- 시총 USD (Finnhub /stock/profile2)
  status         text not null default 'watch'
                 check (status in ('watch', 'eligible', 'universe', 'rejected', 'delisted')),
  first_seen     timestamptz not null default now(),                -- 시스템이 처음 감지한 시점
  last_seen      timestamptz not null default now(),                -- 가장 최근 cron에서 확인된 시점 (상폐 감지용)
  reviewed_at    timestamptz,
  reviewed_by    uuid references auth.users(id) on delete set null,
  notes          text                                               -- 운영자 메모
);

create index if not exists idx_listings_status     on stock_listings (status);
create index if not exists idx_listings_first_seen on stock_listings (first_seen desc);
create index if not exists idx_listings_listed_at  on stock_listings (listed_at desc);
create index if not exists idx_listings_exchange   on stock_listings (exchange);

-- RLS: SELECT는 admin 이메일만, UPDATE는 service role (cron / admin API)
alter table stock_listings enable row level security;

-- service role은 RLS 무시 (cron/admin API 동작)
-- 일반 사용자 차단 (검수 정보 노출 방지)
drop policy if exists "listings_admin_select" on stock_listings;
create policy "listings_admin_select" on stock_listings
  for select using (false);  -- service role만 SELECT 가능

-- updated_at 자동 갱신 트리거
create or replace function public.touch_stock_listings_last_seen()
returns trigger
language plpgsql
as $$
begin
  new.last_seen := now();
  return new;
end;
$$;

drop trigger if exists trg_listings_last_seen on stock_listings;
create trigger trg_listings_last_seen
  before update on stock_listings
  for each row execute function public.touch_stock_listings_last_seen();
