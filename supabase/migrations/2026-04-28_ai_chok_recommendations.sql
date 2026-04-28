-- AI 촉 추천 백테스트 로깅 테이블
-- 추천 시점에 1행 기록, 30/90일 후 cron이 가격 fill-in (별도 작업)
--
-- 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행

create table if not exists ai_chok_recommendations (
  id uuid primary key default gen_random_uuid(),
  recommended_at timestamptz not null default now(),
  user_id uuid,
  ip text,
  investor_type text,
  symbol text not null,
  sector text,                  -- 한국어 라벨 (정규화됨)
  reason text,
  key_metric text,
  vix_bucket text,              -- 'panic'|'fear'|'unease'|'normal'|'calm'|'unknown'
  current_price numeric,        -- 추천 시점 가격
  pe_ratio numeric,             -- 추천 시점 PER
  week52_position numeric,      -- 추천 시점 52주 위치 0~100
  -- 30/90일 follow-up (cron이 채움)
  price_after_30d numeric,
  return_30d numeric,
  price_after_90d numeric,
  return_90d numeric,
  filled_30d_at timestamptz,
  filled_90d_at timestamptz
);

create index if not exists idx_chok_rec_user
  on ai_chok_recommendations (user_id, recommended_at desc);

create index if not exists idx_chok_rec_pending_30
  on ai_chok_recommendations (recommended_at)
  where filled_30d_at is null;

create index if not exists idx_chok_rec_pending_90
  on ai_chok_recommendations (recommended_at)
  where filled_90d_at is null;

-- RLS: 서비스 키만 접근 (사용자는 자기 추천 read만)
alter table ai_chok_recommendations enable row level security;

create policy "users read own recs" on ai_chok_recommendations
  for select using (auth.uid() = user_id);