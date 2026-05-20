# 베타 출시 D-6 종합 검증 — 20인 패널 감사

> **작성일**: 2026-05-20 (출시 D-6)
> **목적**: 5분야 × 4인 = 20인 패널이 코드베이스 전체를 감사 → P0 BLOCKER 18건 도출 → 즉시 반영 → 출시 직전 사용자 액션·카나리·P1/P2 정리.
> **결론**: P0 18건 코드 반영 완료. 사용자 액션 8건 + 카나리 24h 통과 시 출시 가능. **권고 출시일 5/26(월)**.

---

## 0. 한 줄 결론

- 코드 측 베타 출시 가능성 ✅ — 18건 P0 BLOCKER 모두 반영, 빌드/타입체크/lint 통과.
- 사용자 액션 8건 미완 (joobi.kr DNS + Resend·Sentry env + Supabase 마이그 2건 + Slack + 카카오 등) — D-6 안에 완료 필요.
- 5/22(금) 출시는 카나리 24h 검증과 주말 운영 인력 부족으로 risk-adjusted 음수 → **5/26(월) 권고**.

---

## 1. 패널 구성

20인 = 5분야 × 4인. 각 분야는 Agent로 병렬 회의, 분야 종합 보고서 + 크로스 토론으로 종합.

| 분야 | 4인 패널 |
|---|---|
| 🏛️ 제품·전략 | PM · 포지셔닝 전략가 · 비즈니스 모델 검증가 · 컴플라이언스/법무 |
| 💻 엔지니어링·아키텍처 | 시스템 아키텍트 · Next.js 16/Vercel · 데이터·API 신뢰성 · 인증·보안 |
| 📊 알고리즘·금융 | Quant · AI/LLM 엔지니어 · 시장 데이터 정합성 · 알람 정책 |
| 🎨 UX·디자인 | 인터랙션 · 인지·정보구조 · 접근성·법무 카피 · 시각 시스템 |
| 🚀 운영·QA·그로스 | SRE/관측성 · QA 시나리오 · 그로스/온보딩 · 마케팅/PR |

---

## 2. 가장 치명적인 발견 Top 5 (재발견 불가 사고 차단)

> 다른 분야는 못 봤고 엔지니어링·알고리즘 단독 발견. 모두 베타 출시 직후 1주일 안에 사용자 체감 가능했을 사고.

| # | 발견 | 분야 | 영향 |
|---|---|---|---|
| 1 | **`check-alerts` cron**이 `vercel.json`의 GET을 받는데 `POST`만 export → 매일 405만 받고 알림 0건 | 엔지니어링 | 푸시 알림 100% 누락 |
| 2 | **`ai_chok_cache` RLS `for all using (false)` + anon client** → 캐시 비기능 → 매 호출 Gemini 풀사이클 | 엔지니어링 | Gemini Free quota D+3에 폭발 |
| 3 | **`ai_chok_recommendations` INSERT policy 없음** | 엔지니어링 | 백테스트 누적 0건 → chok-followup cron 무의미 |
| 4 | **`codes/validate`가 body의 `userId`를 신뢰** | 보안 | 타인 명의 코드·리퍼럴 보상 가로채기 |
| 5 | **`technical.ts` 환각 통계** ("5번 반등 평균 +12%" 하드코딩 / "70% 확률로 반등") | 알고리즘·법무 | 자본시장법 §6 분쟁 시 가장 약한 고리 |

---

## 3. 반영 완료 P0 18건 (코드 ✅)

### 3.1 Phase 1 — Critical 5건

| # | 작업 | 변경 위치 |
|---|---|---|
| P0-1 | `check-alerts` GET 핸들러 추가 (`export async function GET(req) { return POST(req); }` + method 분기) | `src/app/api/cron/check-alerts/route.ts:170` |
| P0-2 | `ai_chok_cache` 읽기/쓰기를 service-role admin client로 교체 (anon → admin) | `src/app/api/ai-chok/route.ts:14-22, 56-119` |
| P0-3 | `ai_chok_recommendations` INSERT를 admin client로 + 실패 시 `console.error` (silent 제거) | `src/app/api/ai-chok/route.ts:151-156` |
| P0-4 | `codes/validate`에서 body `userId` 제거 → Authorization Bearer 토큰에서 `supabaseAdmin.auth.getUser`로 추출 | `src/app/api/codes/validate/route.ts:9-27` |
| P0-5 | working tree 비어있던 2 마이그레이션 SQL 복구 (`git checkout HEAD --`) | `supabase/migrations/2026-05-12_user_profiles_tier.sql` (4B→1715B), `2026-05-15_user_consents.sql` (1B→1535B) |

### 3.2 Phase 2 — 알고리즘·법무 5건

| # | 작업 | 변경 위치 |
|---|---|---|
| P0-6 | `historicalNote` 하드코딩 통계 ("5번 반등 평균 +12%" 등) → RSI 일반 해석 (종목별 통계 아님 명시) | `src/utils/technical.ts:385-394` |
| P0-7 | `getChartShapeSummary` "70% 확률로 반등" 표현 제거 → "반드시 반등으로 이어지는 건 아니에요" | `src/utils/technical.ts:238-245` |
| P0-8 | 환율 fallback 1400 사용 시 `console.error` 로 Sentry 자동 캡쳐 (메시지 본문 변경은 P1) | `src/app/api/cron/check-alerts/route.ts:54-78` `morning-brief/route.ts:274-292` |
| P0-9 | 검색 API에서 비-USD/비-KRW 종목 차단 (`.T`/`.HK`/`.L`/`.PA`/`.DE` 등) | `src/app/api/search/route.ts:41-54` |
| P0-10 | `filterUnsent`에 종목당 일일 푸시 3개 cap 추가 (NOTIFICATION_POLICY §3.1) | `src/app/api/cron/check-alerts/route.ts:130-163` |

### 3.3 Phase 3 — UX·디자인 4건

| # | 작업 | 변경 위치 |
|---|---|---|
| P0-11 | "SOLB" 잔재 7곳 → "JOOBI" (워터마크 4·이메일 2) + invite 코드 prefix `SOLB-`→`JB-` | `PortfolioTreemap.tsx:593` `PortfolioMindmap.tsx:680` `PortfolioHeatmap.tsx:699` `PortfolioCirclePack.tsx:687` `emailTemplates.ts:63,119` `InviteGate.tsx:89` `api/codes/my-invite/route.ts:16` |
| P0-12 | "폭풍우" 잔재 3곳 → "내 주식, 매일 한 줄로 읽어드려요". (greetings/badges의 "비광·솔" 메타포는 뱃지 컨셉이라 보존) | `src/app/page.tsx:195` `src/app/api/og/route.tsx:37` `src/components/onboarding/OnboardingFlow.tsx:321` |
| P0-13 | LoginModal·Header 로고 빨강 박스 `#EF4452` → Mossy Teal `#0E7C7B` (손익 컨벤션과 시각 충돌 차단) | `src/components/auth/LoginModal.tsx:99` `src/components/layout/Header.tsx:58` |
| P0-17 | OCR 카피 "이미지는 서버에 저장하지 않습니다" → "서버에 영구 저장하지 않습니다 (OCR 처리 후 즉시 폐기)" — 법무 정확성 | `src/app/landing/page.tsx:83` |

### 3.4 Phase 4 — 운영·관측성 4건

| # | 작업 | 변경 위치 |
|---|---|---|
| P0-14 | `alert_log` silent fail 제거 → `sendCronAlert` 호출 (컴플라이언스 증거 보존) | `src/app/api/cron/check-alerts/route.ts:175-194` |
| P0-15 | `notification_log` 신규 마이그레이션 + morning-brief 송신 직전 멱등성 가드 (cron retry 중복 푸시 차단) | `supabase/migrations/2026-05-20_notification_log.sql` (NEW), `src/app/api/cron/morning-brief/route.ts:307-321` |
| P0-16 | `src/lib/cronAlert.ts` 유틸 신설 (`sendCronAlert`, `sendCronInfo`) + check-alerts·morning-brief 적용. `SLACK_WEBHOOK_CRON` 또는 `SLACK_WEBHOOK_URL` env 의존 (미설정 시 console.error로만 → Sentry 자동 캡쳐). 나머지 4개 cron(monthly-d3·chok-followup·enrich-listings·cleanup-pii) 적용은 P1로 미룸 — 변경 폭 vs ROI | `src/lib/cronAlert.ts` (NEW) |
| P0-18 | 인앱 버그·피드백 신고 채널: `bug_reports` 마이그레이션 + `/api/feedback/report` API + `/help` 페이지 인앱 폼 (카테고리 4종 chips + textarea + 이메일 + Slack #beta-bug webhook) | `supabase/migrations/2026-05-20_bug_reports.sql` (NEW), `src/app/api/feedback/report/route.ts` (NEW), `src/app/help/page.tsx:188-340` |

### 3.5 신규 파일 4건

```
src/lib/cronAlert.ts                                     — Cron 실패 알림 SSOT
src/app/api/feedback/report/route.ts                     — 인앱 신고 API
supabase/migrations/2026-05-20_notification_log.sql      — 푸시 멱등성 키
supabase/migrations/2026-05-20_bug_reports.sql           — 인앱 신고 저장
```

### 3.6 검증

- ✅ `npx tsc --noEmit` — 0 에러
- ✅ `npm run lint:alerts` — 금지 어휘 0건
- ✅ `npm run build` — 성공 (`/api/feedback/report` 라우트 등록 확인)

---

## 4. 사용자 액션 — D-6 안에 완료 필수

> 코드는 다 됐고, 외부 의존만 남았습니다. Phase A~D를 순차 진행하면 1~3시간 안에 완료 가능.

### Phase A — 도메인 + Resend (joobi.kr 결제 완료 후 30분)
1. 가비아에서 `joobi.kr` 2년 결제 완료
2. **Vercel** → `solb-portfolio` 프로젝트 → Settings → Domains → `joobi.kr` + `www.joobi.kr` add
3. **가비아 DNS**: A 레코드 `@` → `76.76.21.21` + CNAME `www` → `cname.vercel-dns.com`
4. **Resend**: resend.com Google OAuth 가입 → API Keys → Create (`joobi-prod`, Sending) → `re_xxxx` 복사
5. 가비아 DNS에 Resend SPF/DKIM TXT 레코드 추가 (Resend가 알려주는 값 그대로)
6. `EMAIL_FROM` 결정 (예: `"주비 <noreply@joobi.kr>"`)

### Phase B — Sentry (10분)
7. sentry.io Google/GitHub OAuth 가입 → Create Project → Next.js → DSN 복사 (`https://xxxx@xxxx.ingest.sentry.io/xxxx`)

### Phase C — Vercel env 입력 (5분)
> vercel.com → solb-portfolio → Settings → Environment Variables (Production + Preview + Development 모두 체크)

```
RESEND_API_KEY            = re_xxxx
EMAIL_FROM                = 주비 <noreply@joobi.kr>
NEXT_PUBLIC_SENTRY_DSN    = https://xxxx@xxxx.ingest.sentry.io/xxxx
SENTRY_DSN                = (위와 동일)
```

이번 세션에서 추가된 env (선택, 미설정 시 console.error만):
```
SLACK_WEBHOOK_CRON        = https://hooks.slack.com/.../...    (cron 실패 알림용)
SLACK_WEBHOOK_BUG         = https://hooks.slack.com/.../...    (인앱 신고 전달용)
SLACK_WEBHOOK_URL         = (위 둘 미설정 시 단일 fallback)
```

### Phase D — Supabase 마이그레이션 적용 (5분)
8. Supabase 대시보드 → SQL Editor에서 순서대로 실행:
   - `supabase/migrations/2026-05-20_notification_log.sql`
   - `supabase/migrations/2026-05-20_bug_reports.sql`

### Phase E — OAuth Redirect URLs 화이트리스트 (10분)
9. **카카오 개발자 콘솔** → Redirect URI에 `https://joobi.kr/auth/callback` 만 등록 (preview URL 제거)
10. **Supabase** → Authentication → URL Configuration → Site URL `https://joobi.kr` + Redirect URLs production만

### Phase F — 운영 채널 (15분)
11. Slack workspace 생성 + 채널 4개:
    - `#beta-bug` (인앱 신고)
    - `#beta-alert` (cron 실패)
    - `#beta-deploy` (Vercel hook)
    - `#beta-feedback` (👍/👎 다이제스트)
12. 각 채널의 Incoming Webhook URL 복사 → Vercel env 입력 (위 Phase C)
13. **카카오 오픈채팅방** 개설 — 베타 사용자 community + 1:1 인입 분산

### Phase G — Vercel Redeploy + 검증 (15분)
14. Vercel Redeploy 트리거 (env 변경 후 자동 재배포 대기 또는 수동)
15. Sentry test event 확인 (대시보드에 첫 이벤트 표시)
16. morning-brief cron 수동 트리거 → Gmail/Naver 이메일 수신 확인
17. `/help` 페이지에서 버그 신고 폼 테스트 → bug_reports 테이블 + Slack 알림 확인

---

## 5. 카나리 24h 검증 — 출시 직전

> 운영 패널 합의: 5명 24h 유지하되 **페르소나 화이트리스트 강제**. Samsung Internet·카카오 인앱브라우저 미커버는 100% 사고.

### 카나리 5명 필수 슬롯

| # | 페르소나 | 환경 | 시나리오 중점 |
|---|---|---|---|
| 1 | 다증권사 30대 (토스+키움+미래에셋) | iOS Safari | OCR 다증권사 합산 + MergedHoldings |
| 2 | 1증권사 20대 (토스만) | Android Chrome | 첫 5분 funnel + AI 촉 |
| 3 | 모바일 헤비 30대 | **Samsung Internet** | PWA 설치·푸시·뉴스탭 |
| 4 | 카카오톡 유입 20대 | **카카오 인앱브라우저** | OAuth redirect 흐름 |
| 5 | PC 데스크탑 30대 | Chrome desktop | RightSidebar·BadgeSection·responsive |

### 통과 기준 (24h 후 production 승격 결정)
- [ ] 모든 5명: 가입 → 종목 추가 → 첫 AI 촉 ≤5분 OK
- [ ] **Samsung Internet 0건 에러** (운영 패널 강조)
- [ ] 카카오 인앱브라우저 OAuth 정상 (가장 깨지는 surface)
- [ ] 푸시 1건 이상 수신 (check-alerts cron GET fix 검증)
- [ ] 모닝브리프 이메일 수신 (Resend + notification_log 검증)
- [ ] 로그아웃 후 새로고침 없이 → 종목 잔존 0건 (이전 세션 fix 검증)
- [ ] HIDDEN PICKS 카드 "성장 투자자**가** 자주 보는" 표시 확인 (조사 fix 검증)
- [ ] 인앱 신고 폼 1건 전송 → Slack 수신 (P0-18 검증)
- [ ] Sentry 빨간 이슈 0건

---

## 6. 분야 간 의견 불일치 → 합의된 결정

| 쟁점 | A 입장 | B 입장 | 합의 |
|---|---|---|---|
| **출시 일자** | 5/22(금) — KPI 측정 일찍 시작 (PM·비즈) | 5/26(월) — 주말 운영 인력 부족, DNS 전파 24h 여유 (포지셔닝·법무) | **5/26 권고**. joobi.kr 5/21 이전 완료 시 5/22~25 카나리 4일 |
| **AI 촉 한도** | 1회 유지 (PRO 다운그레이드 이탈 방지) | 가입 첫 1주 2회 (1회 부족 페르소나 보호) | **베타 1주차 데이터 후 결정**. 트리거: 첫 AI 촉 👎율 >50% 또는 D1 retention <30% 시 일시 2회 |
| **카나리 5명 24h** | 5명 24h 충분 (마케팅) | 8명 48h 또는 페르소나 보강 (QA·SRE) | **5명 24h 유지하되 페르소나 화이트리스트 강제** (위 5번 슬롯) |
| **"매수 관심" 라벨** | 가중합 점수로 결론 산출 (Quant) | 라벨만 약화 (AI/LLM) | "**관찰 후보 (긍정 우세)**"로 변경. SAFE_REPLACEMENTS에 매핑 추가 (P1) |
| **버그 신고 채널** | 카카오 오픈채팅만 충분 (마케팅) | 인앱 폼이 reproduce 정보 보장 (QA) | **둘 다**: 인앱 폼이 기본(이번 P0-18), 오픈채팅은 community |
| **다크모드 손익 색** | AA 4.5:1 + 알파블렌딩 충분 (시각) | AAA 7:1 lift 필수 (접근성) | **AA 5:1 중간값 + 좌측 보더 3px 색맹 대응** (P1) |

---

## 7. P1 — D+7 안 후속 작업

> 베타 첫 주 카나리 데이터를 보고 우선순위 재조정 권장.

### 알고리즘·법무
- [ ] **PRO survey 인앱 popup** (D+3 노출) — KPI #5 측정 시작 (비즈)
- [ ] **첫 AI 촉 wow moment 보강** — 보유 종목과 직접 연결한 reason 출력 (PM)
- [ ] **"매수 관심" → "관찰 후보 (긍정 우세)"** SAFE_REPLACEMENTS 매핑 (법무)
- [ ] **네이버 Search API fallback** — Google News KR 차단 대비 (CLIENT_ID/SECRET 발급)
- [ ] **AI 분석 JSON 파싱 실패** 멘토/일반 모드 분기 처리
- [ ] **priorityScore context 분해값**을 `ai_feedback`에 첨부 → 가중치 검증 데이터 수집
- [ ] **`composite-*` 알림 5종** cool-down 추가 (한 번 발동 후 sliding window)

### 엔지니어링
- [ ] **Supabase 1000-row 페이지네이션** — push_subscriptions·email_subscriptions 조회 (3 cron route)
- [ ] **나머지 4개 cron에 sendCronAlert 적용** (monthly-d3·chok-followup·enrich-listings·cleanup-pii)
- [ ] **14세 게이트 출생연도 입력** (셀프-체크 약점 보강) — 법무·보안
- [ ] **`pg_dump` GitHub Actions 일별 백업** 03:00 KST → S3 (운영)
- [ ] **빈 화면 사용자 통지** — ws-token 실패 시 toast
- [ ] **OAuth ws-token per-user ephemeral** — Finnhub 공유 풀 고갈 차단

### UX·디자인
- [ ] **"방금 갱신" 배지** — `newsCacheTimes` 활용 (Mossy Teal 점 + "N분 전 갱신")
- [ ] **Pull-to-refresh** (모바일)
- [ ] **SWR optimistic 탭 전환** (cache hit 시 0ms cross-fade)
- [ ] **EmptyState 컴포넌트 일관 적용** (PortfolioSection 빈 상태 인라인 → EmptyState)
- [ ] **PortfolioSection 카드 5종 축소** — Briefing / Dashboard / AI 촉 / 종목 테이블 / 트리맵
- [ ] **AI 촉 카드 메인 승급** — placeholder CTA → AiChokSection 직접 마운트
- [ ] **모바일 RightSidebar 진입점 명시** — 관심 종목 도달 경로
- [ ] **다크모드 손익 색 AA 5:1 + 좌측 보더 3px** 색맹 대응
- [ ] **이모지 SSOT 가이드** — 카테고리 5종 + 카드당 max 1개
- [ ] **카드 그라데이션 축소** — MorningBriefing 1장만, 나머지 단색 + Teal 보더
- [ ] **한국어 조사 유틸 확장** — STOCK_KR 한글 매핑 + 영문 ticker 발음 룰 (NVDA→엔비디아)

### 운영·그로스
- [ ] **events 탭 첫 진입 가이드** — 코로나/관세/지금 비교 프리셋
- [ ] **모닝브리프 옵트인 인앱 popup D+2** — 푸시 거부자 흡수
- [ ] **인스타 릴스 30초 × 3** (멘토 6명 NVDA 비교) — D+5 발주, D+12 라이브
- [ ] **약관 v3** — `solb-portfolio.vercel.app` → `joobi.kr` URL 갱신 (D+14)
- [ ] **on-call playbook** `docs/ONCALL.md` 신설 — 사고 대응 트리
- [ ] **초대 reward 실제 발급 로직** — code_uses INSERT 트리거로 `chok_bonus` 5회 즉시 부여 (viral coefficient 핵심)
- [ ] **UTM 파싱** → `api_logs.metadata` (마케팅 cohort 추적)

---

## 8. P2 — V1.2+ (베타 안정화 후)

### 진짜 moat
- [ ] **Phase B-3 세무 비서** (ISA/IRP/연금) — 토스도 못 함, 진짜 차별점
- [ ] **양도소득세 시뮬레이션** — 한국 주식 250만원 공제, 미국 22%
- [ ] **배당 캘린더** — Yahoo ex-dividend date

### 아키텍처 진화
- [ ] **Cache Components (`'use cache'`) 시장 탭 한정** — 데이터 캐시 layer
- [ ] **Server Component + Suspense streaming** 점진 마이그레이션
- [ ] **Supabase + Cron 뉴스 사전 수집** — Google News 의존 최종 제거
- [ ] **Finnhub WS token per-user ephemeral** + Edge fan-out
- [ ] **Vercel Pro 전환** — PRO 결제 페이지 출시 동시 (active CPU·invocations 80% 도달 시)

### 마케팅·바이럴
- [ ] **멘토 시연 영상 5분** (6/30 데드라인, 토스 AI 출시 방어 시그니처)
- [ ] **Affiliate 증권사 계좌개설** — 첫 매출
- [ ] **Wrapped 공유 카드** — D+7 retention 트리거

### 디자인 시스템
- [ ] **공간 시스템 토큰화** — 4의 배수 (`--space-1` ~ `--space-8`)
- [ ] **PortfolioTreemap/Heatmap/Mindmap/CirclePack 4→1** + 설정 변경 (의사결정 피로 감소)
- [ ] **PortfolioMindmap/Heatmap/CirclePack dead code 정리** — page.tsx 마운트 여부 검증
- [ ] **영문 발음 받침 룰** (l/m/n/ng 끝나는 영문 처리)

---

## 9. 출시 일자 권고 결정 트리

```
조건 1: joobi.kr 결제 5/21 이전 완료?
  YES → 5/22 카나리 시작 → 5/25까지 24h 검증 → 5/26 production
  NO  → 결제 완료 후 +5일 = 카나리 + 출시

조건 2: 카나리 24h 통과 기준 (위 5번 통과 기준 9개) 모두 OK?
  YES → 다음 평일 출시
  NO  → 실패한 항목 fix + 카나리 추가 24h

조건 3: 출시 평일 권고
  주말 출시 금지 (운영 인력 부족 + baseline 왜곡)
  → 월·화·수만 출시. 목·금은 출시 후 즉시 주말 사고 위험
```

권고: **5/26(월)** 또는 **5/27(화)**

---

## 10. 출시 후 첫 1주일 모니터링 대시보드

매일 정시 확인:

| 시점 | 대시보드 | 임계 |
|---|---|---|
| 매일 09:00 KST | Sentry — 신규 이슈 | P1 0건 / P2 < 3건 |
| 매일 09:00 | Vercel Analytics — DAU / signup | DAU > 5명 / signup 일 1~5명 |
| 매일 09:30 | `/admin/growth` funnel | D1 retention ≥ 40% |
| 매일 10:00 | Slack `#beta-bug` 신고 | 카테고리별 분류 |
| 매일 22:30 | Slack `#beta-alert` (cron) | 빨간 메시지 0건 (있으면 30분 안에 fix) |
| 주 1회 (월) | `/admin/growth` 주간 KPI | D7 ≥ 30% / AI 👍률 ≥ 60% / 가입→첫 AI 촉 ≤5분 ≥ 70% |
| 주 1회 (수) | Supabase Free 사용량 | 50% 미만 (도달 시 PRO 전환 계획) |

---

## 11. KPI 임계 (베타 1개월)

| 지표 | 임계 | 측정 채널 |
|---|---|---|
| D7 retention | ≥ 30% | `/admin/growth` |
| 가입 → 첫 AI 촉 | ≤ 5분, ≥ 70% | onboarding_complete 이벤트 + 첫 ai-chok 호출 delta |
| WAU/MAU | ≥ 0.5 | Vercel Analytics |
| AI 촉 👍률 | ≥ 60% | `ai_feedback.satisfaction` |
| PRO survey 의향률 | ≥ 25% | 인앱 popup (P1) |

**PRO 출시 트리거** (동시 충족 시): 가입 1500+ AND D7 30%+ AND PRO survey 15%+ AND affiliate 1건+

---

## 부록 A — 사용자 액션 체크리스트 (인쇄용)

```
□ 가비아 joobi.kr 2년 결제 완료
□ Vercel Add Domain: joobi.kr + www.joobi.kr
□ 가비아 DNS: A 76.76.21.21 + CNAME www
□ HTTPS 자동 발급 확인 (https://joobi.kr 접속)
□ Resend 가입 + API Key 생성
□ 가비아 DNS에 Resend SPF/DKIM TXT 추가
□ Sentry 가입 + Next.js 프로젝트 + DSN 복사
□ Vercel env 4종 입력 (RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN)
□ Supabase SQL Editor에 마이그 적용:
   □ 2026-05-20_notification_log.sql
   □ 2026-05-20_bug_reports.sql
□ 카카오 콘솔 Redirect URI: joobi.kr만 화이트리스트
□ Supabase Auth Redirect URLs: production만
□ Slack workspace + 채널 4개 + webhook URL
□ Vercel env 추가 (선택): SLACK_WEBHOOK_CRON, SLACK_WEBHOOK_BUG
□ 카카오 오픈채팅방 개설 + URL 확보
□ Vercel Redeploy 트리거
□ Sentry test event 수신 확인
□ morning-brief 수동 트리거 → Gmail 수신 확인
□ /help 페이지에서 버그 신고 폼 1건 → Slack 수신 확인
□ 카나리 5명 24h 검증 (위 5번 통과 기준 9개)
□ Production 승격
```

---

## 부록 B — 검증 명령어

```bash
# 타입 체크
npx tsc --noEmit

# 알림 컴플라이언스 lint
npm run lint:alerts

# 빌드 (prebuild = lint:alerts 자동 실행)
npm run build

# 변경 영역 git diff
git diff --stat

# 새 파일 4건 확인
git status --short
```

---

## 부록 C — 참조 SSOT 문서

- `docs/NOTIFICATION_POLICY.md` — 알림 정책 §3.1 종목당 24h 3개 cap (P0-10에서 코드화)
- `docs/THRESHOLDS.md` — 알고리즘 임계값
- `docs/ALGORITHMS.md` / `docs/ALGORITHM_REVIEW.md` — 알고리즘 인벤토리
- `docs/BETA_LAUNCH_REVIEW.md` — 베타 출시 사전 검토 (이전 세션)
- `docs/BETA_SMOKE_CHECKLIST.md` — 카나리 스모크 (D-6 갱신 권고)
- `docs/CRONS.md` — Cron 7개 정책
- `docs/UNIVERSE_INCLUSION_CRITERIA.md` — Universe 편입 객관 기준
- `docs/BROKER_FEATURE.md` / `BROKER_MERGE_FEATURE.md` — 증권사 통합
- `sessionary/TODO.md` — 세션 간 누적 TODO
- `sessionary/2026-05-19-*.md` — 직전 세션 (뉴스탭 P0 + 로그아웃 race)

---

**마지막 업데이트**: 2026-05-20 (출시 D-6)
**다음 검토 권고**: 카나리 24h 통과 직후 + 출시 D+7 + 출시 D+30
