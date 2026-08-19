-- PRO 수요 검증 이벤트. 운영 적용 전 파운더 승인 필요.
-- 종목·수량·평단·자산금액·원본 포트폴리오는 저장하지 않는다.

create table if not exists public.pro_demand_events (
  id          bigserial primary key,
  event_id    uuid not null unique,
  user_id     uuid not null references auth.users(id) on delete cascade,
  event       text not null check (event in (
    'pro_offer_exposed',
    'pro_offer_opened',
    'pro_offer_dismissed',
    'pro_start_clicked',
    'pro_waitlist_submitted',
    'pro_checkout_started',
    'pro_payment_succeeded',
    'pro_core_value_used',
    'pro_renewed_month_2',
    'pro_cancelled'
  )),
  placement   text not null check (placement in ('backup', 'bulk_import', 'history')),
  cohort      text not null check (char_length(cohort) between 1 and 32),
  price_krw   integer not null check (price_krw between 1000 and 100000),
  created_at  timestamptz not null default now()
);

create index if not exists idx_pro_demand_events_cohort_event_time
  on public.pro_demand_events (cohort, event, created_at desc);

create index if not exists idx_pro_demand_events_user_time
  on public.pro_demand_events (user_id, created_at desc);

alter table public.pro_demand_events enable row level security;

-- 정책 없음: 브라우저 직접 접근 차단, service-role Route Handler만 읽기·쓰기.
-- 실험 종료 후 익명 집계하고 원시 이벤트는 180일 안에 삭제한다.
