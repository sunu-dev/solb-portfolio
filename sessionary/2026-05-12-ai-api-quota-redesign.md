# 2026-05-12 — AI API 호출 카운팅 정책 전면 재설계

## 작업 요약

무료 Gemini 2계정 라운드로빈 운영 환경에서 "사용자가 의도치 않게 화면을 눌렀을 때 API 호출이 나가는" 위험을 근본 차단하고, 멤버십 전환 가능한 구조로 재설계.

**3명 가상 전문가 회의** (백엔드 / 프론트 / PM) → 크로스 토론 → 합의안 도출 → 즉시 구현.

### 결정된 정책 (SSOT)

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| 카운팅 단위 | ai-chok=세션, ai-analysis=일별 (이중 기준) | **일별 통합** (KST 자정 리셋) |
| 비로그인 호출 | ai-chok 1회/일, ai-analysis 3회/일 허용 | **완전 차단 (401)** |
| AI 촉 한도 | 로그인 3회/세션 | 로그인 free=1, pro=30 회/일 |
| AI 분석 한도 | 로그인 10회/일 | 로그인 free=3, pro=30 회/일 |
| 합산 vs 분리 | 합산 (ai-chok이 ai-analysis 카운트 포함) | **분리** (`mentor_id='ai-chok'` 필터로 격리) |
| 멤버십 게이트 | 없음 | `profiles.tier` 컬럼 (`free`/`pro`) |
| 글로벌 캡 | 250회/일 | 유지 (자릿수 안전망) |

### 구현된 변경 (7개 파일)

1. **`AnalysisPanel.tsx`** — AI 분석 버튼 + 멘토 카드에 `disabled` 추가 (연타 방지)
   - AI 분석 버튼: `disabled={aiLoading}` + 회색 배경
   - 멘토 카드: `disabled={mentorLoading}` + 비활성 멘토 opacity 0.5
   - 멘토 에러 표시 영역 신규 (`mentorError` state)
   - 에러 메시지에 "로그인" 포함 시 로그인 CTA 버튼 노출

2. **`supabase/migrations/2026-05-12_user_profiles_tier.sql`** (신규)
   - `profiles` 테이블 (id FK auth.users, tier enum, pro_since)
   - RLS: 자기 행만 SELECT
   - Trigger: 신규 가입 시 자동 free row 생성
   - Backfill: 기존 사용자에게도 free row 삽입

3. **`src/lib/userTier.ts`** (신규)
   - `getUserTier(userId)` → 'free' | 'pro'
   - `TIER_LIMITS` 상수 (env override 가능)
   - `getTierLimits(tier)` 헬퍼

4. **`src/app/api/ai-chok/route.ts`** — 전면 재작성
   - `SESSION_LIMIT` 제거 → tier 기반 `dailyLimit`
   - 비로그인 401 (early return)
   - `getDailyChokCount(userId)` — ai_usage 일별 카운트
   - `mentor_id='ai-chok'` 마킹 → 분석 카운트와 분리
   - 응답에 `dailyLimit`, `tier` 필드 추가

5. **`src/app/api/ai-analysis/route.ts`** — 전면 재작성
   - `AI_DAILY_LIMIT_USER/GUEST` env 제거 → tier 기반
   - 비로그인 401
   - `getAnalysisUsage` — `mentor_id != 'ai-chok'` 필터로 분리 카운트
   - 응답에 `dailyLimit`, `tier` 추가

6. **`AiChokSection.tsx`** — UX 미세 개선
   - 잔여 횟수 표시: `오늘 1회` → `오늘 1/1`
   - ChokState 타입에 `dailyLimit`, `tier` 추가

7. **`AnalysisPanel.tsx`** — UX 강화
   - AI 분석 에러 영역에 로그인 CTA (에러 텍스트에 "로그인" 포함 시)
   - 멘토 에러 영역 동일 처리

### 검증

- `npx tsc --noEmit` 통과
- `npm run build` 통과 (40 페이지 static 생성 정상)

## 결정사항

### 1. "한 사람당 3번"의 정의 — 사용자 결정

사용자가 명시: **하루 3번 + 로그인 필수**. 세션/누적 옵션 배제.

이유: 단순 학습, 매일 돌아오는 재사용자 확보, IP 우회 차단 + 사용자 추적 가능.

### 2. AI 촉 vs AI 분석 한도 — 사용자 결정

사용자가 명시: **분리 (촉 1회 + 분석 3회)**. 합산 배제.

이유: 촉은 묶음 결과(추천 6종목), 분석은 종목별 1:1. 합산하면 종목 2개 분석 후 한도 소진.

### 3. users.tier 필드 즉시 추가 — 사용자 결정

지금 마이그레이션 적용. 향후 멤버십 출시 시 `UPDATE profiles SET tier='pro'` 한 줄로 끝남.

YAGNI 위배처럼 보이지만, 코드에는 이미 tier 분기 로직이 들어가야 하므로 함께 작업하는 것이 효율적. 마이그레이션 1건 = 5분 작업.

### 4. 비로그인 차단 vs 1회 허용 — 사용자 결정

**완전 차단**. 비로그인 1회도 허용하지 않음.

Trade-off:
- 잃는 것: 회원가입 전 체험 불가 (SEO 유입 사용자 0회)
- 얻는 것: IP 공유망 우회 100% 차단, 사용자 행동 분석 가능, 분쟁 증거

완화책: 차단 메시지에 "카카오로 3초 만에 로그인하면 즉시 무료" CTA 명시 + 로그인 버튼 노출.

### 5. ai_usage 분리 카운팅 — 자체 결정

기존 코드는 `ai-chok` 호출도 `ai-analysis` 카운트에 포함됨. "촉 1 + 분석 3" 정책 실현 위해 `mentor_id='ai-chok'` 필터로 두 카운트 격리.

→ ai-chok: `WHERE mentor_id='ai-chok'` only
→ ai-analysis: `WHERE mentor_id IS NULL OR mentor_id != 'ai-chok'`
→ 글로벌 캡(250/일): 둘 다 합산 (자릿수 안전망 역할 유지)

### 6. cache_hit 마킹은 보류

회의에서 캐시 히트 분리 마킹 논의했으나, ai-chok의 `intent='fetch'` 분기는 애초에 `api_calls` 테이블에 기록되지 않음 (enforceRateLimit 호출 안 함). 별도 마킹 불필요.

## 미해결 TODO

- 마이그레이션 5건 → **6건**으로 갱신됨 (`2026-05-12_user_profiles_tier.sql` 추가)
- Vercel 환경변수 (선택):
  - `CHOK_DAILY_FREE=1`, `CHOK_DAILY_PRO=30`
  - `ANALYSIS_DAILY_FREE=3`, `ANALYSIS_DAILY_PRO=30`
  - 미설정 시 코드 기본값 그대로 동작 → 필수 아님

## 다음 세션 진입점

1. 🔴 **Supabase 마이그레이션 6건 적용** (사용자 액션) — 신규 추가된 `profiles` 테이블 미적용 시 `getUserTier()` 가 항상 'free' 반환 (정상 동작이지만 PRO 승급 불가)
2. 🔴 **배포 후 `/admin/api-stats` 모니터링** — 비로그인 차단 적용 후 호출 패턴 변화 확인:
   - 비로그인 user_key 차단 효과 (Top 10 호출자에서 `ip:` 프리픽스 거의 없어야 함)
   - 로그인 사용자 일일 한도 도달 빈도 (free 한도 1/3이 적절한지)
3. 🟡 **PRO 승급 UX** — 한도 도달 시 안내 메시지를 "내일 다시" → "PRO 가입하면 30회/일" 로 점진 변경 (멤버십 출시 시점)

## 메모리 승급 자문

이 세션에서 결정된 정책은 영속적 룰 — 메모리 승급 후보:

1. **AI 호출 카운팅 정책 SSOT** — 일별/로그인필수/tier분리 (`project_alert_system`과 같은 패턴으로 `project_ai_quota_policy.md` 신규)
2. **profiles.tier 테이블 도입** — `project_solb_status` 또는 `reference_external`에 추가

사용자 동의 시 승급 진행.
