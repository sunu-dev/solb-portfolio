# 2026-05-15 — 베타 출시 D-7 준비 (9인 패널 + 12 BLOCKER)

> 같은 날 `2026-05-15-design-rebrand-v1.1.md`와 함께 진행된 큰 세션. 토픽 분리.

## 작업 요약

사용자 "베타 출시 (무료) 출시 전 할 일?" 질문 → 4단계 처리 합의 (사용자 결정: **2-3-4-1** 순서, 디자인 리브랜딩 마지막).

진행 흐름:
1. sync-listings Supabase 1000 limit 버그 발견·픽스 (앞부분)
2. 법무 문서 3건 갱신 (UNIVERSE·약관·개인정보 v2)
3. 9인 패널 회의 (PM·UX·법무·그로스·페르소나×2·아키텍트·QA·VC)
4. D-6 인프라 → D-5 법무 → D-4 디자인 V1 → D-3 UX → D-1 QA 순차 처리
5. 12 BLOCKER 중 코드 완료 11건, 사용자 액션 5건

총 8 커밋. 디자인 리브랜딩은 별도 세셔너리(2026-05-15-design-rebrand-v1.1.md).

### A. sync-listings Supabase 1000 limit 버그 (커밋 c64da1e)

**증상**: 매일 09:15 Slack에 "신규 상장 23,413건" 알림. 같은 종목(NVDA·LKQ 등) 반복.

**진단**:
- Day 1: DB 0건 → 24,400 신규 (정상)
- Day 2~: existing SELECT가 **Supabase JS 기본 limit 1,000건만** 가져옴
- 24,413 incoming - 1,000 existing = **23,413 신규 오탐** (제보 수치 정확히 일치)
- INSERT는 PK 충돌로 차단됐지만 Slack 알림은 매번 발사

**수정**: `range(from, from+999)` 페이지네이션 루프. 25 페이지 ≈ 2초 추가.

**교훈 (메모리 후보)**: Supabase JS `.select()` 기본 limit 1000. 명시적 `.range()` 또는 `.limit()` 없으면 대량 데이터 시 silent fail.

### B. 법무 문서 3건 갱신 (커밋 624b1a9)

`docs/UNIVERSE_INCLUSION_CRITERIA.md` 신규:
- 자본시장법 회피용 외부 공개
- 3중 AND 기준 ($5B+ / 12개월+ / 데이터 정상)
- 상태 머신 + 검수 절차 + KRX 우회 정책
- "추천이 아닌 객관 기준 큐레이션" 명시

`/terms` v1 → v2:
- 베타 단계 명시 (헤더 + 신설 제15조)
- 제5조 기능 목록 갱신 (AI 촉·멘토 6명·OCR·증권사 통합·챕터·신규 상장·1탭 피드백)
- 제6조 AI 한도 정책 갱신 (AI 촉 영구 무료·AI 분석 로그인 필수·비로그인 사용 불가)
- 제7조 면책 보강 (신규 IPO 데이터 부족·통합 평단가 추정값)
- 제14조 알림 옵트인 신설
- 제15조 베타 특수 조항 신설

`/privacy` v1 → v2:
- 베타 단계 명시
- 수집 항목 6종 추가 (푸시·이메일·1탭 피드백·증권사·tier·온보딩 이벤트)
- 보유 기간 표 신설 (알림 로그 90일·푸시 무효 시 즉시·피드백 영구)
- 위탁업체 5건 추가 (Anthropic·Finnhub·Resend·Web Push·OpenExchangeRates)

### C. 9인 패널 회의 (커밋 9c71950)

방식: Agent 9개 병렬 호출 + 자유 토론 (사용자 명시 A 옵션).

패널: PM · UX 디자이너 · 법무 · 그로스 · 페르소나(36 직장인) · 페르소나(27 사회초년생) · 아키텍트 · QA · VC.

**100% 합의 BLOCKER 12건** (D-7 안 처리, 합 2~2.5일):
1. RESEND env 적용 (인프라·PM·QA)
2. check-alerts cron 누락 등록 (PM 발견)
3. 카카오 OAuth redirect URL 검증
4. iOS PWA standalone 코치마크
5. OG 이미지 동적 생성
6. Sentry/PostHog 1개 도입
7. 샘플 포트폴리오 sandbox 분리 (페르소나1 발견)
8. AI 촉 카드 인라인 면책 + "당신에게 추천" 금지
9. 14세 미만 가입 게이트
10. 약관·개인정보 동의 시점 DB 로깅
11. color_scheme: light lock
12. logo-solb.svg 정리 + maskable 별도

**충돌·합의**:
- AI 촉 영구 무료 vs PRO 차별화 → **AI 동일 + 딜리버리 깊이·푸시 시간·빈도만 PRO** (자본시장법 영향 0)
- 디자인 리브랜딩 D-7 가능? → **V1 (D-7) + V1.1 (출시 후 1주 토큰화)**
- 베타 AI 한도 강제? → **Free tier 그대로**

**페르소나 진짜 함정** (PM·디자이너 미발견):
- 36 직장인: 샘플 포트폴리오가 실제 보유로 들어감 / OCR 보안 우려 / 카피 보험사 톤
- 27 사회초년생: "비서" 거리감 / 다증권사 카피 안 해당 / 모닝브리프 = Aha 1순위

**KPI 5종**: D7 ≥30% / 첫 AI 촉 ≤5분 ≥70% / WAU/MAU ≥0.5 / 👍률 ≥60% / PRO survey ≥25%.

**PRO 출시 트리거 동시 충족**: 가입 1,500+ AND D7 30%+ AND PRO 15%+ AND affiliate 1건+.

**6개월 단일 위협 (VC)**: 토스증권 AI 출시 확률 50%+ → 멘토 6명 시연 영상 5분 6/30 전 라이브 필수.

`docs/BETA_LAUNCH_REVIEW.md` 신규 (11 섹션, 영구 보존).

### D. D-6 인프라 5건 (커밋 d0891e8, 1e76442)

1. ✅ check-alerts cron vercel.json 등록 (KST 22:00 = UTC 13:00, 미장 개장 직전·푸시 quiet hours 안전)
2. ✅ Vercel Analytics + SpeedInsights + Sentry v10 설치
   - `@vercel/analytics`, `@vercel/speed-insights`, `@sentry/nextjs`
   - 4 config 파일 (instrumentation.ts + client/server/edge)
   - DSN 없으면 자동 비활성 (`enabled: !!dsn`)
3. ✅ Service Role 클라 번들 누출 검증 — 0건 (모두 server route 안)
4. ✅ Cron 7개 Authorization 가드 검증 — 모두 통과
5. ⏳ RESEND env 적용 — 사용자 액션

### E. D-5 법무 5건 (커밋 1a002e7)

1. **14세 게이트 + 동의 체크박스** (LoginModal):
   - 만 14세·약관 v2·개인정보 v2 필수 3개
   - 모두 체크 안 하면 OAuth 버튼 비활성

2. **동의 시점 DB 로깅** (BLOCKER #10):
   - `supabase/migrations/2026-05-15_user_consents.sql` 신규
   - sessionStorage 저장 + useAuth onAuthStateChange에서 anon→authenticated 감지 시 upsert (3건)
   - `onConflict: ignoreDuplicates` — 재로그인 안전

3. **AI 촉 카드 인라인 면책** + FORBIDDEN_PHRASES 7개 추가:
   - ChokCard keyMetric 옆 'ⓘ 정보용' 9px (캡처 시 함께 노출)
   - '당신에게 추천', '맞춤 추천', '회원님께 추천' 등 → 유사투자자문업 신호 차단

4. ⏳ 카카오 OAuth redirect URL 검증 — 사용자 액션

5. **멘토 6명 퍼블리시티 검수**:
   - balance.tagline '어떤 폭풍에도 버티는' → '다양한 시장에 대비한 분산' (Ray Dalio All Weather 회피)
   - 5명 안전 (일반화 한국어 + 동물 캐릭터)

### F. D-4 디자인 V1 (커밋 e044602)

1. `color_scheme: light` lock (manifest + layout html · meta)
2. OG 이미지 동적 생성 (`src/app/opengraph-image.tsx` Next.js 16 ImageResponse)
3. `logo-solb.svg` 잔존 정리 (사용처 0건 확인 후 삭제)
4. metadata 톤다운 ("폭풍우" 제거 + 베타 무료 명시)
5. ⏳ maskable PNG 별도 / iOS 스플래시 / 로고 색상 → 외부 자산 또는 사용자 결정

### G. D-3 UX 함정 (커밋 9a7bd0e)

1. **샘플 포트폴리오 sandbox 분리** (페르소나1 발견):
   - `addStock('investing')` → `addStock('watching')` 변경
   - 버튼 텍스트 "샘플 종목 둘러보기 (관심 목록)"
   - 안내: "실제 보유 X · 관심 목록에 추가 · 언제든 삭제 가능"

2. **랜딩 슬로건 톤다운**:
   - "폭풍우에도 흔들리지 않는 내 주식 비서" → "내 주식, 쉽게 읽어주는 AI 비서"
   - metadata title·description 일관 갱신
   - A/B 인프라는 V1.1로 (현재 A버전만)

3. **"수동 입력" 솔직 카피** + OCR 보안 안내:
   - "🏦 토스·키움..." 옆 "직접 입력 또는 스크린샷 OCR · 이미지는 서버에 저장하지 않습니다"

4. iOS PWA standalone 코치마크 — PwaInstallCard 기존 존재 검증
5. PER/VIX hover tooltip → V1.2

### H. D-1 QA smoke (커밋 1461781)

`docs/BETA_SMOKE_CHECKLIST.md` 신규:
- P0 톱 10 실기기 시나리오 (가입·OCR·다증권사·푸시·이메일·삭제·PWA)
- 카나리 5명 24h 검증 절차
- 출시 후 24h 모니터링 6종

## 결정사항

### Vercel Pro 전환 보류
Hobby 유지 결정 (사용자 비용 절감 우선). 단:
- Active CPU 80% 도달 시 자동 전환 트리거
- 베타 100명 미만에서는 충분

### Sentry vs PostHog
**Sentry 결정** — 9인 패널 권장 (에러 추적 critical, 베타 사고 캐치). PostHog는 V1.2 (그로스 KPI 확장 시).

### 마이그레이션 적용 운영 룰
사용자가 직접 Supabase Studio에서 SQL 붙여넣기 운영 — Vercel CLI 미설치, supabase CLI 미사용.

### 동의 DB 로깅 v2 운영
`terms_version` 컬럼이 'v1' 'v2'... 누적. 사용자가 동의한 시점의 버전 보관. 약관·개인정보 변경 시 재동의 modal 트리거 기준.

## 미해결 TODO

### 🔴 사용자 액션 5건 (출시 차단)
- [ ] **Vercel env 4개**: `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`
- [ ] **마이그레이션 적용**: `supabase/migrations/2026-05-15_user_consents.sql` (Supabase Studio)
- [ ] **OAuth redirect URL 검증**: Supabase + 카카오 콘솔 production만 화이트리스트
- [ ] **실기기 톱 10 smoke 통과**: iOS·Android·PC 각 1대 (`docs/BETA_SMOKE_CHECKLIST.md`)
- [ ] **카나리 5명 24h 검증** → Production 승격

### 🟡 외부 자산
- maskable 아이콘 별도 PNG (현재 임시 same file)
- iOS PWA 스플래시 8종 (iPhone SE~Pro Max)
- 멘토 6명 시연 영상 5분 (6/30 전 라이브 필수 — 토스 AI 출시 방어)

### 🟡 V1.2 보류 (출시 후)
- 다크모드 정식 토글 + 위험 영역 3개 검증
- 랜딩 슬로건 A/B 인프라 (`/landing?v=a/b`)
- PER/VIX/MACD hover tooltip (커스텀 `<TermHint>`)
- 푸시 권한 타이밍 재설계 (2번째 세션 + AI 촉 1회 후)
- admin·debug 디자인 토큰 마이그레이션 (Step 5)

## 다음 세션 진입점

1. 사용자가 위 5건 액션 완료했는지 확인
2. 베타 출시 D-day (2026-05-22 가정) 진행
3. 출시 후 1주 funnel 데이터 확인 → 9인 패널 2차 회의 (베타 1주차 회고)

또는 사용자 새 방향.

## 메모리 승급 자문

이번 세션에서 다룬 영속적 룰·전략 중 승급 후보:

1. **Supabase 1000 limit 함정** — `.select()` 페이지네이션 필수 규칙 (`feedback_supabase_pagination.md` 또는 reference 신규)
2. **베타 KPI SSOT** — D7 30%·첫 AI 촉 5분·👍 60%·PRO 트리거 (project_beta_kpi 신규)
3. **9인 패널 BLOCKER 패턴** — 베타 출시 전 점검 방법론·12 BLOCKER 카테고리 (project 또는 reference)
4. **Sentry + Vercel Analytics 도입 결정** — 모니터링 도구 stack (reference_external 갱신)

사용자 동의 시 승급 진행.
