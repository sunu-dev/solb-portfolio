# SOLB Portfolio (주비) — 전체 코드베이스 분석 보고서

> **작성일**: 2026-05-06
> **분석 범위**: src/ 전체 (179 TS/TSX 파일, ~22k 컴포넌트 라인 + 도메인 로직 포함 ≈ 30k+ 라인)
> **방식**: 6 영역 병렬 탐색 (앱·라우트 / 상태·훅 / 유틸·설정 / 컴포넌트 / DB / AI·외부) 후 종합
> **목적**: 신규 기여자/미래의 자신을 위한 1-stop 아키텍처 핸드북

---

## 0. Executive Summary

**주비**는 한국 개인 투자자를 위한 *AI 비서* PWA로, "감정 중심 투자 행동을 데이터 거울로 비춰주는 도구"를 슬로건으로 한다. 핵심 차별점은 다음과 같다:

1. **자본시장법 회피 설계** — 매수 권유/추천 단어 자동 감시(`alertCompliance`), AI 촉은 "관찰 후보" 톤으로만 출력. PRO 도구 잠금만, AI 촉은 영구 무료 (유사투자자문업 신고 회피).
2. **다중 AI Provider Failover** — Gemini primary (키 2개 로테이션) → Claude Haiku 4.5 fallback (일일 500회 비용 가드, 5분 prompt cache).
3. **이중 데이터 소스** — 시세는 Finnhub(미국) + Yahoo Finance(한국·fallback) + Naver/CNN. 158종 universe (US 58 + KR 100).
4. **이벤트 기반 알림 SSOT** — 25개 트리거 → 단일 정책 맵(`alertPolicy.ts`) → push/toast/inapp/email 채널 라우팅. 신규 유저 7일 ramp-up.
5. **월간 챕터 시즌제** — Spotify Wrapped 패러다임. P1~P4 신선도 엔진으로 매일 다른 카피, 30일 단위 회고/책장 보존.
6. **포트폴리오 시각화 레이어 4종 보존** — 현재 메인은 토스 톤 트리맵, 대체 후보(Heatmap·CirclePack·Mindmap)는 revertable 상태로 유지.

기술 스택: **Next.js 16 (App Router)** + **React 19** + **Zustand 5** + **Tailwind 4 + shadcn** + **Supabase** + **Vercel Fluid Compute**.

---

## 1. 프로젝트 메타

### 1.1 패키지 (package.json)

| 카테고리 | 패키지 | 용도 |
|---|---|---|
| 프레임워크 | `next@16.2.1`, `react@19.2.4` | App Router, Server Components |
| 상태 | `zustand@5.0.12` | persist 미들웨어 단일 스토어 |
| AI | `@google/genai@1.46`, `@anthropic-ai/sdk@0.90` | Gemini primary + Claude fallback |
| DB/Auth | `@supabase/supabase-js@2.99` | RLS 기반 멀티테넌트 |
| 시각화 | `lightweight-charts@5.1`, `d3-hierarchy@3.1` | 캔들 차트 + Treemap/CirclePack |
| 푸시 | `web-push@3.6` (+ `@types/web-push`) | VAPID 기반 Web Push |
| 메일 | `resend@6.10` | 무료 월 3천건 |
| 큐 | `@upstash/qstash@2.10` | (옵션, cron 외 큐 작업) |
| UI | `@base-ui/react@1.3`, `shadcn@4.1`, `lucide-react@0.577`, `tw-animate-css` | 디자인 시스템 |
| 캡처 | `html-to-image@1.11` | 공유 카드 PNG 생성 |
| Testing | `vitest@4.1`, `@vitejs/plugin-react@6.0` | 단위 테스트 |

**Scripts**:
- `prebuild` → `npm run lint:alerts` (커스텀 컴플라이언스 린터, `scripts/lint-alerts.mjs`)
- 빌드 시 자동으로 알림 메시지의 금지 표현(`사세요`, `추천` 등) 검사

### 1.2 환경 변수 (요약)

| 카테고리 | 변수 |
|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` |
| AI | `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, `ANTHROPIC_API_KEY`, `ENABLE_CLAUDE_FALLBACK`, `CLAUDE_DAILY_LIMIT` |
| 시세 | `FINNHUB_API_KEY`, `NEXT_PUBLIC_FINNHUB_API_KEY` |
| Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_UNSUB_SECRET` |
| 보안 | `CRON_SECRET`, `SLACK_WEBHOOK_URL` |
| 한도 | `AI_DAILY_LIMIT_GUEST=3`, `AI_DAILY_LIMIT_USER=10`, `AI_DAILY_LIMIT_TOTAL=250` |
| 배포 | `NEXT_PUBLIC_APP_URL` |

### 1.3 Vercel Cron (vercel.json)

```json
{
  "crons": [
    { "path": "/api/cron/morning-brief",         "schedule": "0 22 * * *" },
    { "path": "/api/cron/cleanup-pii",           "schedule": "0 19 * * 6" },
    { "path": "/api/cron/monthly-d3-reminder",   "schedule": "0 11 * * *" },
    { "path": "/api/cron/chok-followup",         "schedule": "30 17 * * *" }
  ]
}
```

> `check-alerts` cron은 vercel.json에 등록되지 않음 — 별도 외부 스케줄러 또는 수동 호출 가정.

---

## 2. 디렉토리 구조 (src/)

```
src/
├── app/                  # Next.js App Router
│   ├── page.tsx          # 메인 대시보드 (283줄)
│   ├── layout.tsx        # 루트 레이아웃 + PWA 메타 + 카카오 SDK
│   ├── globals.css       # 디자인 토큰, 다크모드, Pretendard (688줄)
│   ├── error.tsx, global-error.tsx
│   ├── landing/          # 랜딩 (162줄)
│   ├── privacy/          # 개인정보처리방침
│   ├── terms/            # 이용약관 (제2조 자본시장법 명시 X, 제7조 AI 면책)
│   ├── admin/            # 관리자 대시보드 (779줄)
│   │   └── chok-debug/   # AI 촉 데이터 진단 (224줄)
│   └── api/              # 서버 라우트 (총 ~30개)
│       ├── ai-analysis/        # 6관점 멘토 분석 (404줄)
│       ├── ai-chok/            # AI 촉 옵션 2 (330줄)
│       ├── candle/             # 1년 일봉 (Yahoo)
│       ├── codes/              # 초대/추천 (validate, generate, my-invite)
│       ├── cron/               # 5개 cron 작업
│       ├── email/              # morning-brief, monthly-d3, unsubscribe
│       ├── event-candles/      # 이벤트 기간 종가
│       ├── fear-greed/         # CNN F&G index
│       ├── fundamentals/       # PER/EPS/시총
│       ├── kr-quote/           # 한국 주식 시세
│       ├── market-movers/      # 158 universe top movers (캐시 10분)
│       ├── news/               # Google News RSS
│       ├── og/                 # 동적 OG 이미지 (Edge runtime)
│       ├── portfolio/ocr/      # Gemini Vision 보유종목 OCR (242줄)
│       ├── push/               # VAPID 키 + 구독
│       ├── quotes/             # 미국 주식 배치
│       ├── search/             # Finnhub 종목 검색
│       ├── ws-token/           # Finnhub WebSocket 토큰
│       ├── account/delete/     # 계정 삭제
│       ├── config/             # 전역 설정 (service_mode 등)
│       └── admin/              # 관리자 전용 (api-stats, growth, chok-debug)
│
├── components/           # 61개 컴포넌트 / 22,263줄 / 11개 디렉토리
│   ├── portfolio/        # 33개 (1.2만 줄)
│   ├── analysis/         # 3개 (AnalysisPanel 1392줄)
│   ├── layout/           # 8개
│   ├── common/           # 12개 (SettingsPanel 677줄)
│   ├── auth/             # 3개
│   ├── insights/         # 3개
│   ├── events/           # 1개 (EventsSection 778줄)
│   ├── news/             # 1개
│   ├── onboarding/       # 1개
│   ├── admin/            # 1개
│   └── ui/               # shadcn 베이스
│
├── store/                # Zustand 단일 스토어
│   └── portfolioStore.ts # 533줄, persist 화이트리스트
│
├── hooks/                # 6개 커스텀 훅
│   ├── useAuth.ts              # Supabase OAuth, 계정 전환 감지
│   ├── useNotification.ts      # Web Push 구독
│   ├── useActiveAlerts.ts      # 필터링 + suppress + snooze
│   ├── usePortfolioSync.ts     # localStorage ↔ DB 동기화
│   ├── useRealtimePrice.ts     # Finnhub WebSocket (US 50종 한도)
│   └── useStockData.ts         # 시세/캔들/뉴스/매크로 통합 (518줄)
│
├── lib/                  # 인프라 (10개, 875줄)
│   ├── aiProvider.ts           # Gemini ↔ Claude 추상화
│   ├── circuitBreaker.ts       # AI 회로 차단 (aiStrict 5분/50%/60s)
│   ├── rateLimiter.ts          # sliding window (Supabase 기반)
│   ├── apiLogger.ts, errorLogger.ts, serverLogger.ts
│   ├── portfolioSync.ts        # DB upsert helper
│   ├── userStorage.ts          # localStorage 키 정리
│   ├── supabase.ts             # 클라이언트 싱글톤
│   └── utils.ts                # cn() (clsx + twMerge)
│
├── utils/                # 도메인 로직 (28개, 4,483줄)
│   ├── alertsEngine.ts         # 20개 경고 규칙 (488줄)
│   ├── alertCompliance.ts      # 자본시장법 금지어 검사 (12개 phrase)
│   ├── alertGlossary, alertLearning, alertPrefs, alertSnooze, alertSuppress, alertWeighting
│   ├── monthlyChapter.ts       # 30일 시즌 + P1~P4 신선도 (354줄)
│   ├── chapterArchive.ts       # 지난달 챕터 (170줄)
│   ├── dailySnapshot.ts        # 일별 스냅샷 prune (96줄)
│   ├── badgeChecker.ts         # 13개 배지 해금
│   ├── chokDataEnricher.ts     # Finnhub 객관 수치 강제 주입 (228줄)
│   ├── portfolioHealth.ts      # 4축 점수 (HHI/섹터/목표/손익) (227줄)
│   ├── portfolioDNA.ts         # 7가지 캐릭터 분류 (155줄)
│   ├── mentorScores.ts         # 6 멘토 호환도
│   ├── priorityScore.ts        # 보유 종목 신호 우선순위 (z-score)
│   ├── investorBehavior.ts     # 행동 추론
│   ├── technical.ts            # SMA/EMA/RSI/BB/MACD (516줄)
│   ├── volatility.ts           # 30일 baseline + Z-score
│   ├── timeSeries.ts           # 추세 라벨, MA 위치
│   ├── marketStatus, marketHours
│   ├── email.ts, emailTemplates.ts # Resend + RFC 8058 unsubscribe
│   ├── formatKRW.ts, noteId.ts, pwa.ts, unsubscribeToken.ts
│
├── config/               # 설정 SSOT (12개, 2,260줄)
│   ├── alertPolicy.ts          # 25개 조건 → 채널/카테고리 정책
│   ├── analysisPrompt.ts       # 4 레이어 AI 프롬프트 (394줄)
│   ├── constants.ts            # 타입, 매크로 지표, PRESET_EVENTS (381줄)
│   ├── chokUniverse.ts         # US 58종 큐레이션
│   ├── koreanUniverse.ts       # KR 100종 (KOSPI 70 + KOSDAQ 30, 시총 기반)
│   ├── investorTypes.ts        # 5가지 유형 (266줄)
│   ├── mentors.ts              # 6명 멘토 페르소나 (258줄)
│   ├── badges.ts               # 13개 배지 정의
│   ├── designTokens.ts         # CSS 변수, 색상
│   ├── greetings.ts, dailyTerms.ts, indicatorLabels.ts
│   └── marketHolidays.ts       # 2026 미국 휴장일
│
├── styles/               # (보조)
└── __tests__/            # vitest
```

---

## 3. 페이지 라우트 & 메타

| 경로 | 파일 | 라인 | 역할 |
|---|---|---|---|
| `/` | `app/page.tsx` | 283 | 메인 대시보드 — 4 섹션 탭 + 실시간 시세 + 알림 + 모바일 시트 |
| `/landing` | `app/landing/page.tsx` | 162 | 비로그인 게이트 |
| `/privacy` | `app/privacy/page.tsx` | 126 | 개인정보처리방침 |
| `/terms` | `app/terms/page.tsx` | 119 | 이용약관 (시행일 2026-04-28) |
| `/admin` | `app/admin/page.tsx` | 779 | API 통계 + Gemini 키 쿼터 + 성장 추적 |
| `/admin/chok-debug` | `app/admin/chok-debug/page.tsx` | 224 | AI 촉 데이터 진단 — PER/52w 필드 채움률, 섹터 분포, TOP5 |

**`layout.tsx`**: Pretendard 폰트, `theme-color: #3182F6` (주비 브랜드), iOS PWA 메타, 카카오 SDK 2.7.4 동적 로드, ServiceWorker 등록(`/sw.js`).

**`globals.css`** (688줄): Tailwind 4 + shadcn + 한국 관례 색상 (빨강 = 상승, 파랑 = 하락), 다크모드 완전 지원, 8가지 애니메이션 (fadeInUp, ticker-scroll, priceFlashUp/Down, shimmer 등).

---

## 4. API 라우트 인벤토리

### 4.1 시세 데이터 (Finnhub + Yahoo + CNN)

| 경로 | 메서드 | 외부 API | 캐시 헤더 | 비고 |
|---|---|---|---|---|
| `/api/quotes` | POST | Finnhub → Yahoo fallback | `s-maxage=15, swr=30` | 배치 (`{symbols, macro}`) |
| `/api/kr-quote` | GET/POST | Yahoo (`.KS/.KQ`) | — | 한국 종목 단일 + 검색 |
| `/api/candle` | GET | Yahoo Chart | (default) | 1년 일봉 |
| `/api/event-candles` | POST | Yahoo 배치 | 과거 `s-maxage=86400`, 현재 `900` | 이벤트 기간별 |
| `/api/fundamentals` | GET | Yahoo quoteSummary | `s-maxage=3600, swr=7200` | PER/EPS/52주/섹터 |
| `/api/search` | GET | Finnhub `/search` | `s-maxage=60, swr=120` | 8개 limit |
| `/api/market-movers` | GET | Finnhub `/quote` 158종 | in-memory 10분 | 거래량 floor → pump 차단 |
| `/api/fear-greed` | GET | CNN dataviz | `s-maxage=1800, swr=3600` | KR 라벨 변환 |
| `/api/ws-token` | GET | — | — | Finnhub WS 키 (8줄) |

### 4.2 AI 라우트

| 경로 | 메서드 | 라인 | Provider | Temp | maxTokens | Rate limit |
|---|---|---|---|---|---|---|
| `/api/ai-analysis` | POST | 404 | Gemini → Claude | 0.3 | — | 게스트 3/일, 유저 10/일, 전체 250/일 |
| `/api/ai-chok` | POST | 330 | Gemini → Claude | **0.4** | 2048 | 게스트 1/일, 유저 3/세션 |
| `/api/portfolio/ocr` | POST | 242 | Gemini Vision | **0.1** | — | 게스트 1/h, 유저 5/h |

### 4.3 인증·코드·계정

| 경로 | 권한 | 기능 |
|---|---|---|
| `/api/codes/generate` | 관리자 | invite/referral 코드 발행 |
| `/api/codes/validate` | 공개 | 코드 검증 + reward 지급 |
| `/api/codes/my-invite` | 로그인 | 내 초대 코드 + 사용 이력 (founder 무제한) |
| `/api/account/delete` | Bearer 토큰 | 본인 데이터 삭제 |
| `/api/config` | GET 공개 / POST 관리자 | service_mode, ai_daily_limit 등 |

### 4.4 푸시·이메일

| 경로 | 기능 |
|---|---|
| `/api/push/subscribe` | POST/DELETE — 구독 등록 (web-push lib) |
| `/api/push/vapid-key` | 공개키 GET |
| `/api/email/morning-brief` | 모닝 브리프 토글 |
| `/api/email/monthly-d3` | 월말 D-3 토글 |
| `/api/email/unsubscribe` | RFC 8058 1-click (HMAC stateless) |

### 4.5 Cron (Vercel Cron)

| 경로 | 스케줄 (UTC) | KST | 라인 | 동작 |
|---|---|---|---|---|
| `morning-brief` | `0 22 * * *` | 매일 7am | 366 | 어제 vs 오늘 자산 변화 푸시 + Resend fallback |
| `cleanup-pii` | `0 19 * * 6` | 일요일 4am | 117 | IP 익명화 (90일/30일), 365일+ hard delete |
| `monthly-d3-reminder` | `0 11 * * *` | 매일 8pm | 242 | 월말 D-3만 챕터 마감 리마인더 |
| `chok-followup` | `30 17 * * *` | 매일 02:30 | 161 | 30/90일 도달 추천에 가격 fill-in (Finnhub) |
| `check-alerts` | (수동) | — | 302 | sent_alerts dedup + ramp-up 게이트 |

### 4.6 관리자 전용

- `/api/admin/api-stats?hours=24` — 최근 호출, 에러율, 지연
- `/api/admin/growth?days=14` — 가입/활성/AI 사용량
- `/api/admin/chok-debug` — 추천 데이터 진단

---

## 5. 데이터베이스 (Supabase)

### 5.1 핵심 테이블

| 테이블 | 용도 | RLS | 주요 컬럼 |
|---|---|---|---|
| `user_portfolios` | 포트폴리오 메인 | 본인만 | `user_id` PK, `stocks` JSONB, `daily_snapshots` JSONB, `invited_by_code`, `referral_code`, `user_tier` |
| `push_subscriptions` | Web Push | 본인만 | `user_id` PK, `subscription` JSONB, `created_at` (ramp-up 기준) |
| `email_subscriptions` | 이메일 옵트인 | 본인만 | `user_id` PK, `morning_brief_enabled`, `monthly_d3_enabled` |
| `alert_log` | 알림 송신 기록 (1년 보관) | 본인 read | `id`, `sent_at`, `category`, `channel`, `delivery_status`, `error_message` |
| `sent_alerts` | dedup | service만 | `(user_id, symbol, alert_type, sent_date)` 복합 PK |
| `ai_chok_recommendations` | 추천 백테스트 | 본인 read | `recommended_at`, `vix_bucket`, `pe_ratio`, `week52_position`, `price_after_30d/90d`, `return_30d/90d`, `filled_30d_at/90d_at` |
| `ai_chok_cache` | AI 촉 일일 캐시 | service만 | `(user_key, date)` PK, `picks` JSONB, `use_count` |
| `codes` | 초대/추천/할인/프로모 통합 | active read | `code` UNIQUE, `type`, `max_uses`, `rewards` JSONB |
| `code_uses` | 사용 이력 | 본인 + service | `code_id`, `used_by`, `context`, `reward_granted` |
| `user_credits` | AI 크레딧 (보상) | 본인 read | `amount`, `used_amount`, `source`, `expires_at` |
| `app_config` | 전역 설정 | read 공개 | `key` PK (service_mode 등) |
| `api_calls` | 레이트 리밋 + 회로 차단 | anon insert | `endpoint`, `user_key`, `status`, `latency_ms`, `error_code` |
| `ai_usage` | AI 호출 카운트 | service만 | `(date, user_id, mentor_id)` |
| `gemini_key_usage` | 키별 쿼터 추적 | service만 | `key_index`, `date` |
| `config_audit_log` | app_config 변경 이력 | service만 | — |

### 5.2 마이그레이션 (`supabase/migrations/`)

| 파일 | 상태 |
|---|---|
| `2026-04-28_ai_chok_recommendations.sql` | ✅ 적용 |
| `2026-05-02_alert_log.sql` | 🔴 **사용자 액션 필요** (Supabase 콘솔) |
| `2026-05-02_email_subscriptions.sql` | 🔴 **사용자 액션 필요** |
| `2026-05-02_email_subscriptions_monthly_d3.sql` | 🔴 **사용자 액션 필요** |
| `2026-05-02_push_subscriptions_created_at.sql` | 🔴 **사용자 액션 필요** (ramp-up 기준) |

> 4건이 적용되지 않으면 모닝 브리프 이메일 fallback, D-3 리마인더, 신규 유저 7일 ramp-up 정책이 동작하지 않음.

### 5.3 자동 정리 정책

- **alert_log**: 1년 (cleanup-pii cron 통합)
- **api_calls**: 30일
- **PII 익명화**: 90일 (IP NULL), 365일 hard DELETE (`cleanup-pii`)

---

## 6. 클라이언트 상태 아키텍처

### 6.1 Zustand 단일 스토어 (`store/portfolioStore.ts`, 533줄)

**Persist 화이트리스트** (`partialize`):
```ts
stocks, currency, darkMode, apiKey, autoRefresh, refreshInterval,
customEvents, dailySnapshots, investorType, investorTypeSetAt
// 의도적 제외: macroData, candleCache, rawCandles, eventCache, newsCache, alerts
//             → 휘발성 캐시 (basePrices 변경 시 자동 재계산)
```

**핵심 설계 결정**:

1. **Quota Exceeded 우아한 처리** (line 453-491):
   - 1차: `solb_quote_cache`, `solb_macro_cache` 삭제 후 재시도
   - 2차: `dailySnapshots` 절반 trim 후 재시도
   - 최악: console.error → silent fail

2. **버전 마이그레이션** (line 500-514):
   - `version: 1`, 구 카테고리(short/long/watch) → 신 카테고리(investing/watching/sold) 자동 변환

3. **포트폴리오 자동 분류** (line 282-292):
   - `avgCost > 0 && shares > 0` → investing, 그 외 → watching

4. **알림 학습 통합**:
   - `dismissAlert/dismissAllAlerts` → `recordDismissal()` 호출 → 학습 저장
   - `lastDismissBatch` (비영속) → Undo 토스트용

### 6.2 커스텀 훅 6개

| 훅 | 라인 | 역할 |
|---|---|---|
| `useAuth` | 78 | Google/Kakao OAuth, **계정 전환 감지** (`prevUserIdRef` → `clearUserStorage()` + `resetPortfolio()`) |
| `useNotification` | 151 | SW 등록, VAPID 구독, `severity ≤ 2` 새 알림만 로컬 Notification |
| `useActiveAlerts` | 65 | dismiss + snooze + suppress 필터 + `sortWithSessionWeight` (장 외엔 가격 알림 뒤로) + 5분 폴링 |
| `usePortfolioSync` | 105 | DB 로드 → setStocksFromDB, 변경 시 디바운스 2s → upsert. **beforeunload/visibilitychange flush** (M4-data 결함 수정) |
| `useRealtimePrice` | 104 | Finnhub WS, 50종 한도, US만 (`.KS/.KQ` 제외), 지수 백오프 5회 |
| `useStockData` | 518 | refreshAll = quotes(10s) + alerts(빠른 pass) + candles(백그라운드, 배치 3개씩 100ms 간격) + news(15min) + USD/KRW(10min). **2단 알림** (시세→캔들 후 재실행) |

### 6.3 캐시 레이어 3층

```
Zustand (메모리)
  ├─ persistedData: stocks, dailySnapshots, investorType
  └─ volatileData: candleCache, rawCandles, newsCache, eventCache, alerts

localStorage (영속)
  ├─ solb-portfolio-storage      # Zustand 자동
  ├─ solb_quote_cache            # 5분 SWR
  ├─ solb_macro_cache
  └─ candle_{symbol}             # 일일, date 기반

Supabase (서버)
  └─ user_portfolios (디바운스 2초 + flush 보장)
```

---

## 7. 컴포넌트 인벤토리 (61개, 22,263줄)

### 7.1 고복잡도 (300줄+, 6개)

| 컴포넌트 | 라인 | 역할 |
|---|---|---|
| `AnalysisPanel` | 1,392 | 메인 종목 분석 — 기술 지표 계산 + 트렌드/패턴 + 한글 뉴스 + AI 리포트(5단계 진행바) + Mentor Radar |
| `PortfolioSection` | 1,221 | 포트폴리오 메인 — 4 탭 + 5 정렬 + 기간별 수익률 + 빠른추가 + 뷰 토글 |
| `PortfolioHeatmap` | 992 | 다크 Finviz 스타일 (보존) — 2단 squarify, HTML overlay, 직각, 고정 폰트 |
| `PortfolioCirclePack` | 850 | D3 hierarchy.pack (보존) — fly-in 모션, 도넛 토글 |
| `PortfolioTreemap` | 824 | **현재 메인** — 토스 vivid 톤, 라이트 #FAFBFC, 라디우스 14px, squarify deterministic, 4:3 비율 |
| `PortfolioMindmap` | 727 | 옵시디언 스타일 (보존) — 곡선 연결, 도트 그리드 |

### 7.2 디자인 결정 디테일

**PortfolioTreemap (현재)**:
- 배경: 라이트 `#FAFBFC`, 색상: vivid (`#FF6B6B ~ #2858E5`), 강한 셀(|pct|≥3%) 흰 텍스트
- maxWidth: compact 720 / full 960
- Top-N: compact 8 / full 16 + "소액N종" 그룹화
- 색 모드 토글: 손익률(pnl) / 오늘변동률(today)

**AiChokSection** (456줄):
- 두 알고리즘 컨텍스트 동시 주입:
  1. `computeHoldingPriorities()` (priorityScore.ts) → z-score로 보유 종목 핵심 신호 추출
  2. `buildMacroContext()` + `buildSectorConcentration()` → VIX/S&P/NASDAQ + 상위 4섹터 비중
- 카드: 아바타 + 심볼/한글 + 이유 문단 + 키메트릭 칩 + "분석보기/둘러보기" 버튼
- "AI의 관찰 후보" 라벨 (자본시장법 회피)

**BuySimulator** (284줄):
- 시장별 분수주 정책: KR=정수주, US=0.001주
- 통화 분리: `priceCurrency` (종목 표시) ↔ `inputCurrency` (사용자 입력) ↔ `currency` (결과 표시)
- 환율 변환: 입력 ≠ 가격 단위 시 1회만
- **수수료/세금 노출 X** → 디스클레이머 1줄 (브로커 오해 방지)
- 톤: "샀다면" 가정형 (권유 회피)

### 7.3 도메인 특수 컴포넌트

| 컴포넌트 | 라인 | 핵심 |
|---|---|---|
| `ConversationalTimeline` | 441 | 숫자→이야기 변환 (급락 종목, 목표 근접, 52주, 30일 추세) |
| `ThrowbackCard` | 524 | "과거의 나" 6 탭 (어제~1년전) — 현재 수량 × 과거 종가 retrospective |
| `TradePatternMirror` | 528 | 감정 태그(🤔분석 vs 😤충동) 별 성과 거울 |
| `MonthlyReplay` | 530 | 월간 회고 + 카카오톡 공유 |
| `MonthlyWrapped` | 382 | Spotify Wrapped 스타일 7 슬라이드 |
| `MorningBriefing` | 411 | 하루 첫 방문 자동 펼침 — 어제 vs 오늘 + 알림 Top2 + 최근 메모 |
| `OcrImportModal` | 538 | 스크린샷 → Gemini Vision → 종목 자동 추출 |
| `EventsSection` | 778 | 지정학 이벤트 (이란 전쟁 등) 기반 포트폴리오 회고 |

---

## 8. 도메인 로직 핵심

### 8.1 알림 엔진 (`alertsEngine.ts`, 488줄)

**20가지 경고 카테고리**:
```
가격: stoploss-hit/near, target-hit/near, below-avgcost, buy-zone, daily-surge/plunge
52주: near-52w-low/high
기술: golden-cross, death-cross, rsi-oversold/overbought, bb-lower/upper, macd-bull/bear
변동성: zscore-extreme (|z| ≥ 2.5)
포트폴리오: portfolio-down (-10%)
복합: 5가지 신호 결합
목표: target-return, target-profit-USD/KRW
```

**Z-score 적응형** (`volatility.ts`):
- 30일 일일 수익률 std 기준
- 안정주 (KO σ=1%): 1% 변동 = 1σ
- 변동주 (TSLA σ=4%): 3% 변동 = 0.75σ (노이즈)
- 25개 상한, severity 1~5 정렬

### 8.2 알림 정책 SSOT (`config/alertPolicy.ts`, 124줄)

```ts
ALERT_POLICY: Record<25개 condition, {
  channels: ('push' | 'toast' | 'inapp' | 'email')[],
  category: 'price' | 'indicator' | 'market' | 'portfolio' | 'celebrate' | 'digest',
  rampUpExempt?: boolean
}>
```

| 채널 그룹 | 조건 |
|---|---|
| **Push 허용** | stoploss-hit/pct, target-hit, target-return, buy-zone, portfolio-down, daily-plunge |
| **Toast + Inapp** | stoploss-near, target-near, daily-surge, zscore, composite |
| **Inapp 전용** | 52주, 골든/데드크로스, RSI, BB, MACD (자문업 회피) |
| **기본 (unmapped)** | Inapp만 (안전 디폴트) |

**Ramp-up**: `PUSH_RAMP_UP_DAYS = 7` — 신규 유저 7일간은 stoploss-hit/pct + portfolio-down만 push (`push_subscriptions.created_at` 기준).

### 8.3 컴플라이언스 (`alertCompliance.ts`)

**FORBIDDEN_PHRASES** (12개):
- "사세요", "매수하세요", "매도하세요"
- "추천합니다", "반드시"
- "수익을 보장", "확실히 오릅니다"
- "지금이 기회", "놓치지 마세요"
- "70% 확률로 반등" (근거 없는 확률)

**허용 표현**: "~일 수 있어요", "~를 고려해볼 수 있어요", "제공된 데이터 기준", "이 관점에서 보면 ~해 보여요"

**검사 시점**: 빌드 시 `prebuild` → `npm run lint:alerts` (`scripts/lint-alerts.mjs`).

### 8.4 월간 챕터 (`monthlyChapter.ts`, 354줄)

**Phase 구분**:
- `progress`: 1~25일 (진행 중, 신선도 강조)
- `closing`: 26~말일 (마감 단계, 결산)

**P1~P4 신선도 엔진** (TodayLine):
- **P1 (희소·강력)**: 누적 손익 임계 돌파, 챔피언 +5%, 베스트 데이
- **P2 (행동 기반)**: 메모 streak ≥ 3일
- **P3 (패턴 인식)**: 50% 진행, 마지막 일주일, 어제 대비 ±0.3%
- **P4 (Fallback)**: 30일 전 오늘 비교 — 항상 존재

**같은 데이터, 다른 프레임**:
- 단순: "5월 22일, 누적 +8.2%"
- 재프레이밍: "30일 전 +3% → 지금 +8.2%: +5.2%p 상승"

### 8.5 포트폴리오 건강도 (`portfolioHealth.ts`, 4축 100점)

| 축 | 가중 | 측정 |
|---|---|---|
| **HHI 집중도** | 30점 | Σ(w_i)² — 0~0.18 만점, 0.40+ 0점, Effective N 표시 |
| **섹터 분산** | 25점 | 1/Σ(w_sector)² — ≥4 만점 |
| **목표 설정** | 25점 | 설정율×15 + 달성율×10 (목표만 vs 실제 달성 구분) |
| **손익 밸런스** | 20점 | 승률×12 + W/L Ratio×8 (Profit Factor) |

### 8.6 포트폴리오 DNA (`portfolioDNA.ts`, 7가지 캐릭터)

| 캐릭터 | 조건 |
|---|---|
| 🎯 저격수 | concentration > 60 && volatility > 40 |
| 🏴 외골수 | concentration > 60 |
| ⚡ 스프린터 | growth > 70% |
| 🛡️ 수비수 | defense > 50% |
| ⚖️ 균형가 | growth 30~70 && defense 20~40 |
| 🎢 모험가 | volatility > 50% |
| 🌱 새싹 | default |

### 8.7 AI 분석 프롬프트 (`analysisPrompt.ts`, 4 레이어, 394줄)

```
LAYER 0: 사용자 투자 유형 (value/growth/income/momentum/diversified)
LAYER 1: 분석 시퀀스 6단계 + 지표 충돌 규칙 + 종목 유형(개별주/ETF/한국주식 등)
       + 법적 표현 규칙 + 52주 맥락 + PER/EPS 해석
       + conclusion.desc 3요소 (현황 + 사용자 연결 + 조건부 방향)
LAYER 2-멘토: 페르소나 유지 + P&L 상황별 반응 + 종목 유형별 반응
LAYER 2-한국주식: 원화 표기 + 거래소 맥락 + 환율 영향 + 정책 민감도
LAYER 2-섹터: 밸류에이션 기준 (Tech PER 25~50, Financial 10~15)
LAYER 2-신뢰도: 데이터 충분도에 따른 표현 강도

CHOK_SYSTEM_PROMPT (촉 서비스):
- 위 표의 객관 수치만 인용 (hallucination 차단)
- 3개 종목, 서로 다른 섹터
- 기존 포트폴리오 제외
- "촉이 왔어요" 표현만 (추천 금지)
```

---

## 9. AI/외부 통합 레이어

### 9.1 AI Provider 추상화 (`lib/aiProvider.ts`, 285줄)

```
callAiJson(opts)
  ├─ callGemini(opts) [primary]
  │   ├─ GEMINI_KEYS 무작위 순서 시도 (key1, key2)
  │   ├─ Quota error → 즉시 Claude로
  │   └─ 기타 → 다음 키
  └─ callClaude(opts) [fallback]
      ├─ 일일 한도 가드 (CLAUDE_DAILY_LIMIT=500, ~$2.5/일)
      ├─ Haiku 4.5 (빠름·저렴·JSON 안정)
      └─ Prompt Caching: cache_control: ephemeral (5분 TTL, ~90% 절감)
```

### 9.2 AI 분석 (`/api/ai-analysis`, 404줄)

| 항목 | 값 |
|---|---|
| 모델 | Gemini 2.5-flash (→ flash-lite fallback) |
| Temp | 0.3 |
| 응답 | `application/json` (Gemini), 시스템 강제 (Claude) |
| 입력 필드 | 25+ (price/지표/뉴스/avgCost/투자유형/메모 등) |
| 멘토 | 6명 (각각 다른 시스템 프롬프트) |

### 9.3 AI 촉 옵션 2 (`/api/ai-chok`, 330줄)

**8단계 파이프라인**:
1. 인증 + IP 추출 + investor type 파싱
2. **VIX 양자화** → 캐시 키 안정화 (panic/fear/unease/normal/calm)
3. 캐시 조회 (L1 메모리 1h + L2 `ai_chok_cache` 1h)
4. **Universe Enrichment** (`chokDataEnricher.ts`):
   - Finnhub `/stock/metric` + `/quote` × 58 universe (배치 10개씩 50ms 간격)
   - `currentPrice`, `peRatio`, `week52Position`, `yearReturn`, `todayChangePct`
   - Validation: PE 0~1000, week52 0~100%
5. **프롬프트 조립**:
   - `CHOK_SYSTEM_PROMPT` + `buildUserTypeContext` + `MACRO_CONTEXT`
   - `ENRICHED_UNIVERSE` (객관 수치 표만 신뢰)
   - `EXCLUDE_SYMBOLS` (포트폴리오 제외)
   - 오늘 movers (gainers/losers 3) + holdings context (priorityScore 상위 3)
6. **AI 호출 + 검증** (`callAndValidate`):
   - universe 필터, sector 다양성 강제 (한/영 통일 `CHOK_SECTOR_MAP`)
7. **재시도 1회** (sector 중복 시) → **결정론적 폴백** (universe 다양성 보장 후보)
8. **로깅**: `ai_chok_recommendations` insert (vix_bucket, pe, week52 포함)

**캐시 키**:
```
userKey:investorType / date_session_vixBucket
```

### 9.4 OCR (`/api/portfolio/ocr`, 242줄)

- Gemini Vision `gemini-2.5-flash`, Temp 0.1 (결정론적)
- 10MB 한도, JPEG/PNG/WEBP/GIF
- 게스트 1/h, 유저 5/h (이미지 토큰 비용 가드)
- 7가지 에러 분류 (no_file, too_large, bad_type, service_down, rate_limit, parse_failed, image_empty)

### 9.5 회로 차단 (`circuitBreaker.ts`)

| 정책 | 윈도우 | minCalls | 임계율 | 차단 |
|---|---|---|---|---|
| `aiStrict` | 5분 | 20회 | 50% | 60s |
| `relaxed` | 5분 | 30회 | 70% | 90s |

응답: `{ code: 'circuit_open', retryAfter: 45, headers: { Retry-After: '45' } }`

### 9.6 Rate Limiter (`rateLimiter.ts`, sliding window)

| 정책 | 윈도우 | 로그인 | 비로그인 |
|---|---|---|---|
| `aiAnalysis` | 1h | 15 | 3 |
| `ocr` | 1h | 5 | 1 |
| `news` | 60s | 60 | 20 |
| `general` | 60s | 120 | 30 |

- Key: `userId` 또는 `ip:{ip}`
- 저장: Supabase `api_calls` 테이블 (Redis 없음 → fail-open)
- 응답 헤더: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Reset`

### 9.7 Web Push & Email

**VAPID**: `web-push` lib, `VAPID_EMAIL` 기본 `mailto:admin@solb.kr`
**Resend**: `EMAIL_FROM` 기본 `"주비 <noreply@solb.kr>"`, RFC 8058 1-click unsubscribe (HMAC stateless), List-Unsubscribe-Post 헤더 매칭
**컴플라이언스**: `alertCompliance.ts` 면책 자동 첨부, HTML + plain text 듀얼

---

## 10. Universe 158종

### 10.1 chokUniverse (US 58, `config/chokUniverse.ts`)
- Tech 8 (AAPL, MSFT, GOOGL, META, AMZN, NFLX, CRM, ORCL)
- Semiconductor 9 (NVDA, AMD, AVGO, QCOM, INTC, MU, TSM, ASML, AMAT)
- EV/Mobility 3, Finance 6, Healthcare/Bio 6, Consumer/Retail 5, 기타 21
- **수동 큐레이션 기반** (섹터 균형)

### 10.2 koreanUniverse (KR 100, `config/koreanUniverse.ts`)
- KOSPI 70 + KOSDAQ 30
- **시총 기반 객관 선정** (분기마다 자동 갱신 예정)
- 카테고리 메타: 대표주(삼성전자, SK하이닉스, LG에너지솔루션 등), 성장주(에코프로비엠, 크래프톤 등)

### 10.3 시장 컨텍스트
- `marketHolidays.ts`: 2026 미국 휴장일
- `marketHours.ts`: ET 09:30~16:00 영업
- `marketStatus.ts`: 실시간 영업 시간 판별 (장중/장외/주말)

---

## 11. 디자인 토큰 & UX

### 11.1 색상 (한국 관례)
- 빨강 `#EF4452`: 상승
- 파랑 `#3182F6`: 하락 (브랜드 색)
- 주비 메인: `#3182F6`

### 11.2 폰트
- Pretendard (CDN, dynamic-subset)
- Geist (Google Fonts, latin)

### 11.3 디자인 방향성 (`feedback_design_direction` 메모리)
- ❌ Bloomberg/Finviz 다크 톤
- ✅ 토스/카카오뱅크 미니멀, 아기자기·모던
- 라이트 배경 `#FAFBFC`, 파스텔 채도 -45%, 라디우스 14px

### 11.4 PWA
- `manifest.json`, `sw.js` (정적 등록)
- iOS apple-touch-icon 192/512
- 192/512 PWA 아이콘 + theme-color

### 11.5 배지 (13개, `config/badges.ts`)
참여(5) + 행동(3) + 학습(2) + 수익(3): first-login, first-stock, three-stocks, ..., streak-7/30/100, first-analysis, mentor-all, first-profit, target-hit, all-profit, rain-light(약세장 수익).

---

## 12. 권한 모델

### 12.1 ADMIN_EMAILS (7개 파일에 통일)
```ts
['soonooya@gmail.com', 'sunu.develop@gmail.com']
```
- `/admin`, `/admin/chok-debug`
- `/api/config` (POST), `/api/admin/*`, `/api/codes/generate`

### 12.2 Founder
- `sunu.develop@gmail.com` — 초대 코드 무제한

### 12.3 RLS 요약
- `auth.uid()` 기반 격리
- service_role: cron + 관리 작업만
- public read: codes(active만), app_config

---

## 13. 정합성 결함 & 수정 로그 (코드에 명시)

| ID | 카테고리 | 문제 | 수정 |
|---|---|---|---|
| C1 | Data | DB 로드 전 save → 빈 데이터 덮어쓰기 | `initialLoadDone` ref 강제 |
| C2-data | Data | 계정 전환 시 이전 data 잔존 | `prevUserIdRef` + `clearUserStorage()` + `resetPortfolio()` |
| H1-data | Data | 스키마 변경 시 데이터 손상 | Zustand `version` + `migrate` |
| L3-data | Data | localStorage quota silent fail | cache 정리 → snapshots trim → 경고 |
| M4-data | Data | 디바운스 2s 중 탭 종료 시 loss | `beforeunload` + `visibilitychange` flush |

---

## 14. 트리거 발동 시 자동 처리 (메모리에 박힘)

| 트리거 | 자동 처리 |
|---|---|
| **유료화/PRO/멤버십 단어 등장** | 약관 제12조 "무료" 표현 갱신 + PRO 가드레일 재확인 (AI 촉 무료 유지) + 변호사 1h 상담 (30~50만원) + 결제 인프라 (토스페이먼츠/포트원) |
| **사용자 손실 클레임 / 금감원 시정조치** | 즉시 변호사 |
| **광고 매출 연 5천만+** | 회색 지대 진입, 변호사 검토 |

---

## 15. 빌드/배포 검증

- `npx tsc --noEmit`: ✅ 0 errors
- `npm run build`: ✅ 통과 (모든 cron route, /admin/chok-debug 페이지 등록)
- `npm run lint:alerts` (prebuild): 컴플라이언스 자동 검사
- 모든 작업 main 브랜치 푸시 완료

---

## 16. 강점 & 트레이드오프

### 강점
- **SSOT 정책 중앙화** — 25개 알림 조건 → 1개 맵
- **AI 환각 차단 4중 방어** — 객관 수치 강제 주입 + universe 필터 + 재시도 1회 + 결정론적 폴백
- **다층 캐싱** — Zustand → localStorage → HTTP headers → Supabase L2
- **Prompt Caching (Claude)** — 5분 TTL, ~90% 비용 절감
- **VIX 양자화 캐시 키** — macro regime 안정성 + 히트율
- **회로 차단 + Rate Limit** — DDoS/폭주 자동 방어
- **PII 자동 정리** — 90일 익명, 365일 hard delete (GDPR/개정정보법)
- **자본시장법 회피 설계** — 컴플라이언스 자동 검사 + AI 촉 무료 유지

### 트레이드오프
- ⚠️ Finnhub free tier 60/min — 대량 동시 호출 불가 (배치 50ms 간격)
- ⚠️ Claude daily limit 500회 — quota 초과 시 완전 차단 (비용 가드)
- ⚠️ Yahoo Finance 비공식 — User-Agent 필요, 언제든 break 가능
- ⚠️ Web Push VAPID 키 관리 비대칭
- ⚠️ check-alerts cron 미등록 — vercel.json에 누락 (외부 스케줄러 가정)
- ⚠️ 4건 마이그레이션 미적용 — 모닝 브리프 이메일/D-3/ramp-up 미동작 위험
- ⚠️ portfolioStore.ts 533줄 단일 파일 — UI 상태와 캐시 혼재

---

## 17. 다음 우선순위 작업

| 우선 | 항목 | 트리거 |
|---|---|---|
| 🔴 사용자 액션 | Supabase 마이그레이션 4건 적용 | 콘솔 SQL Editor |
| 🔴 사용자 액션 | Vercel 환경변수 (RESEND_API_KEY, EMAIL_FROM, EMAIL_UNSUB_SECRET) | Vercel 대시보드 |
| 🔴 NEXT | `/admin/chok-debug` 배포 후 PER 채움률 확인 | 50% 이하면 `/candle` fallback |
| 일반 | 매수 시뮬 P2 (호가 단위, stale price 배지, 모바일 키보드, 엣지 가드) | 회의 보류분 |
| 일반 | 트리맵 색·비율 미세조정 | 사용자 의견 있을 때 |
| 시간 필요 | 베타 1개월 후 ai_chok_recommendations 백테스트 효과성 분석 | filled_30d/90d 누적 후 |

---

**Appendix A. 통계**
- TS/TSX 파일: 179개
- 컴포넌트: 61개 / 22,263줄
- utils: 28개 / 4,483줄
- config: 12개 / 2,260줄
- hooks: 6개 / 1,021줄
- lib: 10개 / 875줄
- API 라우트: ~30개
- DB 테이블: 15개 (4건 미적용)
- Cron: 4개 등록 (vercel.json) + 1개 수동
- Universe: 158종 (US 58 + KR 100)
- 알림 조건: 25개
- 멘토: 6명
- 투자자 유형: 5개
- 배지: 13개

**Appendix B. 참고 문서 (`docs/`)**
- `ALGORITHMS.md` — 알고리즘 설명
- `NOTIFICATION_POLICY.md` — 알림 정책 SSOT (alertPolicy.ts와 동기화)
- `OAuth_설정_가이드.md`, `카카오_로그인_설정_완료_가이드.md`
- `p2-backlog.md` — P2 백로그
- `sql_*.sql` — 4종 (api_observability, daily_snapshots, invite_system, pii_retention)
- 회의록 17권 (디자인 → 전략 → 분석 → DB 동기화)

---

*보고서 생성: Claude Opus 4.7 / 6 Explore agents 병렬 + 1 종합 / 2026-05-06*