-- =============================================
-- SOLB 초대/리퍼럴/할인 코드 + 앱 설정 시스템
-- Supabase SQL Editor에서 실행
-- =============================================

-- 1. 앱 전역 설정 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS app_config (
  key         text PRIMARY KEY,
  value       text NOT NULL DEFAULT '',
  description text,
  updated_by  uuid REFERENCES auth.users(id),
  updated_at  timestamptz DEFAULT now()
);

-- 초기 설정값
INSERT INTO app_config (key, value, description) VALUES
  ('service_mode',    'beta',  '서비스 모드: beta | waitlist | open | maintenance'),
  ('invite_required', 'true',  '초대코드 필수 여부: true | false'),
  ('beta_max_users',  '50',    '베타 최대 인원 (0=무제한) — 도달 시 waitlist 자동 전환'),
  ('beta_end_date',   '',      '베타 자동 종료 날짜 YYYY-MM-DD (비워두면 수동 전환)'),
  ('ai_daily_limit',  '5',     '일반 유저 AI 분석 일일 한도'),
  ('ai_beta_limit',   '10',    '베타 유저 AI 분석 일일 한도'),
  ('ai_admin_limit',  '0',     '관리자 AI 한도 (0=무제한)')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
-- 누구나 읽기 가능 (프론트에서 서비스 모드 확인)
CREATE POLICY "app_config_read" ON app_config FOR SELECT USING (true);
-- 쓰기는 서버사이드(service_role)만 — 관리자 API에서 service_role 사용


-- 2. 통합 코드 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,
  type         text NOT NULL CHECK (type IN ('invite', 'referral', 'discount', 'promo')),

  -- 발급자 (null = 관리자 직접 생성)
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now(),
  expires_at   timestamptz,                   -- null = 무기한

  -- 사용 제한
  max_uses     int DEFAULT 1,                 -- null = 무제한
  use_count    int DEFAULT 0,
  is_active    boolean DEFAULT true,

  -- 보상 설정 (타입별 JSON)
  -- invite:   {}
  -- referral: {"referrer":{"type":"ai_credits","amount":5},"referee":{"type":"ai_credits","amount":3}}
  -- discount: {"type":"percent","amount":20} or {"type":"fixed","amount":5000}
  -- promo:    {"type":"free_days","amount":30}
  rewards      jsonb DEFAULT '{}',

  description  text,
  metadata     jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_codes_code ON codes(code);
CREATE INDEX IF NOT EXISTS idx_codes_type ON codes(type);
CREATE INDEX IF NOT EXISTS idx_codes_created_by ON codes(created_by);
CREATE INDEX IF NOT EXISTS idx_codes_is_active ON codes(is_active);

ALTER TABLE codes ENABLE ROW LEVEL SECURITY;
-- 코드 검증: 누구나 조회 가능 (validate API에서 사용)
CREATE POLICY "codes_select" ON codes FOR SELECT USING (true);
-- 삽입: 관리자 API(service_role)만
-- 업데이트: 관리자 API(service_role)만


-- 3. 코드 사용 이력
-- =============================================
CREATE TABLE IF NOT EXISTS code_uses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id        uuid REFERENCES codes(id) ON DELETE CASCADE,
  code           text NOT NULL,               -- 빠른 조회용 비정규화
  used_by        uuid REFERENCES auth.users(id),
  used_at        timestamptz DEFAULT now(),
  context        text DEFAULT 'signup',       -- signup | subscription | renewal
  reward_granted boolean DEFAULT false,
  reward_data    jsonb DEFAULT '{}'           -- 실제 지급된 보상 스냅샷
);

CREATE INDEX IF NOT EXISTS idx_code_uses_code_id ON code_uses(code_id);
CREATE INDEX IF NOT EXISTS idx_code_uses_used_by ON code_uses(used_by);

ALTER TABLE code_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "code_uses_select" ON code_uses FOR SELECT USING (auth.uid() = used_by);
CREATE POLICY "code_uses_insert" ON code_uses FOR INSERT WITH CHECK (auth.uid() = used_by);


-- 4. 사용자 AI 크레딧 (리퍼럴 보상 적립)
-- =============================================
CREATE TABLE IF NOT EXISTS user_credits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id),
  amount       int NOT NULL,                  -- 지급된 AI 분석 횟수
  used_amount  int DEFAULT 0,                 -- 사용된 횟수
  source       text,                          -- referral | invite_bonus | admin | purchase | welcome
  source_ref   uuid REFERENCES codes(id),     -- 어떤 코드로 받았는지
  expires_at   timestamptz,                   -- null = 영구
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_credits_select" ON user_credits FOR SELECT USING (auth.uid() = user_id);
-- 삽입/업데이트: 관리자 API(service_role)만


-- 5. 유저 프로필에 초대 코드 컬럼 추가
-- =============================================
-- user_portfolios 테이블에 invite 관련 컬럼 추가
ALTER TABLE user_portfolios
  ADD COLUMN IF NOT EXISTS invited_by_code text,           -- 가입 시 입력한 코드
  ADD COLUMN IF NOT EXISTS referral_code   text UNIQUE,    -- 본인의 리퍼럴 코드
  ADD COLUMN IF NOT EXISTS user_tier       text DEFAULT 'beta';  -- beta | general | premium


-- 6. 관리자 코드 변경 이력 (감사 로그)
-- =============================================
CREATE TABLE IF NOT EXISTS config_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by  uuid REFERENCES auth.users(id),
  key         text NOT NULL,
  old_value   text,
  new_value   text,
  changed_at  timestamptz DEFAULT now()
);

ALTER TABLE config_audit_log ENABLE ROW LEVEL SECURITY;
-- 관리자 API(service_role)만 접근


-- 7. 초기 관리자 초대 코드 10개 생성 (예시)
-- =============================================
-- 관리자 페이지에서 생성하므로 여기선 스킵
-- INSERT INTO codes (code, type, max_uses, description) VALUES
--   ('SOLB-BETA01', 'invite', 1, '베타 초대 코드 1'),
--   ...

-- 완료
SELECT 'Setup complete ✅' as status;
