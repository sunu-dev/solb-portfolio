# 다음 작업 목록 — 통합 우선순위

> **작성일**: 2026-05-13
> **목적**: ROADMAP.md, BROKER_FEATURE.md, BUSINESS_REVIEW.md 등의 미완료 작업을 한 곳에 모아 즉시 실행 가능한 액션 리스트 제공
> **관련**: [ROADMAP.md](ROADMAP.md), [BROKER_FEATURE.md](BROKER_FEATURE.md), [ALGORITHM_REVIEW.md](ALGORITHM_REVIEW.md), [BUSINESS_REVIEW.md](BUSINESS_REVIEW.md), [THRESHOLDS.md](THRESHOLDS.md)

---

## 🎯 즉시 가능 (코드만, 외부 의존성 0)

| 우선순위 | 작업 | 출처 | 예상 소요 | 효과 |
|---|---|---|---|---|
| 🔴 P0 | **Phase B-1 broker 필드** | BROKER_FEATURE.md | 1~2일 | 다증권사 사용자 만족 + 가입 동기 |
| 🔴 P0 | **OCR broker 자동 추정** | BROKER_FEATURE.md | 0.5일 | 입력 부담 감소 |
| 🟠 P1 | **PRO 결제 페이지 UI 시안** (`/upgrade`) | ROADMAP P1-1 부분 | 1일 | 전환률 측정 가능 |
| 🟠 P1 | **랜딩 슬로건 A/B 후보 3개** | BUSINESS_REVIEW §7 | 0.5일 | 가입 동기 검증 |
| 🟡 P2 | **/help 페이지 "증권사 통합 안내" 섹션** | BROKER_FEATURE.md | 0.5일 | 컨셉 명확화 |

---

## 🔴 사용자 액션 필요 (외부 의존)

| 작업 | 대기 사유 | 액션 |
|---|---|---|
| **Supabase 마이그레이션 4건** | 콘솔 SQL Editor 적용 | (1) alert_log, (2) email_subscriptions, (3) email_subscriptions_monthly_d3, (4) push_subscriptions_created_at + 어제 추가된 ai_feedback (5건째) |
| **Vercel 환경변수 추가** | Vercel 콘솔 | RESEND_API_KEY, EMAIL_FROM, EMAIL_UNSUB_SECRET |
| **Vercel Pro 전환 ($20/월)** | PRO 결제 페이지 출시와 동시 | 트리거: 결제 페이지 출시 |
| **토스페이먼츠 계정 등록** | 사업자 정보 등록 필요 | PRO 결제 인프라 (P1-1) |
| **증권사 제휴 (Affiliate)** | 토스·키움·미래에셋 등 협의 | 추가 매출원 (P1-2) |
| **멘토 6명 시연 영상 (5분)** | 외부 제작 | 마케팅 자산 (P0-8, P1-4) |
| **`/admin` 성장 탭 funnel 모니터링** | 1주일 데이터 누적 후 | KPI 검증 (P0-6 후속) |
| **CRON_SECRET 회전 메커니즘** | 보안 강화 | 보안 전문가 권장 |

---

## 🟡 점진 진행 (Phase 2~3)

### Phase 2 (베타 100~500명)
| # | 작업 | 출처 | 비고 |
|---|---|---|---|
| 1 | **Phase B-2 증권사별 뷰** | BROKER_FEATURE.md | broker 필드 사용자 비율 ≥ 20% 도달 시 |
| 2 | **PRO 결제 인프라 완성 (토스페이먼츠)** | ROADMAP P1-1 | 사용자 등록 후 |
| 3 | **챕터 시즌제 추가 강화** | (보강) | 회고 PDF 다운로드, 공유 카드 |
| 4 | **카카오 알림톡 / SMS** | Phase 5 보류 | 비용 발생 시 검토 |

### Phase 3 (베타 500~2000명)
| # | 작업 | 출처 | 비고 |
|---|---|---|---|
| 1 | **Phase B-3 계좌 종류 + 세무 비서** | BROKER_FEATURE.md | 진짜 moat. 세무 검토 필요 |
| 2 | **priorityScore A/B 테스트** | ALGORITHM_REVIEW | ai_feedback 데이터 누적 후 |
| 3 | **멘토 페르소나 정량 검증** | ALGORITHM_REVIEW | 같은 종목 6번 분석 다양성 |
| 4 | **Series A 펀딩 준비** | BUSINESS_REVIEW | 5만 가입 + 단위 경제 |

---

## 📊 KPI 추적 (이미 인프라 구축됨)

`/admin` 성장 탭에서:
- 신규 가입 일별
- DAU/WAU
- D1/D7 retention
- 온보딩 funnel (가입 → step view → 샘플/종목 추가 → 완료/스킵)
- 본 화면 투어 funnel (시작 → 단계 → 완료/스킵)
- 도움말 진입
- AI 추천 만족도 (👍/👎)
- AI Provider 상태 (Gemini 키 사용량, Claude fallback)

**1주일 후 첫 의미 있는 데이터 예상** — 그 후 가중치·임계값 검증 가능 (THRESHOLDS.md P1 우선순위).

---

## 🚨 트리거 대기 (조건 충족 시 자동 발동)

| 트리거 | 액션 |
|---|---|
| **PRO 결제 페이지 출시** | (1) Vercel Pro $20/월 전환 (2) 약관 §12 "무료" 표현 갱신 (3) 변호사 1시간 상담 (4) 토스페이먼츠 SDK 통합 |
| **광고 매출 연 5,000만+** | 회색지대 진입 — 변호사 검토 |
| **사용자 손실 클레임** | 즉시 변호사 |
| **금감원 시정조치** | 면책 메시지 강화 + 즉시 변호사 |
| **50,000명 도달** | Series A 펀딩 시도 |
| **stock_listings KS/KQ 데이터 부족** | KRX OpenAPI 등록 검토 |

---

## 📈 권장 진행 순서 (다음 세션)

### Option 1 — 즉시 가성비 최고
1. **Phase B-1 broker 필드** (1~2일) → 다증권사 사용자 가입 동기 강화
2. **OCR broker 자동 추정** (0.5일) → 입력 부담 즉시 해소
3. **랜딩 카피 보강** (0.5일) → 가입 funnel 강화

### Option 2 — 수익화 우선
1. **PRO 결제 페이지 UI 시안** (1일) → 결제 의향 측정
2. 토스페이먼츠 계정 등록 (사용자) → 다음 세션 결제 인프라

### Option 3 — 검증·데이터
1. 베타 100명 모집 (사용자, 카카오 오픈채팅)
2. 1주일 funnel 데이터 누적
3. 데이터 기반 다음 결정

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-13 | 초안 작성. Phase B 합의 후 통합. |
