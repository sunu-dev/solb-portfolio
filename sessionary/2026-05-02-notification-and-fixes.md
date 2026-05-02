# 2026-05-02 — 알림 정책 SSOT + 챕터/매수/휴장 fix

## 작업 요약

직전 세션(weekly-buildout) 위에서 **알림 정책 SSOT 4단계 풀 구축** + 사용자 보고 버그 3건 fix + UI/UX 9인 패널 회의 4회.

### 1. AI 촉 + 마켓 요약 1줄 통합 (커밋 fd2a349, 9c03395 이전 작업)

세션 초반:
- `chokDataEnricher.ts`에 Supabase L2 캐시 추가 — 콜드 스타트마다 Finnhub 116 API 호출하던 문제 해결
  (모듈 캐시는 Vercel 서버리스에서 인스턴스 간 공유 안 됨)
- "월요일 이벤트" 혼란: `marketStatus.ts`에서 `nextEvent: '월요일'` → `'월요일 개장'`, MarketSummary 라벨 "다음 이벤트:" → "다음 일정:"
- 휴장일 표시 7일 범위로 확장 (이번 주 미리 보기), 요일 이름 포함
- Dashboard 건강점수 + 시장 현황 2행 → **1행 통합** (9인 전문가 회의 결과: button-in-button HTML 위반 해결, role="group" + 독립 버튼)

### 2. 알림 정책 SSOT — Phase 1 (커밋 9c03395)

9인 전문가 회의 → `docs/NOTIFICATION_POLICY.md` 작성 (단일 진실 원천):
- 채널 매트릭스 (push/toast/inapp 25개 알림 타입)
- 컴플라이언스 정책 (자본시장법 회피 — 매수/매도 권유 어휘 금지)
- 빈도/억제 정책, 사용자 컨트롤, A11y, Status vs Alert 구분

코드:
- `alertsEngine.ts`에 `Alert.channels`, `Alert.category` 필드 추가
- `ALERT_POLICY` 맵으로 condition별 라우팅 정의
- `alertCompliance.ts` 신규 — `FORBIDDEN_PHRASES` 18종 + `DISCLAIMER` 상수 + `validateAlertMessage()`
- `AlertCard`/`ToastAlert`에 면책 문구 렌더 (데이터 깨끗 유지, 렌더 레이어에서 첨부)
- ToastAlert: 5초 → 8초, `aria-live="polite"`

### 3. 알림 정책 SSOT — Phase 2 (커밋 75fa7d7)

- `config/alertPolicy.ts` 분리 — client/server 공유 SSOT (push cron이 `isPushAllowed()` 사용)
- `alertSuppress.ts` facade — snooze + learning 통합 `isSuppressed()` API
- `alertPrefs.ts` + Settings UI — 6개 카테고리 ON/OFF 토글 + 무음 시간대 (KST 22~7시)
- PWA 설치 유도 카드 — `pwa.ts` 환경 감지 + iOS Safari 3단계 가이드 + Android beforeinstallprompt
- Dashboard 상단 "최근 알림 미리보기" 슬롯 (severity 1~2, 클릭 시 알림 시트 오픈)
- `alert_log` Supabase 테이블 + push 송신 로깅 (sent/failed/expired) — 컴플라이언스 분쟁 증거

### 4. 알림 정책 SSOT — Phase 3 (커밋 1cc6146)

- `scripts/lint-alerts.mjs` + `prebuild` hook — 빌드 시 컴플라이언스 단어 검사 (CI 차단)
  검출된 위반 2건 정리:
  - PortfolioHealth: "매도 타이밍" → "매도 시점"
  - ai-chok 프롬프트: "추천 종목" → "관찰 후보 종목"
- `cleanup-pii` cron에 `alert_log` 365일+ 삭제 추가 (별도 cron 안 만듦)
- 푸시 7일 ramp-up: `isPushAllowedForUser(type, createdAt)`, D0~D6은 stoploss + portfolio-down만, D7+ 전체
  `push_subscriptions.created_at` 컬럼 추가 마이그레이션
- 모닝브리프 이메일 백업: Resend wrapper, `email_subscriptions` 테이블, `/api/email/morning-brief` 토글, cron 통합

### 5. 알림 정책 SSOT — Phase 4 (커밋 4c146e5)

- 이메일 unsubscribe RFC 8058 1-click: `unsubscribeToken.ts` HMAC-SHA256 stateless, `/api/email/unsubscribe` GET/POST, `List-Unsubscribe` 헤더 자동
- 월말 D-3 이메일 백업: `monthly_d3_enabled` 컬럼, `/api/email/monthly-d3`, monthly-d3 cron 통합
- 모닝브리프 HTML 템플릿: `emailTemplates.ts` 토스 톤 (인라인 CSS, 손익 색상, 챔피언 강조, CTA 버튼)
- SettingsPanel: 재사용 `EmailSubscriptionToggle` 컴포넌트로 두 토글 통합

### 6. 챕터 5월 1~5일 4월 회고 버그 (커밋 fb7864f)

사용자 보고: "5월인데 4월 챕터가 살아있네"
- 원인: `monthlyChapter.ts`에서 새 달 1~5일을 의도적 "recap phase"로 처리했지만 직관과 충돌
- 해결: recap phase 폐지 → 새 달 1일부터 즉시 새 챕터
- 새 달 첫 7일에 "📖 지난달 회고 보기" CTA 추가 (보완 진입점, ChapterShelf로 스크롤)
- `ChapterTime`에 `isFreshMonth`, `previousChapterId` 필드 추가
- `MonthlyReplay`도 동일 로직 정리

### 7. 매수 시뮬레이션 9인 패널 (커밋 c5d5f0e)

사용자 보고: "매수 시뮬레이션이 이상해, 토스증권과 비교됨"
- **CRITICAL 버그**: 한국 주식 가격(KRW)을 USD로 잘못 환산 → 100만원 입력 시 0주 계산
- BuySimulator props 분리: `market: 'KR'|'US'`, `priceCurrency`, `currency` 3축 모델
- 분수주 정책: KR 정수만, US 0.001주 (한국은 분수주 미지원)
- 컴플라이언스: 버튼 "💰 지금 {kr} 사면 어떻게 될까?" → "📊 이 종목을 더 샀다면?" (가정형, 종목명 미노출)
- 천 단위 콤마 자동 입력, formatPrice/formatShares 헬퍼, 동적 프리셋, 디스클레이머 1줄

### 8. 휴장 정보 popover 이동 9인 패널 (커밋 d27972a)

사용자 의견: "어린이날처럼 한국 휴장은 국장 누를 때만 보이는 게 맞다"
- 상단 바 "📅 다가오는 휴장" 뱃지 블록 제거
- KR/US popover 내부에 "📅 휴장 일정" 섹션 추가 — market별 자동 필터, D-30 시야
- `getUpcomingHolidaysForMarket(market, days)` 헬퍼 추가
- 표기: D-N + 요일 + 날짜 + 라벨, 당일은 "오늘" 빨강 강조
- 당일 휴장 빨간 뱃지는 상단 바 유지 (가장 시급한 정보)

### 9. Session Management Protocol v3 → v3.1

`v3.1 (2026-05-02)` 적용 — hook 명령에서 `TODO.md`가 `sessionary/*.md` glob에 매칭되어 `sort -r` 결과 최상단으로 올라오는 버그 픽스. `grep -v '/TODO\.md$'` 명시 제외.
- `.claude/settings.json`은 이미 v3.1 명령 포함됨 (변경 불필요)
- `AGENTS.md` 헤더만 v3 → v3.1로 업데이트

## 결정사항

1. **알림 정책 SSOT 단일 문서** — 코드와 문서 충돌 시 문서를 정답으로. 4 phase 동안 일관 유지.
2. **Status ≠ Alert 분리 원칙** — Dashboard 인라인은 status, 알림 시스템은 delta 이벤트. 통합 X, 진입점만 추가.
3. **이메일 채널 명시 옵트인 + 1-click unsubscribe** — GDPR/CAN-SPAM 준수. 두 채널(push, email) 독립 옵트인.
4. **컴플라이언스 빌드 차단** — runtime warn만으로는 부족. 정적 검사로 빌드 단계 차단.
5. **매수 시뮬 단위 모델 3축 분리** — `market`(분수주 정책) / `priceCurrency`(가격 단위) / `currency`(입력+표시 단위). 환산은 단위 차이 시 1회만.
6. **휴장 정보 시장별 컨테이너** — 한국 휴장은 KR popover, 미국 휴장은 US popover. 사용자 직관과 일치.
7. **수수료 숫자 노출 X** — 솔비서는 broker가 아니므로 특정 증권사 수수료 가정 부적절. 디스클레이머 1줄로 갈음.
8. **재사용 EmailSubscriptionToggle 컴포넌트** — endpoint/label/emoji/accent prop으로 일반화. 향후 새 알림 종류 추가 쉬움.

## 미해결 TODO

- [ ] **🔴 사용자 액션** Supabase migration 4건 적용 (이번 세션 누적)
  - `2026-05-02_alert_log.sql`
  - `2026-05-02_email_subscriptions.sql`
  - `2026-05-02_email_subscriptions_monthly_d3.sql`
  - `2026-05-02_push_subscriptions_created_at.sql`
- [ ] **🔴 사용자 액션** Vercel 환경변수 추가 (이메일 백업 채널 활성화)
  - `RESEND_API_KEY` (resend.com 발급, 무료 월 3천건)
  - `EMAIL_FROM` (예: `"주비 <noreply@solb.kr>"`, 도메인 검증 필요)
  - `EMAIL_UNSUB_SECRET` (선택, 없으면 CRON_SECRET fallback)
- [ ] `/admin/chok-debug` 배포 후 PER 채움률 확인 (직전 세션부터 이월) → 50% 이하면 F 작업
- [ ] 매수 시뮬 P2 — 호가 단위 정렬, stale price 배지, 모바일 키보드 가림 sticky
- [ ] 알림 Phase 5 — 푸시 실패 시 자동 이메일 retry, 카카오 알림톡 (비용 발생 → 매출 단계 검토)
- [ ] 베타 1개월 후 `ai_chok_recommendations` 백테스트 데이터 분석 (시간 필요)

## 다음 세션 진입점

1. **Supabase migration 4건 + 환경변수** 적용 후 이메일 백업 채널 실제 동작 확인 (Resend dashboard 송신 로그)
2. 알림 시스템은 Phase 1~4로 완전 정착됨 — 추가 작업 시 정책 문서(`docs/NOTIFICATION_POLICY.md`)와 `config/alertPolicy.ts`가 SSOT
3. 매수 시뮬 P2 (호가/stale/모바일 sticky)는 사용자 피드백 트리거 시 진행
