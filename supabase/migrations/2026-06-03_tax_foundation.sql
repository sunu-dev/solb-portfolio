-- ============================================================================
-- 세무 피봇 데이터 골격 — transactions(lot) + fx_rates(일자별 공식환율)
-- ============================================================================
--
-- SSOT 설계: docs/TAX_PIVOT_MVP_SPEC.md (데이터 3계층) · 메모리 project_tax_pivot
--
-- 배경:
-- - 양도소득세는 lot별 '결제일 공식 매매기준율' 원화환산이 필요하다. 기존 평단(mergedAvgCost)은
--   회계 평단이지 세무 취득가가 아니다(환차익이 뭉개져 세액이 틀림 = 치명).
-- - 따라서 거래내역(transactions)과 일자별 공식환율(fx_rates)을 별도 SSOT로 둔다.
--   원화 환산은 코드의 toKrwAtSettle() 단일 게이트만 통과한다 — spot·1400 fallback 금지.
--
-- ⚠️ 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행 (자동 배포 마이그 아님 — 기존 패턴 동일).
-- ⚠️ 세무 calc 로직·UI는 세무사 감수(docs/LEGAL_CONSULTATION_TAX.md A섹션) 후 별도 구현.
--    이 마이그레이션은 데이터 골격만 — 계산하지 않는다.
-- ============================================================================

-- ── transactions : 개별 매매 lot (양도세 SSOT) ──────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  symbol       text NOT NULL,
  market       text NOT NULL DEFAULT 'US',        -- 'US' | 'KR' | 'JP' | 'HK' | 'other'
  broker       text,                              -- 기존 Broker enum 재사용 (선택)
  type         text NOT NULL CHECK (type IN ('buy','sell')),
  trade_date   date NOT NULL,                     -- 체결일
  settle_date  date,                              -- 결제일(T+2). ⚠️ 환율 환산 기준일 = 세무사 확정 전 needs-confirm
  shares       numeric NOT NULL CHECK (shares > 0),
  price_local  numeric NOT NULL CHECK (price_local >= 0),
  currency     text NOT NULL DEFAULT 'USD',       -- 'USD' | 'KRW' ...
  fee_local    numeric NOT NULL DEFAULT 0,        -- 필요경비(거래수수료 등). 범위는 needs-confirm
  fx_rate      numeric,                           -- 결제일 매매기준율 (fx_rates에서 채움, KRW per 1 단위 통화)
  source       text NOT NULL DEFAULT 'manual',    -- 'csv' | 'ocr' | 'manual' | 'broker_statement'
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_symbol ON transactions (user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_user_trade  ON transactions (user_id, trade_date);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 자기 거래만 (user_consents 패턴) — 민감·증거성 데이터라 self-only 엄격
DROP POLICY IF EXISTS transactions_select_own ON transactions;
CREATE POLICY transactions_select_own ON transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS transactions_insert_own ON transactions;
CREATE POLICY transactions_insert_own ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS transactions_update_own ON transactions;
CREATE POLICY transactions_update_own ON transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS transactions_delete_own ON transactions;
CREATE POLICY transactions_delete_own ON transactions FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE transactions IS
  '개별 매매 lot — 양도세 계산 SSOT. 평단(mergedHoldings) 아닌 lot별 결제일 환율로 원화환산. docs/TAX_PIVOT_MVP_SPEC.md';
COMMENT ON COLUMN transactions.settle_date IS
  '결제일(T+2) — 환율 환산 기준일. ⚠️ 체결일 vs 결제일은 세무사 확정 전 needs-confirm (legalVersions/LEGAL_CONSULTATION_TAX A7)';

-- ── fx_rates : 일자별 공식 매매기준율 (전역 참조 데이터) ──────────────────────
CREATE TABLE IF NOT EXISTS fx_rates (
  date    date NOT NULL,
  base    text NOT NULL,                          -- 'USD'
  quote   text NOT NULL DEFAULT 'KRW',
  rate    numeric NOT NULL,                       -- KRW per 1 base (예: USD 1 = 1380.50 KRW)
  source  text NOT NULL,                          -- 예 '서울외국환중개 매매기준율'
  PRIMARY KEY (date, base, quote)
);

ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;

-- 참조 데이터: 로그인 사용자 read 허용, 쓰기는 service-role만 (cron 적재). users insert/update 정책 없음.
DROP POLICY IF EXISTS fx_rates_select_auth ON fx_rates;
CREATE POLICY fx_rates_select_auth ON fx_rates FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE fx_rates IS
  '일자별 공식 매매기준율 (세무 환산 전용). 결측일은 toKrwAtSettle()가 직전 영업일 carry-forward. spot·1400 fallback 절대 금지. docs/TAX_PIVOT_MVP_SPEC.md';
