# 솔비서(주비) — 로드맵 & Action Items

> **작성일**: 2026-05-13
> **목적**: [ALGORITHM_REVIEW.md](ALGORITHM_REVIEW.md) 및 [BUSINESS_REVIEW.md](BUSINESS_REVIEW.md) 결과를 시간순 실행 계획으로 통합
> **관련**: [THRESHOLDS.md](THRESHOLDS.md), [CRONS.md](CRONS.md)

---

## 📍 현재 위치 (2026-05-13)

- ✅ MVP 완성 + Vercel 배포
- ✅ AI 호출 통제 정책 (일별·로그인필수·tier)
- ✅ 신규 상장 감지 파이프라인 (Phase 1+2+3)
- ✅ 온보딩 4단 + CoachMark 4 핫스팟 + /help
- ✅ Supabase 마이그레이션 7건 중 5건 적용 (profiles, stock_listings)
- ✅ Vercel 배포 자동화 정상 (어제 cron 오류 해결)
- ⏳ 베타 사용자 0~10명 추정

---

## 🎯 Phase 1 — 베타 100명 (지금 ~ 2개월)

### 목표
- 알고리즘 정당성 결정적 결함 3개 제거
- KPI 측정 인프라 가동
- "매일 켜는 이유" 핵심 UX 완성

### Action Items

| # | 과제 | 위치/방법 | 우선순위 | 소요 |
|---|---|---|---|---|
| **즉시** |
| P0-1 | docs/THRESHOLDS.md 작성 | 이 문서 시리즈와 함께 | 🔴 | ✅ 완료 |
| P0-2 | AI 응답 컴플라이언스 후처리 | `sanitizeAiOutput()` + ai-analysis route 통합 | 🔴 | 4시간 |
| P0-3 | 사용자 피드백 1탭 | `ai_feedback` 테이블 + 카드 👍/👎 | 🔴 | 4시간 |
| P0-4 | 건강 점수 액션 카드 | `recommendNextAction()` + UI | 🔴 | 4시간 |
| P0-5 | "오늘의 30초" 통합 화면 | Dashboard 상단 새 카드 | 🔴 | 1일 |
| **1개월** |
| P0-6 | KPI funnel 위젯 (/admin 성장 탭) | logApiCall 이벤트 + 집계 | 🟠 | 2일 |
| P0-7 | Universe 편입 3중 AND 자동 검증 | enrich-listings → status='eligible' | 🟠 | 1일 |
| P0-8 | 멘토 6명 시연 영상 (5분) | NVDA 종목 6명 분석 비교 | 🟠 | 외부 작업 |
| P0-9 | KRX 한국 종목 자동 감지 | OpenDART API 등록 + cron | 🟠 | 2일 |

### Phase 1 완료 조건
- [ ] 결정적 결함 3개 모두 수정
- [ ] 사용자 피드백 100건 수집
- [ ] D1 retention 측정 가능
- [ ] PRO 결제 페이지 시안 (미공개)

---

## 🎯 Phase 2 — 베타 500명 (2~4개월)

### 목표
- 첫 매출 발생 (PRO + Affiliate)
- 차별점 마케팅 자산 확보
- 한국 사용자 만족 모순 해결

### Action Items

| # | 과제 | 방법 | 기대 효과 |
|---|---|---|---|
| P1-1 | PRO 결제 인프라 | 토스페이먼츠 통합 + `profiles.tier='pro'` | 첫 매출 |
| P1-2 | Affiliate 계좌개설 보상 | 증권사 1~3개 제휴 | 월 1~5만 추가 |
| P1-3 | 챕터 시즌제 강화 | 월말 D-7부터 카운트다운 + 회고 자동 생성 | 정서 묶기 |
| P1-4 | 마케팅 자산 4종 | 영상·카피·후기·데모 | 차별점 입증 |
| P1-5 | Vercel Pro 전환 | $20/월 — PRO 결제 페이지 출시와 동시 | ToS 안전 |

### Phase 2 완료 조건
- [ ] PRO 가입자 ≥ 5명
- [ ] Affiliate 매출 ≥ ₩10만/월
- [ ] WAU/MAU > 40%
- [ ] NPS > 30

---

## 🎯 Phase 3 — 베타 2,000명 (4~12개월)

### 목표
- 알고리즘 백테스트 + 가중치 최적화
- 단위 경제 증명
- Series A 펀딩 준비

### Action Items

| # | 과제 | 방법 | 기대 |
|---|---|---|---|
| P2-1 | 사용자 추천 효과 백테스트 | ai_chok_recommendations 6개월 + 행동 분석 | 알고리즘 정당성 |
| P2-2 | priorityScore A/B 테스트 | 가중치 3가지 조합 → 만족도 측정 | 가중치 최적화 |
| P2-3 | 멘토 페르소나 정량 검증 | 같은 종목 6번 분석 → 다양성 점수 | 멘토 효과 입증 |
| P2-4 | Series A 준비 | 단위 경제 + 5만 가입자 → 30~50억 평가 | 본격 성장 |

### Phase 3 완료 조건
- [ ] 월 매출 ≥ ₩1,000만
- [ ] PRO 전환률 ≥ 5%
- [ ] 백테스트 보고서 1건
- [ ] VC 미팅 ≥ 3건

---

## 📊 KPI 트래킹

### Phase 1 KPI (즉시 측정 시작)

| KPI | 측정 방법 | 목표 |
|---|---|---|
| D1 Retention | onboarding_complete → 익일 활성 | > 40% |
| D7 Retention | onboarding_complete → 7일후 활성 | > 20% |
| AI 추천 만족도 | 👍/👎 비율 | > 70% positive |
| 평균 일일 AI 호출 | per active user | 1.5~2.5 |
| 가입 → 첫 AI 촉 도달률 | funnel | > 80% |

### Phase 2 KPI

| KPI | 목표 |
|---|---|
| PRO 결제 전환률 | > 5% |
| WAU / MAU | > 40% |
| NPS | > 30 |
| Affiliate 매출 | ≥ ₩10만/월 |

### Phase 3 KPI

| KPI | 목표 |
|---|---|
| 월 매출 | ≥ ₩1,000만 |
| LTV / CAC | > 3 |
| 평균 사용 기간 | > 6개월 |
| Series A 시도 | ≥ 3 VC 미팅 |

---

## 🎨 마케팅 슬로건 (어필 포인트)

### 기존
> 폭풍우에도 흔들리지 않는 내 주식 비서

(시적, 약속 약함)

### 제안 (Phase 1~2 동안 A/B)

1. **"매일 2분, 내 종목이 어디 있는지 알게 됩니다"** (시간 + 가치 약속)
2. **"투자는 토스에서, 공부는 주비에서"** (포지셔닝 명확)
3. **"워런 버핏·피터 린치, 6명의 멘토가 매일 내 종목을 분석합니다"** (차별점 + 빈도)

### 핵심 차별점 메시지

| 경쟁자 | 주비의 차별점 |
|---|---|
| 토스증권 | "거래는 토스, 학습은 주비" |
| 챗GPT | "내 종목·내 평단가에 맞춘 분석. 매일 한 줄로." |
| 키움/미래에셋 | "단순 시세가 아닌 멘토 6명의 관점·건강 점수" |

---

## 🚧 트리거 대기 (조건 충족 시 자동 발동)

| 조건 | 액션 |
|---|---|
| PRO 결제 페이지 출시 | (1) Vercel Pro $20/월 즉시 전환 (2) 약관 제12조 "무료" 표현 갱신 (3) 변호사 1시간 상담 (4) 결제 인프라 토스페이먼츠 |
| 광고 매출 연 5,000만+ | 회색 지대 진입 — 변호사 검토 |
| 사용자 손실 클레임 | 즉시 변호사 |
| 금감원 시정조치 | 즉시 변호사 + 면책 메시지 강화 |
| 50,000명 도달 | Series A 펀딩 시도 |

---

## 📚 관련 문서

- [ALGORITHM_REVIEW.md](ALGORITHM_REVIEW.md) — 17개 알고리즘 정당성 9인 리뷰
- [BUSINESS_REVIEW.md](BUSINESS_REVIEW.md) — 시장성·수익성 9인 토론
- [BROKER_FEATURE.md](BROKER_FEATURE.md) — 증권사별 자산 관리 9인 회의 (2026-05-13)
- [NEXT_ACTIONS.md](NEXT_ACTIONS.md) — 통합 우선순위 목록 (즉시 실행 가능 + 사용자 액션 + 트리거)
- [THRESHOLDS.md](THRESHOLDS.md) — 임계값 SSOT + 재검증 우선순위
- [CRONS.md](CRONS.md) — Cron 운영 SSOT
- [NOTIFICATION_POLICY.md](NOTIFICATION_POLICY.md) — 알림 정책 SSOT

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-13 | 초안 작성. Phase 1 P0-1~5 즉시 진행 중. |
