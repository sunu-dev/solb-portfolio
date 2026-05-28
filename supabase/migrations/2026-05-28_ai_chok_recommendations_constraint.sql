-- ============================================================================
-- ai_chok_recommendations CHECK constraint — 단일종목 레버리지 ETN 차단 (DB-레벨)
-- ============================================================================
--
-- 배경:
-- - 2026-05-27 KRX 단일종목 레버리지 ETN 2종(520100·520101) 상장
-- - 코드 가드(leverageGuard.isBlockedLeverage)가 1차 방어 — ai-chok/route.ts:140 insert 직전 filter
-- - DB CHECK는 2차 방어 — 코드 회귀·새 진입점 추가 시에도 누수 0 보장
--
-- 제약 범위:
-- - 한국 ETN 종목코드 패턴 (5xxxxx.KS/KQ)만 차단 — 가장 위험·확실한 영역
-- - ETF 16종(KODEX/TIGER/ACE)의 정확한 종목코드는 미확정 → 코드 가드(종목명 키워드)로 처리
-- - 미국 단일종목 레버리지(TSLL 등)도 코드 가드로 처리
--
-- 위반 시: insert가 PostgreSQL error 23514로 거부됨 → ai-chok cron에서 Sentry 캡쳐
-- ============================================================================

ALTER TABLE ai_chok_recommendations
  DROP CONSTRAINT IF EXISTS ai_chok_recommendations_no_leveraged_etn;

ALTER TABLE ai_chok_recommendations
  ADD CONSTRAINT ai_chok_recommendations_no_leveraged_etn
    CHECK (symbol !~ '^5[0-9]{5}\.K[SQ]$');

COMMENT ON CONSTRAINT ai_chok_recommendations_no_leveraged_etn ON ai_chok_recommendations IS
  '한국 ETN 종목코드(5xxxxx.KS/KQ) 차단 — 단일종목 레버리지 ETN 백테스트 통계 왜곡 방지. SSOT: utils/leverageGuard.ts';