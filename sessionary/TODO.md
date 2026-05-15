# 미해결 TODO

이 파일은 세션 간 누적되는 미해결 작업 항목입니다.
세션 시작 시 자동 로드되며, 세션 종료 시 갱신합니다.

## 진행 중

- [ ] **🟡 Obsidian export** — 2026-05-13 세션 결과물(docs/ 8건 + 세셔너리 2건)을 사용자 Obsidian Vault로 내보내기. 다음 세션 시작 시 사용자에게 vault 경로 + export 범위 확인 후 진행.

## 🚀 베타 출시 D-7 차단 BLOCKER (2026-05-15 9인 패널 합의)

> 상세: `docs/BETA_LAUNCH_REVIEW.md` (12 BLOCKER · 충돌·합의 · KPI · D-7 진행 순서)

### 인프라 (D-6, 합 3시간)
- [ ] **RESEND_API_KEY/EMAIL_FROM Vercel env 적용** — 도메인 검증 + 테스트 메일 1통
- [ ] **`check-alerts` cron vercel.json 등록 여부 확인** (누락 시 알림 0건 출시 위험)
- [ ] **Sentry 또는 PostHog 1개 도입** — DSN + tracesSampleRate 0.1
- [ ] **Service Role Key 클라 번들 누출 검증** — `grep -r "SERVICE_ROLE" src/app` 0건 확인
- [ ] **Cron 7개 모두 `Authorization: Bearer` 가드 검증**

### 법무 (D-5, 합 4~5시간)
- [ ] **14세 미만 가입 차단 게이트** + 회원가입 화면 체크박스 (개인정보보호법 §22-2)
- [ ] **약관·개인정보 동의 시점 DB 로깅** — `users.terms_version_agreed_at`, `privacy_version_agreed_at` 컬럼 + 변경 시 재동의 modal
- [ ] **AI 촉 카드 인라인 면책 + `FORBIDDEN_PHRASES`에 "당신에게 추천", "맞춤 추천" 추가**
- [ ] **카카오 인앱브라우저 OAuth redirect URL 화이트리스트 검증** (production만)
- [ ] **멘토 6명 캐릭터 퍼블리시티 검수** — 실존 인물 연상 회피 + 각 멘토 카드 디스클레이머

### 디자인 V1 (D-4, 합 1일)
- [ ] **`color_scheme: light` lock + 매니페스트 정렬** (다크 깨짐 방지)
- [ ] **OG 이미지 동적 생성** (`opengraph-image.tsx` Next.js 16 ImageResponse)
- [ ] **`logo-solb.svg` → `logo-jubi.svg` 정리 + maskable 아이콘 별도 출력**
- [ ] **iOS PWA 스플래시 8종** (iPhone SE~Pro Max 해상도)
- [ ] **로고·primary color·랜딩 슬로건만 V1 (0.5~1일)** — 풀 토큰화는 V1.1로

### UX·페르소나 함정 (D-3, 합 1일)
- [ ] **iOS PWA 푸시 standalone only 코치마크 분기** (16.4+ 안내)
- [ ] **샘플 포트폴리오 sandbox 분리** ("진짜 보유로 들어감" 함정 차단) — 또는 "샘플 지우기" 즉시 버튼
- [ ] **랜딩 슬로건 A/B 2종** (`/landing?v=a/b`) — "투자는 토스, 공부는 주비" + "내 NVDA, 토스+키움 합쳐서 진짜 평단"
- [ ] **랜딩에 "수동 입력" 솔직 한 줄** + OCR 보안 안내 ("이미지 서버 저장 안 됨")
- [ ] **PER/VIX/MACD/베타 hover tooltip** + 멘토 카드에 "어떤 사람" 1줄

### QA (D-1, 0.5일)
- [ ] **수동 smoke 톱 10 시나리오 통과** (카카오 가입·OCR·다증권사·푸시·이메일·계정 삭제·PWA 설치)
- [ ] **카나리 5명 24h** (Vercel Preview URL → Production 승격)

### 인프라 보강 (BLOCKER 외 🟡)
- [ ] **`notification_log` UNIQUE(user_id, alert_type, date) + idempotency key** — cron retry 중복 알림 차단 (오늘 23,413 오탐과 같은 종류)
- [ ] **Supabase Free `pg_dump` GitHub Actions 일별 cron** (03:00 KST, S3/Drive 업로드)
- [ ] **Web Push 410 GONE → `push_subscriptions` 자동 삭제 핸들러**
- [ ] **`usdKrw` stale 환율 가드** (모닝브리프 발송 직전 freshness 체크)

### 출시 후 즉시 (V1.1, D+7 이내)
- [ ] **디자인 리브랜딩 풀스코프** — CSS 토큰 시스템 (`--brand-*`) + 다크모드 정식 지원
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
