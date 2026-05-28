-- ============================================================================
-- stock_listings.asset_class 컬럼 추가 — Universe 4번째 룰 + 단일종목 레버리지 자동 식별
-- ============================================================================
--
-- 배경:
-- - 2026-05-27 KRX 단일종목 레버리지 18종(4.3조원) 상장
-- - 기존 universe 3중 AND(시총 $5B+ · 상장 12개월+ · 데이터 정상)으로는 음의 복리 못 막음
-- - asset_class 4번째 룰로 자본시장법 §6 회피 + 페르소나 부적합 상품 자동 배제
--
-- 정책 SSOT:
-- - memory: project_leverage_single_stock_policy.md
-- - code: src/utils/leverageGuard.ts (classifyAssetClass + isUniverseEligibleClass)
-- - docs/THRESHOLDS.md #46
-- ============================================================================

ALTER TABLE stock_listings
  ADD COLUMN IF NOT EXISTS asset_class TEXT
    CHECK (asset_class IN (
      'normal',            -- 일반 주식 (AAPL, 005930.KS)
      'etf_index',         -- 지수 ETF (SPY, QQQ, VOO)
      'etf_sector',        -- 섹터 ETF (XLK, XLE)
      'etf_dividend',      -- 배당 ETF (SCHD, VYM)
      'leveraged_index',   -- 지수 레버리지 ETF (TQQQ, SOXL)
      'inverse_index',     -- 지수 인버스 ETF (SQQQ, SOXS)
      'leveraged_single',  -- 단일종목 레버리지 ETF/ETN (520100.KS, TSLL)
      'inverse_single',    -- 단일종목 인버스 ETF/ETN (NVDD)
      'etn',               -- 일반 ETN (단일종목 외)
      'reit',              -- 부동산
      'other'              -- 기타 (PR/ADR/SPAC 등)
    ))
    DEFAULT 'normal';

-- 인덱스 (universe 쿼리 가속 — asset_class 필터링 자주 발생)
CREATE INDEX IF NOT EXISTS stock_listings_asset_class_idx
  ON stock_listings (asset_class);

-- ============================================================================
-- 기존 단일종목 레버리지 ETN 2종 즉시 태깅 (2026-05-27 KRX 상장)
-- ============================================================================
UPDATE stock_listings
  SET asset_class = 'leveraged_single',
      status = 'rejected'
  WHERE symbol IN ('520100.KS', '520101.KS')
    AND (asset_class IS NULL OR asset_class = 'normal');

-- ============================================================================
-- 향후 universe 자동 승급 시 사용할 4번째 룰
-- (enrich-listings cron 코드에서 isUniverseEligibleClass()로 적용)
--
-- 허용 클래스: normal, etf_index, etf_sector, etf_dividend, reit
-- 배제 클래스: leveraged_*, inverse_*, etn, other (모든 파생결합·고위험)
-- ============================================================================