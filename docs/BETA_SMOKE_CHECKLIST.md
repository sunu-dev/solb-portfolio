# 베타 출시 D-1 Smoke 체크리스트

> 9인 패널 QA 의견 — 자동 테스트 부재 상태에서 베타 출시 신뢰성 확보용. 출시 직전 30분 수동 sweep + 카나리 5명 24h 검증.

---

## P0 — 출시 차단 톱 10 (실기기 필수)

### 1. 가입 funnel (가장 큰 이탈 지점)
- [ ] 카카오 신규 가입 → 닉네임/이메일 정상 수신 (iOS Safari 17·18, Android Chrome, Galaxy 기본 브라우저)
- [ ] **카카오 인앱브라우저(카톡 안)에서 시작 → Safari/Chrome 리다이렉트 시 세션 유지**
- [ ] Google 신규 가입 → 동일 흐름 확인
- [ ] **동의 체크박스 3개 안 누르면 OAuth 버튼 비활성 확인** (14세 게이트)
- [ ] OAuth 완료 후 `user_consents` 테이블에 3행 INSERT 확인 (Supabase Studio)

### 2. 가입 직후 onboarding
- [ ] Step 0 (가치 약속 3카드) → Step 1 (종목 추가) → Step 2 (AI 촉 미리보기) → Step 3 (시작) 끝까지 진행
- [ ] **샘플 종목 둘러보기 클릭 → 본 화면 '관심 목록'에 추가됨 (보유 X)** ← 페르소나 함정 해결 검증
- [ ] 도중 새로고침·뒤로가기 시 진행도 회복 (또는 onboarding 자동 재시작)

### 3. OCR 업로드
- [ ] 토스 캡처 1장 → broker='toss' 자동 추정 + 종목 추가
- [ ] 키움 캡처 1장 → broker='kiwoom'
- [ ] 미래에셋 캡처 1장 → broker='mirae'
- [ ] **이미지 서버 저장 안 되는지 확인** (Resend·Supabase Storage 보관 X)
- [ ] 음수 표기·소수점·0주 케이스 정상 처리

### 4. 다중 broker 동일 티커 합산
- [ ] 토스 NVDA 10주 (평단 $150) + 키움 NVDA 5주 (평단 $170) → 통합 평단 $156.67 정확히 표시
- [ ] MergedHoldingsCard 자동 노출 (broker 2개 발견)
- [ ] 클릭 시 broker별 lot accordion 펼침
- [ ] **디스클레이머 "주비 계산값, 증권사 표시와 다를 수 있어요" 노출**

### 5. 푸시 옵트인 → 실제 수신
- [ ] **iOS 16.4+ PWA 설치 후만 가능** (홈 화면 추가 → standalone 모드)
- [ ] Android Chrome 즉시 옵트인
- [ ] morning-brief cron 수동 트리거 (`! curl ... /api/cron/morning-brief`) → 잠금화면까지 도달
- [ ] **check-alerts cron 발화 확인** (KST 22:00 = UTC 13:00, 2026-05-15 등록)
- [ ] AI 촉 카드 캡처 시 "ⓘ 정보용" 인라인 면책 함께 찍힘 확인

### 6. 이메일 옵트인 → Resend 발송 → 수신함
- [ ] **RESEND_API_KEY·EMAIL_FROM Vercel env 추가 후 진행**
- [ ] Gmail 수신함 도착
- [ ] Naver 메일 수신함 도착 (스팸함 확인)
- [ ] Daum 메일 수신함 도착
- [ ] **unsubscribe 링크 1-click 동작** (EMAIL_UNSUB_SECRET 검증)

### 7. AI 한도
- [ ] 무료 AI 촉 1회 소진 후 차단 메시지 + 다음날 00:00 KST 리셋
- [ ] 무료 AI 분석 3회 소진 후 차단 메시지
- [ ] 비로그인 사용자는 AI 분석 0회 (시세·차트만)

### 8. 계정 삭제
- [ ] 프로필 > 계정 삭제 → 카카오 토큰 unlink + Supabase row 완전 삭제
- [ ] 재가입 시 신규 사용자 처리 (이전 데이터 없음)

### 9. PWA 설치
- [ ] iOS Safari "홈 화면에 추가" → standalone 모드 진입
- [ ] **OG 이미지 확인**: 카톡에 `https://solb-portfolio.vercel.app` 공유 → 그라데이션 카드 노출
- [ ] Android Chrome "앱 설치" 배너 → 매니페스트 단축키 동작
- [ ] **다크 모드에서 흰 깜빡임 없음** (color_scheme: light lock 검증)
- [ ] maskable 아이콘 안드로이드 가장자리 잘림 없음 (현재 임시 same file — V1.1에서 별도)

### 10. 검색·동기화
- [ ] 24,400 universe 검색 응답성: "삼", "AAPL", 한글·영문·티커 혼합
- [ ] **`stock_listings` 페이지네이션 정상**: sync-listings 수동 트리거 후 신규 0~10건 (이전 23,413 오탐 회귀 X)
- [ ] 디바운스·빈 결과 UI

---

## 카나리 5명 24h 검증 (출시 직전)

Vercel Preview URL을 베타 50명 중 5명에게 24h 노출 후 Production 승격.

**선정 기준**:
- iOS Safari 사용자 2명
- Android Chrome 사용자 2명
- PC 데스크톱 사용자 1명

**확인 항목**:
- [ ] Sentry 신규 에러 0~3건 이내 (베타 100명 규모 기준)
- [ ] OAuth funnel drop 30% 미만
- [ ] PWA 설치율 측정 (impression/install)
- [ ] AI 촉 첫 클릭 5분 이내 도달

**24h 후 결정**:
- 에러 0~3건 + drop 30% 미만 → Production 승격
- 에러 10건+ 또는 drop 40%+ → 1주 슬립 + 핫픽스

---

## 출시 후 24h 모니터링 (QA 패널)

1. **회원가입 funnel drop**: 카카오 동의 → 콜백 → onboarding 완료 단계별 이탈률
   - 30%+ drop 발생 단계 → 즉시 핫픽스

2. **OCR 성공률** (Gemini Vision 응답 정상 / 전체 업로드)
   - 70% 미만 → broker별 샘플 수집, 프롬프트 튜닝

3. **푸시 발송 성공률** (`alert_log` success/total)
   - VAPID 키 만료, 토큰 만료 즉시 감지
   - iOS vs Android 분리 집계 (iOS 30일 미사용 시 자동 만료 가능)

4. **API 5xx + AI provider fallback 빈도**
   - Gemini quota 소진 시 Claude fallback 발동률
   - `circuitBreaker.ts` 트립 로그

5. **Sentry 신규 에러 톱 5** (모바일·OS·브라우저별 분류)
   - 특히 Galaxy 기본 브라우저(Samsung Internet) — Chromium 변종, 의외로 잘 깨짐

6. **`account/delete` 호출 카운트**
   - 첫 24h에 5%+ 삭제 → onboarding/권한 거부감 신호

---

## 베타 KPI 5종 (1개월 측정)

| # | 지표 | 임계값 | 미달 시 |
|---|---|---|---|
| 1 | D7 retention | ≥30% | 모닝브리프·푸시 빈도 재설계 |
| 2 | 가입→첫 AI 촉 도달 | ≤5분 / ≥70% | 온보딩 단축 |
| 3 | WAU/MAU | ≥0.5 | 챕터·시즌제 강화 |
| 4 | AI 촉 👍률 / 평가응답률 | ≥60% / ≥40% | priorityScore 재학습 |
| 5 | PRO 결제 의향 survey | ≥25% / ≥10% 즉시 | PRO 가격·기능 재설계 |

**PRO 출시 트리거 동시 충족**: 가입 1,500+ AND D7 30%+ AND PRO survey 15%+ AND affiliate 1건 이상 실수금.

---

## D-7 진행 상황 (2026-05-15 기준)

| 단계 | 코드 | 사용자 액션 |
|---|---|---|
| D-6 인프라 | ✅ 4/5 (`1e76442`) | RESEND env + Sentry DSN |
| D-5 법무 | ✅ 5/5 (`1a002e7`) | 마이그레이션 적용 + OAuth redirect 검증 |
| D-4 디자인 V1 | ✅ 3/5 (`e044602`) | 로고/색상 결정 + maskable PNG + iOS 스플래시 |
| D-3 UX 함정 | ✅ 5/5 (`9a7bd0e`) | — |
| D-1 QA smoke | ⏳ 실기기 수동 sweep | 출시 직전 |

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-15 | v1.0 — 9인 패널 QA 의견 + D-7 진행 상황 통합 |
