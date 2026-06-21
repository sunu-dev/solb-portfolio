-- ============================================================================
-- tour_events — 게스트(비로그인) 투어/활성화 텔레메트리
-- ============================================================================
-- 배경: logApiCall은 비로그인 시 early-return(apiLogger.ts) → 게스트 funnel이 구조적으로 100% 미관측.
--   목표 B(첫 방문자)를 검증하려면 게스트 이벤트를 받을 no-auth sink가 필요('검증=측정' 룰).
--
-- 보안: 정책 없이 RLS만 켠다 = anon/authenticated 직접 읽기·쓰기 전면 차단.
--   오직 service-role(서버 라우트 /api/tour-event)만 RLS를 우회해 insert. 클라가 직접 테이블에 못 쓴다.
--   서버 라우트가 이벤트 화이트리스트(tourEvents.ts)·payload cap·IP rate-limit(rateLimiter.ts)을 강제.
--
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================================

create table if not exists public.tour_events (
  id          bigserial   primary key,
  anon_id     text        not null,                 -- 클라 생성 무작위 UUID (핑거프린팅/PII 아님)
  user_id     uuid        null,                     -- 게스트=null (authed 이벤트는 api_logs로 감)
  event       text        not null,                 -- 화이트리스트 (tour_started 등)
  auth_state  text        not null default 'guest', -- 'guest' | 'user'
  meta        jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- 게스트 funnel 집계용 (anon_id별 세션 재구성)
create index if not exists idx_tour_events_anon_time
  on public.tour_events (anon_id, created_at desc);

-- 이벤트별 집계 (admin growth)
create index if not exists idx_tour_events_event_time
  on public.tour_events (event, created_at desc);

-- TTL 정리용
create index if not exists idx_tour_events_created
  on public.tour_events (created_at desc);

-- ============================================================================
-- RLS: 정책 없음 = service-role 전용. anon/authenticated 직접 접근 차단.
-- ============================================================================
alter table public.tour_events enable row level security;

-- ============================================================================
-- Housekeeping: 30일 TTL (docs/sql_pii_retention.sql 패턴). cron 또는 수동 실행.
--   delete from public.tour_events where created_at < now() - interval '30 days';
-- ============================================================================
