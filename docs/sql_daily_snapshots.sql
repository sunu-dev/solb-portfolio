-- ─────────────────────────────────────────────────────────────────────────
-- user_portfolios에 daily_snapshots JSONB 컬럼 추가
-- ─────────────────────────────────────────────────────────────────────────
--
-- 목적: 모닝 브리핑 cron이 "어제 vs 오늘" 비교를 정확히 수행하도록
--      localStorage 전용이던 dailySnapshots를 DB로 sync.
--
-- 영향:
--   - usePortfolioSync가 stocks와 함께 daily_snapshots도 저장
--   - cron에서 어제 스냅샷 → 자산 변화량 계산 가능
--
-- 안전성: 신규 컬럼 default '[]', 기존 행은 자동 빈 배열로 채워짐.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.user_portfolios
  add column if not exists daily_snapshots jsonb not null default '[]'::jsonb;

-- 인덱스 — JSONB 길이 조회는 거의 없으므로 default no index.
-- 필요 시 함수형 인덱스 추가 가능.

-- 검증
select user_id,
       jsonb_array_length(daily_snapshots) as snapshot_count
from public.user_portfolios
order by snapshot_count desc nulls last
limit 10;
