-- enrich-listings cron HOL(head-of-line) 블로킹 차단 — 재시도 커서
--
-- 문제: enrich-listings는 `market_cap IS NULL` 행을 first_seen ASC로 골라 Finnhub에서 채운다.
--       Finnhub이 영영 marketCapitalization을 안 주는 종목(한국·일부 신규 ETP 등)은 market_cap이
--       계속 NULL → 매 cron 재선택 → 배치가 stuck 종목으로 가득 차 새 종목이 못 들어가는 HOL.
--
-- 해결: last_enrich_at(마지막 시도 시각) + enrich_attempts(누적 시도 횟수) 컬럼 추가.
--       cron이 last_enrich_at NULLS FIRST로 정렬(미시도 우선·오래된 시도 다음)하고,
--       enrich_attempts >= 상한이면 큐에서 제외 → stuck 종목이 큐를 영구 점유하지 못함.
--
-- ⚠️ 배포 순서: 이 마이그레이션을 **enrich-listings 코드 배포 전에** Supabase 콘솔에서 먼저 적용.
--    (코드가 없는 컬럼을 참조하면 cron이 500 → 신규 상장 enrich 중단)
--
-- 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행

alter table stock_listings add column if not exists last_enrich_at  timestamptz;
alter table stock_listings add column if not exists enrich_attempts integer not null default 0;

-- cron 선택 정렬용 — last_enrich_at NULLS FIRST 부분 인덱스 (market_cap 미수집분만)
create index if not exists idx_listings_enrich_cursor
  on stock_listings (last_enrich_at asc nulls first)
  where market_cap is null;
