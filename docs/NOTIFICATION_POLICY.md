# SOLB PORTFOLIO 알림 정책 (Notification Policy)

**버전**: v1.0
**제정일**: 2026-05-02
**근거**: 9인 전문가 회의 (알림 UX, 행동심리, 모바일 푸시, 한국 핀테크 PM, 금융 규제, IA, 퍼포먼스, A11y, 리텐션)
**범위**: 본 문서가 알림 시스템의 단일 진실 원천(SSOT)이다. 코드와 본 문서가 충돌하면 **본 문서를 정답으로 간주**하고 코드를 갱신한다.

---

## 1. 핵심 원칙

1. **채널 분리**: 푸시는 "행동 요구", 인앱(사이드바/시트)은 "탐색", Dashboard 인라인은 "현재 상태(status)" — 셋은 다른 시스템.
2. **사용자 동의 우선**: 푸시는 명시적 동의 + 카테고리별 ON/OFF.
3. **알림 피로 방지**: 빈도 상한 + 자동 학습 억제.
4. **법적 안전**: 매수/매도 권유 어휘 금지, 모든 알림에 면책 1줄.
5. **Status ≠ Alert**: 대시보드 인라인 정보(시장현황·건강점수)는 알림 시스템 외부. 통합 금지.

---

## 2. 채널 매트릭스

| Alert 타입 (condition) | 카테고리 | 푸시 | 토스트 | 사이드바/시트 | 비고 |
|---|---|:---:|:---:|:---:|---|
| `stoploss-hit` | price | ✅ | ✅ | ✅ | severity 1 |
| `stoploss-pct` | price | ✅ | ✅ | ✅ | severity 1 |
| `target-hit` | price | ✅ | ✅ | ✅ | severity 1 |
| `target-return` | price | ✅ | ✅ | ✅ | severity 2 |
| `target-profit-usd` | price | ✅ | ✅ | ✅ | severity 2 |
| `target-profit-krw` | price | ✅ | ✅ | ✅ | severity 2 |
| `portfolio-down` | portfolio | ✅ | ✅ | ✅ | severity 1 |
| `daily-plunge` | market | ✅ | ✅ | ✅ | severity 2 |
| `stoploss-near` | price | ❌ | ✅ | ✅ | severity 2 |
| `target-near` | price | ❌ | ✅ | ✅ | severity 3 |
| `buy-zone` | price | ✅ | ✅ | ✅ | 사용자 명시 트리거(buyBelow) — 자산 변동 트리거에 준함 |
| `daily-surge` | market | ❌ | ✅ | ✅ | severity 4 |
| `zscore-extreme` | market | ❌ | ✅ | ✅ | severity 1-2 |
| `composite-*` | indicator | ❌ | ✅ | ✅ | 5종 복합 신호 |
| `below-avgcost` | portfolio | ❌ | ❌ | ✅ | severity 3 |
| `near-52w-low` | indicator | ❌ | ❌ | ✅ | severity 3 |
| `near-52w-high` | indicator | ❌ | ❌ | ✅ | severity 4 |
| `golden-cross` / `death-cross` | indicator | ❌ | ❌ | ✅ | severity 3 |
| `rsi-oversold` / `rsi-overbought` | indicator | ❌ | ❌ | ✅ | severity 3-4 |
| `bb-lower` / `bb-upper` | indicator | ❌ | ❌ | ✅ | severity 4 |
| `macd-bull` / `macd-bear` | indicator | ❌ | ❌ | ✅ | severity 3 |
| 모닝 브리프 | digest | ✅ (KST 7:00) | — | — | 별도 cron |
| 월말 D-3 리마인더 | digest | ✅ (KST 11:00) | — | — | 별도 cron |
| 배지·스트릭 | celebrate | — | ✅ | — | badgeChecker 별도 |

**설계 원칙**: 푸시는 **사용자 자산에 직접 영향을 주는 이벤트**(가격/포트폴리오)만. 시장 분석·기술지표는 인앱 한정 — 토스 패턴 차용.

---

## 3. 빈도·억제 정책

### 3.1 푸시 (Push)

- 종목당 24시간 내 **최대 3개**
- 디폴트 ON: 가격 도달, 손절, 포트폴리오 -10% 만 (필수 3종)
- 신규 유저 7일 ramp-up: D1 환영 → D3 첫 알림 → D7 모닝브리프
- 무음 시간대: KST 22:00 ~ 07:00 (Settings 토글)

### 3.2 인앱 (사이드바/시트)

- 카테고리당 1일 **5개 상한**
- 7일 내 같은 종목·타입 3회 발생 시 **자동 학습 숨김**
- 총 알림 25개 상한 (severity 1-2는 예외 — 모두 표시)

### 3.3 토스트

- 화면 동시 **1개**
- **8초** 자동 닫힘 + 수동 dismiss (A11y: `role="status"`, `aria-live="polite"`)
- `channels`에 `'toast'` 포함된 **신규** 알림만 띄움 (이미 본 알림 / 학습 억제된 알림 제외)
- 토스트 표시 후 60초 쿨다운 (연속 토스트 폭주 방지)

### 3.4 스누즈 + 학습 통합

- 단일 함수 `suppressAlert(symbol, type, until?)`로 통합
- UI는 **"이 종목 이런 알림 그만보기"** 단일 버튼
- 시간 기반(스누즈 1h/3h/24h/장마감) + 횟수 기반(학습) 모두 같은 테이블에 기록

---

## 4. 컴플라이언스 정책 (자본시장법 회색지대 회피)

### 4.1 금지 어휘 (Forbidden Phrases)

다음 어휘는 알림 메시지에 **절대 사용 금지**. `validateAlertMessage()`가 빌드 시 검사.

- "지금 사세요", "지금 매수", "지금 매도"
- "매수하세요", "매도하세요"
- "매수 추천", "매도 추천", "추천 종목"
- "매수 타이밍", "매도 타이밍"
- "사야 한다", "팔아야 한다"
- "보장", "확실", "100%"

### 4.2 허용 어휘 (Allowed Phrases)

객관 사실 기반 표현은 OK:

- "MACD 골든크로스 발생", "RSI 30 진입", "52주 신저점 근접"
- "목표가 도달", "손절가 도달"
- "평소보다 N배 변동"
- "여러 지표가 동시에 변하고 있어요" (관찰 묘사)

### 4.3 면책 1줄 (Disclaimer)

모든 알림 카드 하단에 다음 문구를 **렌더링 레이어에서 강제 표시**:

> 본 알림은 정보 제공 목적이며, 투자 결정과 그 결과는 투자자 본인의 판단과 책임입니다.

- 알림 데이터(`Alert.detail`)에 박지 않고 **AlertCard·Toast·Push 템플릿에서 렌더 시 자동 첨부** (데이터 깨끗하게 유지).

### 4.4 송신 로깅

- 푸시 발송 시 `alert_log` 테이블에 `(user_id, type, message, channels, sent_at)` 1년 보관
- 분쟁 시 어떤 알림이 언제 갔는지 증거 확보

---

## 5. 사용자 컨트롤 (Settings)

| 항목 | 위치 | 디폴트 |
|---|---|---|
| 푸시 전역 ON/OFF | Settings → 알림 | OFF (사용자가 명시 ON) |
| 카테고리 ON/OFF (price/indicator/market/portfolio) | Settings → 알림 → 세부 | price·portfolio ON, 나머지 OFF |
| 무음 시간대 (22:00~07:00) | Settings → 알림 → 무음 | OFF |
| 종목별 음소거 | 종목 상세 → ⋯ → "알림 끄기" | — |
| 토스트 표시 ON/OFF | Settings → 알림 → 인앱 | ON |
| 모닝브리프 구독 | Settings → 알림 → 정기 | OFF |
| 월말 D-3 리마인더 구독 | Settings → 알림 → 정기 | OFF |

---

## 6. 비로그인 사용자

- **푸시 0** — 비로그인은 푸시 인프라 자체가 작동하지 않음 (subscription 저장 불가)
- 인앱(사이드바/시트/토스트)은 정상 작동
- "로그인하면 푸시 받기" 유도 카드 노출 (모닝브리프 권장)

---

## 7. 모바일/iOS 한계

- iOS Safari Web Push는 **PWA 설치 시에만** 작동 (홈 화면 추가 필수)
- 일반 모바일 웹 사용자(아이폰)는 푸시 도달률 0
- **PWA 설치 가이드 카드**를 인앱에 노출 (Phase 1)
- 카카오톡 알림톡/SMS 백업 채널은 Phase 2 보류 (비용 발생)
- 이메일 백업 채널: 모닝브리프 한정 (Phase 1.5)

---

## 8. Status vs Alert 구분

**Status (대시보드 인라인 — 알림 시스템 외부)**:
- 시장 현황 (상승/하락)
- 상승 1위 / 하락 1위 종목
- 건강점수 (25/100)
- 진행 중 이벤트 타임라인

→ 항상 노출, dismiss 불가, 데이터 변할 때마다 자동 갱신

**Alert (알림 시스템)**:
- delta 이벤트 (가격 변화, 신호 발생, 목표 도달)

→ dismiss 가능, 스누즈 가능, 학습 억제 가능

**진입점 통합**: Dashboard 상단에 "최근 알림 1줄 미리보기" 슬롯 — severity 3+ 미해제 알림 1건만 미리보기, 클릭 시 사이드바 펼침. (통합 X, 진입점만 추가)

---

## 9. 접근성 (A11y)

- 토스트: `role="status"`, `aria-live="polite"`, 8초 + 수동 닫기
- 알림 카드: 색상에만 의존 금지 — `위험` 뱃지는 **빨강 + "위험" 텍스트 + 🔴 아이콘**
- Header 알림 벨: 카운트 숫자 + `aria-label="미확인 알림 N건"`
- 푸시 본문: 시각 의존 어휘 금지 ("빨간색 신호" 같은 표현 X)

---

## 10. 구현 단계

### Phase 1 (완료 — 2026-05-02)

- [x] 본 정책 문서 작성 (SSOT 확립)
- [x] `Alert` 인터페이스에 `channels`, `category` 필드 추가
- [x] `ALERT_POLICY` 정책 맵 추가 (condition → channels/category)
- [x] `src/utils/alertCompliance.ts` 신규 — `FORBIDDEN_PHRASES`, `validateAlertMessage()`, `DISCLAIMER`
- [x] `makeAlert()`에 컴플라이언스 검사 통합
- [x] `AlertCard.tsx` 하단 면책 문구 렌더
- [x] `ToastAlert.tsx` 8초 + `aria-live="polite"` + 면책 문구 + channels 기반 필터

### Phase 2 (완료 — 2026-05-02)

- [x] `config/alertPolicy.ts` 분리 — client/server 공유 SSOT
- [x] 푸시 cron(`/api/cron/check-alerts`)을 `isPushAllowed()` 인지하도록 정렬
  - `buy-zone`은 사용자 명시 트리거(buyBelow)이므로 push 허용으로 정책 갱신 (자산 변동 트리거에 준함)
- [x] `alertSuppress.ts` 통합 facade — `isSuppressed()` + `suppressAlert()` 단일 API
- [x] `alertPrefs.ts` + Settings에 카테고리 ON/OFF 토글 + 무음 시간대 (KST 22:00~07:00)
- [x] PWA 설치 유도 카드 (iOS Safari 가이드 + Android Chrome 자동 프롬프트)
- [x] `alert_log` Supabase 테이블 + 푸시 송신 로깅 (sent / failed / expired_subscription)
- [x] Dashboard 상단 "최근 알림 미리보기" 슬롯 (severity 1~2 top 1건, 클릭 시 알림 시트 오픈)

### Phase 3 (예정)

- [ ] 푸시 디폴트 "필수 3종만 ON" + 신규 유저 7일 ramp-up
- [ ] 빌드 시 컴플라이언스 검사 (`npm run lint:alerts`) — CI 차단
- [ ] alert_log 1년 경과분 자동 cleanup cron
- [ ] 모닝브리프 이메일 백업 채널 (모바일 사파리 푸시 미설치 보완)

---

## 부록 A — 9인 전문가 회의 요약

| # | 전문가 | 핵심 입장 |
|---|---|---|
| 1 | 알림 UX | 채널 엄격 분리 (푸시=행동요구 / 인앱=탐색 / 대시보드=상태) |
| 2 | 행동심리/알림피로 | 카테고리당 1일 N개 상한, 학습 기반 자동 억제 필수 |
| 3 | 모바일 푸시 UX | iOS는 PWA만 — 도달률 한계, 백업 채널 검토 |
| 4 | 한국 핀테크 PM | 자산 변동 트리거만 푸시 (토스 패턴) |
| 5 | 금융 규제 | 매수/매도 권유 어휘 금지, 면책 1줄 강제 |
| 6 | IA | Status ≠ Alert, 통합 금지, 진입점만 추가 |
| 7 | 퍼포먼스/비용 | 크론·푸시 비용 안전, DB 인덱스 검토 필요 |
| 8 | A11y | 색상 의존 금지, 토스트 8초 + 수동 dismiss |
| 9 | 리텐션 PM | 푸시 ON = +40% D30 리텐션, 단 7일 ramp-up 필수 |

크로스 토론에서 합의된 5건은 본 문서 §3, §4, §5, §7, §8에 반영됨.
