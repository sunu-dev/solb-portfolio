# 미해결 TODO

이 파일은 세션 간 누적되는 미해결 작업 항목입니다.
세션 시작 시 자동 로드되며, 세션 종료 시 갱신합니다.

## 진행 중

- [x] ~~**🟡 Obsidian export** — 2026-05-13~05-20 세션 결과물 13건을 `~/Dev/Obsidian/sunu-space/00_Inbox/from-projects/solb-portfolio/`로 export 완료 (2026-05-20)~~

## 🆕 2026-05-20 세션 — 20인 패널 종합 감사 (P0 18건 코드 ✅)

> **종합 문서**: `docs/BETA_D6_PANEL_AUDIT.md` (5분야 회의 결과 + 반영 + 사용자 액션 + P1/P2)

### 코드 반영 완료 (18건)
- [x] ~~P0-1: check-alerts cron GET 핸들러 추가 (POST→POST+GET 분기)~~ — 알림 100% 누락 차단
- [x] ~~P0-2: ai_chok_cache admin client (anon → service-role)~~ — Gemini quota 폭발 차단
- [x] ~~P0-3: ai_chok_recommendations admin INSERT~~ — 백테스트 누적 활성화
- [x] ~~P0-4: codes/validate body userId → token 검증~~ — 보안
- [x] ~~P0-5: user_consents·user_profiles_tier 마이그 git 복구~~
- [x] ~~P0-6: technical.ts historicalNote 환각 통계 제거~~
- [x] ~~P0-7: getChartShapeSummary "70% 확률" 제거~~
- [x] ~~P0-8: 환율 fallback 1400 사용 시 console.error → Sentry 캡쳐~~
- [x] ~~P0-9: 검색 API 비-USD/비-KRW 종목 차단 (.T/.HK/.L 등)~~
- [x] ~~P0-10: 종목당 일일 푸시 3개 cap (NOTIFICATION_POLICY §3.1)~~
- [x] ~~P0-11: "SOLB" 7곳 → "JOOBI" + invite prefix `SOLB-`→`JB-`~~
- [x] ~~P0-12: "폭풍우" 3곳 → "내 주식, 매일 한 줄로 읽어드려요"~~
- [x] ~~P0-13: LoginModal·Header 빨강 J → Mossy Teal~~
- [x] ~~P0-14: alert_log silent fail 제거 + sendCronAlert~~
- [x] ~~P0-15: notification_log 마이그 + morning-brief 멱등성 가드~~
- [x] ~~P0-16: cronAlert 유틸 신설 + check-alerts·morning-brief 적용~~
- [x] ~~P0-17: OCR 카피 "처리 후 즉시 폐기" 정확화~~
- [x] ~~P0-18: 인앱 버그 신고 채널 (bug_reports + /api/feedback/report + /help 폼)~~

### 🔴 사용자 액션 (D-6 안 필수) — Phase A~G
- [ ] **Phase A**: 가비아 joobi.kr 결제 완료 + Vercel Add Domain + 가비아 DNS + Resend 가입 + SPF/DKIM TXT
- [ ] **Phase B**: Sentry 가입 + DSN 복사
- [ ] **Phase C**: Vercel env 입력 — `RESEND_API_KEY` `EMAIL_FROM` `NEXT_PUBLIC_SENTRY_DSN` `SENTRY_DSN`
- [ ] **Phase D**: Supabase SQL Editor에 2건 적용:
  - `supabase/migrations/2026-05-20_notification_log.sql` (푸시 멱등성)
  - `supabase/migrations/2026-05-20_bug_reports.sql` (인앱 신고)
- [ ] **Phase E**: 카카오 콘솔·Supabase Auth Redirect URLs production만 화이트리스트
- [ ] **Phase F**: Slack workspace + 채널 4개 (#beta-bug, #beta-alert, #beta-deploy, #beta-feedback) + Vercel env `SLACK_WEBHOOK_CRON` `SLACK_WEBHOOK_BUG`. 카카오 오픈채팅방 개설
- [ ] **Phase G**: Redeploy + Sentry test event + morning-brief 수동 트리거 + /help 신고 폼 검증

### 카나리 24h 페르소나 화이트리스트 (운영 패널 합의)
- [ ] 다증권사 30대 (iOS Safari)
- [ ] 1증권사 20대 (Android Chrome)
- [ ] **Samsung Internet** 30대 (필수)
- [ ] **카카오 인앱브라우저** 20대 (필수)
- [ ] PC desktop 30대

### 합의된 출시 일자
- [ ] **5/26(월) 권고** — 5/22(금)은 risk-adjusted 음수. joobi.kr 5/21 이전 완료 시 카나리 4일 가능

## 🆕 2026-05-19 세션 결과물 (베타 D-7 BLOCKER 묶음 — 코드 ✅)

> 상세: `sessionary/2026-05-19-news-tab-p0.md` + `sessionary/2026-05-19-logout-race-and-josa.md`

### 뉴스탭 P0 — 코드 ✅
- [x] ~~3인 전문가 병렬 회의 (데이터/Next.js/UX)~~
- [x] ~~P0-A 빈 응답 캐시 no-store~~
- [x] ~~P0-B cacheTimes 버그 픽스 (Zustand newsCacheTimes)~~
- [x] ~~P0-C 클라이언트 타임아웃 + 반환 타입 분기 (NewsFetchResult)~~
- [x] ~~P0-D 내 종목 탭 progressive setState + fan-out 5→3~~
- [x] ~~P0-E API 타임아웃 단축 (8→5s, 6→3.5s)~~
- [x] ~~P0-F useAutoRefresh section/visibility 가드~~
- [x] ~~P0-G EmptyState 4분기 + retry counter (1/3)~~

### 로그아웃 race 3계층 — 코드 ✅
- [x] ~~InviteGate signOut 우회 수정 (useAuth.signOut 경유)~~
- [x] ~~resetPortfolio 4필드 추가 (investorType/setAt/dailySnapshots/customEvents)~~
- [x] ~~clearUserStorage 누락 8키 + prefix 매칭 + candle_* 동적 키~~
- [x] ~~useAuth.signOut try-catch + window.location 리다이렉트~~
- [x] ~~onAuthStateChange 로그아웃 분기 (prevId && !newId)~~
- [x] ~~usePortfolioSync syncUserIdRef 가드 + pending timer 취소~~

### 한국어 조사 유틸 — 코드 ✅
- [x] ~~src/utils/koreanJosa.ts 신설 (hasJongseong/iGa/eunNeun/eulReul/gwaWa/euroRo)~~
- [x] ~~CohortReference.tsx HIDDEN PICKS 카드~~
- [x] ~~technical.ts pattern desc~~
- [x] ~~alertsEngine.ts 급등/급락 알림~~
- [x] ~~SearchBar.tsx 종목 중복 confirm~~

### 🔴 사용자 액션 (실기기 검증 필수, 베타 출시 전)
- [ ] **로그아웃 3시나리오 종목 잔존 0건 확인**: 정상/InviteGate/다른 탭
- [ ] **"성장 투자자가 자주 보는"** HIDDEN PICKS 카드 표시 확인
- [ ] **뉴스탭 회선 끊김 → "연결을 확인해주세요" + retry counter** 동작 확인
- [ ] **로그아웃 후 자동 reload** 동작 + 헤더/포트폴리오 정리 확인

### 🟡 다음 세션 P1 (D+7 안)
- [ ] **네이버 Search API fallback** — CLIENT_ID/SECRET 발급 + Vercel env + route.ts 시퀀스 추가
- [ ] **"방금 갱신" 배지** — `newsCacheTimes` 활용 (Mossy Teal 점 + "N분 전 갱신")
- [ ] **Pull-to-refresh** (모바일)
- [ ] **SWR optimistic 탭 전환** (cache hit 시 0ms cross-fade)
- [ ] **BETA_SMOKE_CHECKLIST.md** 보강 — 로그아웃 잔존 + 조사 + 뉴스탭 시나리오
- [ ] **한국어 조사 유틸 적용 범위 확대** — analysisPrompt.ts, 멘토 결과 텍스트 전수 검사

### 🟡 V1.2 (P2)
- [ ] **Cache Components (`'use cache'`) 시장 탭 한정 도입** — `cacheComponents: true` 활성화, 라우트 판정 알고리즘 변경 영향 검토
- [ ] **Supabase + Cron 뉴스 사전 수집** — Google News 의존 최종 제거
- [ ] **시장 탭 Server Component + Suspense streaming** 점진 분리
- [ ] **영문 발음 받침 룰** (l/m/n/ng 끝나는 영문 처리)

## 🚀 베타 출시 D-7 진행 상황 (2026-05-15)

> 상세: `docs/BETA_LAUNCH_REVIEW.md` · QA: `docs/BETA_SMOKE_CHECKLIST.md`

### 인프라 (D-6) — 코드 ✅
- [x] ~~check-alerts cron vercel.json 등록~~ — `d0891e8` (KST 22:00)
- [x] ~~Vercel Analytics + Sentry 설치~~ — `1e76442` (DSN 없으면 자동 비활성)
- [x] ~~Service Role 클라 누출 검증~~ — 0건
- [x] ~~Cron 7개 Authorization 가드 검증~~ — 모두 통과
- [ ] **🔴 사용자 액션 (결제 진행 중, 결제 완료 후 즉시 시작 가능)**: joobi.kr 도메인 + RESEND·SENTRY env 4개
  - **현재 상태 (2026-05-18)**: 가비아에서 `joobi.kr` 2년 결제 진행 중. KIPRIS 상표 검토 완료 (JOOBI 충돌 0건, 한글 "주비"는 아소비교육 38류 캐릭터로 카테고리 다름 → 사용 OK)
  - **트리거 단어 (다음 세션)**: "등록했어", "결제 완료", "joobi.kr 진행하자", "1번 진행", "Phase A 진행" 중 무엇이든 OK
  - **결제 완료 후 진행 흐름**:
    1. **Vercel Add Domain** (3분, 함께): solb-portfolio → Settings → Domains → Add `joobi.kr` + `www.joobi.kr`
    2. **가비아 DNS 레코드 추가** (5분, 함께): A `@` → 76.76.21.21 + CNAME `www` → cname.vercel-dns.com (Vercel 안내값 그대로)
    3. **DNS 전파 대기** (5분~24시간 자동)
    4. **`https://joobi.kr` 정상 접속 확인** + HTTPS 자동 발급
    5. **Phase A — Resend**: resend.com Google OAuth 가입 → API Keys → Create (`solb-portfolio-prod`, Sending access) → `re_xxxx` 복사 → DNS TXT 추가 (SPF/DKIM, 가비아) → `EMAIL_FROM="주비 <noreply@joobi.kr>"`
    6. **Phase B — Sentry**: sentry.io Google/GitHub OAuth 가입 → Create Project → Next.js → DSN 복사
    7. **Phase C — Vercel env 입력**: `RESEND_API_KEY` · `EMAIL_FROM` · `NEXT_PUBLIC_SENTRY_DSN` · `SENTRY_DSN` (Production+Preview+Dev 모두 체크)
    8. **Phase D — 검증**: Vercel Redeploy → Sentry test event → morning-brief cron 수동 트리거 → 이메일 수신 확인 (Gmail·Naver)
  - **Phase B — Sentry 가입 + DSN**:
    - sentry.io Google/GitHub OAuth 가입 → Create Project → Platform: **Next.js** → Project name: `solb-portfolio` → DSN 복사 (`https://xxxx@xxxx.ingest.sentry.io/xxxx`)
    - tracesSampleRate 0.1 (이미 코드 적용)
  - **Phase C — Vercel UI 입력** (vercel.com → solb-portfolio → Settings → Environment Variables):
    - `RESEND_API_KEY` = `re_xxxx` (Phase A에서 발급)
    - `EMAIL_FROM` = (Phase A에서 결정)
    - `NEXT_PUBLIC_SENTRY_DSN` = (Phase B DSN)
    - `SENTRY_DSN` = (위와 같은 값)
    - 4개 모두 Production + Preview + Development 체크
  - **Phase D — 검증** (Claude가 자동 진행 가능):
    - Vercel Redeploy 트리거 (또는 자동 재배포 대기)
    - Sentry 대시보드에서 test event 확인
    - morning-brief cron 수동 트리거 → 이메일 수신함 확인 (Gmail·Naver)

### 법무 (D-5) — 코드 ✅
- [x] ~~14세 게이트 + 동의 체크박스 (LoginModal)~~ — `1a002e7`
- [x] ~~동의 시점 DB 로깅 (user_consents 테이블·useAuth INSERT)~~ — `1a002e7`
- [x] ~~AI 촉 카드 인라인 면책 + FORBIDDEN_PHRASES 7개 추가~~ — `1a002e7`
- [x] ~~멘토 6명 퍼블리시티 검수 (balance tagline 톤다운)~~ — `1a002e7`
- [x] ~~**사용자 액션**: `supabase/migrations/2026-05-15_user_consents.sql` 적용~~ — 2026-05-15 완료
- [ ] **🔴 사용자 액션**: 카카오 콘솔·Supabase Auth Redirect URLs production만 화이트리스트

### 디자인 V1 (D-4) — 코드 ✅
- [x] ~~color_scheme: light lock~~ — `e044602`
- [x] ~~OG 이미지 동적 생성 (opengraph-image.tsx)~~ — `e044602`
- [x] ~~logo-solb.svg 잔존 정리~~ — `e044602`
- [ ] **🟡 외부 자산**: maskable 아이콘 별도 PNG (현재 임시 same file)
- [ ] **🟡 외부 자산**: iOS PWA 스플래시 8종 (iPhone SE~Pro Max)
- [ ] **🟡 사용자 결정**: 로고·primary color·랜딩 슬로건 V1 디자인

### UX 함정 (D-3) — 코드 ✅
- [x] ~~샘플 포트폴리오 sandbox 분리 (watching + 안내)~~ — `9a7bd0e`
- [x] ~~랜딩 슬로건 톤다운 + "수동 입력"·OCR 보안 카피~~ — `9a7bd0e`
- [x] ~~iOS PWA PwaInstallCard 기존 존재 검증~~ — SettingsPanel 마운트
- [ ] **🟡 V1.2**: 랜딩 슬로건 A/B 인프라 (`/landing?v=a/b`)
- [ ] **🟡 V1.2**: PER/VIX hover tooltip (커스텀 `<TermHint>` 컴포넌트)
- [ ] **🟡 V1.2**: 푸시 권한 타이밍 재설계 (2번째 세션 + AI 촉 1회 직후)

### 디자인 리브랜딩 V1.1 — 코드 ✅ (2026-05-15 한 세션 압축 완료)
- [x] ~~3인 패널 회의 (아트·UX·페르소나27)~~ — Mossy Teal #0E7C7B + Amber #F59E0B 합의
- [x] ~~Step 1: CSS 토큰 시스템 (globals.css `:root`·`.dark`)~~ — `a56b05c`
- [x] ~~Step 2: 첫 화면 5개 (landing·OG·LoginModal·Onboarding·AiChokSection)~~ — `a56b05c`
- [x] ~~Step 3: 카드 3종 (MorningBriefing·MergedHoldings·BrokerSummary)~~ — `738d504`
- [x] ~~Step 4: 레이아웃 + /help (Header·RightSidebar·MobileNav·help)~~ — `738d504`
- [ ] **🟡 V1.2**: 다크모드 정식 토글 + 위험 영역 3개 (AI 촉 그라데이션·멘토 SVG·차트 grid)
- [ ] **🟡 V1.2**: admin·debug 화면 마이그레이션 (Step 5)
- [ ] **🟡 V1.2**: inline-style hex 잔존 lint (`no-inline-hex` 룰)

### QA (D-1) — 실기기 수동 sweep
- [x] ~~체크리스트 작성 (docs/BETA_SMOKE_CHECKLIST.md)~~ — `9a7bd0e`
- [ ] **🔴 사용자 액션**: 톱 10 시나리오 실기기 통과 (iOS·Android·PC 각 1대)
- [ ] **🔴 사용자 액션**: 카나리 5명 24h 검증 → Production 승격

### 인프라 보강 (BLOCKER 외 🟡)
- [ ] **`notification_log` UNIQUE(user_id, alert_type, date) + idempotency key** — cron retry 중복 알림 차단 (오늘 23,413 오탐과 같은 종류)
- [ ] **Supabase Free `pg_dump` GitHub Actions 일별 cron** (03:00 KST, S3/Drive 업로드)
- [ ] **Web Push 410 GONE → `push_subscriptions` 자동 삭제 핸들러**
- [ ] **`usdKrw` stale 환율 가드** (모닝브리프 발송 직전 freshness 체크)

### 출시 후 즉시 (V1.2, D+7 이내)
- [x] ~~디자인 리브랜딩 핵심 (V1.1 Step 1~4)~~ — 한 세션 압축 완료 (2026-05-15)
- [ ] **PRO 결제 페이지 UI 시안** (`/upgrade` 더미) — 결제 의향 측정 시작
- [ ] **멘토 시연 영상 5분 — 6/30 전 라이브** (토스 AI 출시 방어 시그니처)
- [ ] **인스타 릴스 30초 × 3** (멘토 6명 NVDA 분석 차이)
- [ ] **베타 첫 10명 인터뷰 후기 카드** (Notion 공개 + 카톡 공유용)

### KPI 임계 (베타 1개월 측정)
- D7 retention ≥30% / 가입→첫 AI 촉 ≤5분·≥70% / WAU/MAU ≥0.5 / AI 촉 👍률 ≥60% / PRO survey ≥25%
- **PRO 출시 트리거 동시 충족**: 가입 1500+ AND D7 30%+ AND PRO survey 15%+ AND affiliate 1건+

## 대기 (우선순위 순)

### 🔴 사용자 액션 필요 (이메일 백업 채널 활성화 위해)

- [x] ~~**Supabase migration 모두 적용 완료** (2026-05-13 통합 SQL `_combined_pending_2026-05-13.sql` 한 번에 실행)~~
  - [x] ~~`2026-04-28_ai_chok_recommendations.sql`~~ — AI 촉 백테스트 로깅
  - [x] ~~`2026-05-02_alert_log.sql`~~ — 알림 송신 로그 (분쟁 증거)
  - [x] ~~`2026-05-02_email_subscriptions.sql`~~ — 모닝브리프 이메일 옵트인
  - [x] ~~`2026-05-02_email_subscriptions_monthly_d3.sql`~~ — 월말 D-3 옵트인
  - [x] ~~`2026-05-02_push_subscriptions_created_at.sql`~~ — 7일 ramp-up
  - [x] ~~`2026-05-10_ai_chok_cache.sql`~~ — AI 촉 캐시 + 다양성 컬럼
  - [x] ~~`2026-05-12_stock_listings.sql`~~ — 신규 상장 감지
  - [x] ~~`2026-05-12_user_profiles_tier.sql`~~ — PRO 멤버십 게이트
  - [x] ~~`2026-05-13_ai_feedback.sql`~~ — 1탭 피드백 (Phase 1 P0-3)
- [ ] **Vercel 환경변수 추가**
  - `RESEND_API_KEY` (resend.com 발급, 무료 월 3천건)
  - `EMAIL_FROM` (예: `"주비 <noreply@solb.kr>"`, 도메인 검증 필요)
  - `EMAIL_UNSUB_SECRET` (선택 — 없으면 CRON_SECRET fallback)
  - (선택) `CHOK_DAILY_FREE=1` `CHOK_DAILY_PRO=30` `ANALYSIS_DAILY_FREE=3` `ANALYSIS_DAILY_PRO=30` — 미설정 시 코드 기본값 동일

### 일반 대기

- [x] ~~stock_listings 마이그레이션 + cron 첫 트리거~~ — **완료 (2026-05-13)**. US 24,400건 수집, KS/KQ는 별도 우회.
- [x] ~~Phase 1 P0-6 KPI funnel 위젯~~ — **완료 (2026-05-13)**. /admin 성장 탭에 onboarding/tour/feedback funnel 위젯 + AI 만족도 표시.
- [x] ~~Phase 1 P0-7 Universe 3중 AND 자동 검증~~ — **완료 (2026-05-13)**. enrich-listings에서 자동 'eligible' 승급.
- [x] ~~Phase 1 P0-9 KRX 한국 종목 우회~~ — **완료 (2026-05-13)**. /api/search 자동 등록.
- [x] ~~Phase 2 P1-3 챕터 시즌제 강화~~ — **완료 (2026-05-13)**. D-7 카운트다운 + 회고 자연어 자동 생성.
- [x] ~~Phase B-1 broker 필드~~ — **완료 (2026-05-13)**. 한국 증권사 15개 + OCR 자동 추정 + BrokerSummaryCard.
- [x] ~~Phase B-2 필터·챕터 통합~~ — **완료 (2026-05-13)**. 클릭 필터 + brokerChampions 라인.
- [x] ~~Phase B-4 마케팅 카피~~ — **완료 (2026-05-13)**. /help + /landing 보강.
- [x] ~~Phase M-1·M-2·M-3 (다중 broker 통합 + 동일 티커 합산)~~ — **완료 (2026-05-13)**. mergeHoldings selector + MergedHoldingsCard + 통합 자산 헤더.
- [ ] **🟡 Phase M-4 세금 비서 (Phase 3, 진짜 moat)** — accountType 활성화 + ISA/IRP 한도 안내 + PRO 매도 순서 최적화. 베타 500명 + 세무 검토 + 변호사 자문 필수.
- [ ] **🟡 (후속) KRX/OpenDART 한국 신규 상장 자동 fetch cron** — admin 수동/search 자동 등록은 임시. 월 10건 이하라 운영 가능하나 완전 자동화는 후속.
- [ ] **🟡 enrich-listings cron 1주일 모니터링** — `SELECT count(*) FROM stock_listings WHERE market_cap IS NOT NULL;` 진행률 확인. 일별 40건이라 시총 큰 종목 25일 안 완료 예상.
- [ ] **🟡 코치마크 모바일 보텀시트 패턴** — 베타 사용자 피드백 보고 결정.
- [ ] **🟡 docs/UNIVERSE_INCLUSION_CRITERIA.md** 작성 — 법무 리스크 회피용 외부 문서 (코드는 이미 enrich-listings에 구현됨).
- [ ] **🟡 ai-analysis 신규 IPO 안내** — 6개월 이내 IPO 종목 분석 시 "데이터 부족" 안내. stock_listings 데이터 누적 후.
- [ ] **🔴 NEXT** 베타 1주일 후 `/admin` 성장 탭 funnel 데이터 확인 — D1/D7 retention + AI 만족도 + 온보딩 이탈률.
- [ ] **🔴** `/admin/chok-debug` 배포 후 PER 채움률 확인 → 50% 이하면 F 작업(/candle fallback) 검토.
- [ ] **🟡 멘토 6명 시연 영상 (5분)** — 외부 제작. NVDA 종목 6명 분석 비교. 마케팅 핵심 자산.
- [ ] **🟡 PRO 결제 페이지 UI 시안** — 토스페이먼츠 등록 전 UI만 먼저. 1일.
- [ ] **🟡 PRO 결제 인프라 (토스페이먼츠)** — 사용자 계정 등록 후. 베타 100명+ 시점.
- [ ] **🟡 Phase B-3 계좌 종류 + 세무 비서** — ISA/IRP/연금. 진짜 moat. 베타 500명 후.
- [ ] **🟡 Affiliate 계좌 개설 보상** — 증권사 1~3개 제휴.
- [ ] 매수 시뮬 P2 (회의 결과 보류분):
  - 호가 단위 정렬 (가격대별 1원/10원/50원)
  - stale price 배지 (휴장/시간외)
  - 모바일 키보드 가림 sticky 또는 scrollIntoView
  - 엣지 케이스 가드 강화 (`usdKrw=0`, 음수 입력)
- [ ] 포트폴리오 맵 (PortfolioTreemap) 색·비율 사용자 피드백 따라 미세조정.
- [ ] 베타 1개월 후 `ai_chok_recommendations` 백테스트 데이터로 추천 효과성 분석.

### 알림 Phase 5 (보류)

- [ ] 푸시 송신 실패 시 자동 이메일 retry (현재 두 채널 독립)
- [ ] 카카오 알림톡 / SMS (비용 발생 → 매출 단계 검토)
- [ ] GitHub Actions CI에 `npm run lint:alerts` 통합 (현재는 prebuild 로컬만)

## 차단됨

(외부 요인으로 막힌 항목 — 차단 사유 함께 기록)

## 트리거 대기 (조건 충족 시 자동 발동 — auto-memory에 박힘)

- **유료화/PRO/멤버십 단어 등장 시:**
  - 약관 제12조 "무료" 표현 갱신
  - PRO 설계 가드레일 재확인 (AI 촉 무료 유지 원칙)
  - 변호사 1시간 상담 (30~50만원)
  - 결제 인프라 (토스페이먼츠/포트원)
- **사용자 손실 클레임 / 금감원 시정조치:** 즉시 변호사
- **광고 매출 연 5천만+:** 회색 지대 진입, 변호사 검토
