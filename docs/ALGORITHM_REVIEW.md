# 알고리즘 정당성 리뷰 (9인 전문가)

> **작성일**: 2026-05-13
> **목적**: 솔비서(주비) 17개 단위 기능 알고리즘의 정당성·근거를 9인 패널 시점으로 검증
> **관련**: [THRESHOLDS.md](THRESHOLDS.md) (임계값 SSOT), [BUSINESS_REVIEW.md](BUSINESS_REVIEW.md), [ROADMAP.md](ROADMAP.md)

---

## 1. 알고리즘 인벤토리 (17개)

| # | 기능 | 위치 | 핵심 룰 | 🤷 모호함 |
|---|---|---|---|---|
| 1 | AI 촉 추천 | `src/app/api/ai-chok/route.ts` | Universe 157종 → VIX 양자화 → 35종 slice → AI 호출 → 섹터 다양성 강제 | 157종 선정 근거, slice 35 임의 |
| 2 | AI 분석 보고서 | `src/app/api/ai-analysis/route.ts` | Layer 0(투자유형) + Layer 1(공통) + Layer 2(멘토) + JSON 응답 | 멘토 가중치 비표준 |
| 3 | 건강 점수 (4축) | `src/utils/portfolioHealth.ts` | HHI(집중도)·effective sectors·목표설정·승률+WL ratio | HHI 경계값(0.18/0.25/0.40) 근거 약함 |
| 4 | 폴백 종목 점수 | `src/utils/chokFallback.ts` | (1-52w%)·30 + (1-min(PER/30,1))·30 + min(return/50,1)·20 | 가중치 임의 |
| 5 | 알림 발동 (20개 룰) | `src/utils/alertsEngine.ts` | 5% 근접, ±5% 급등락, 3% 52주, RSI 30/70 | 임계값 모두 임의 |
| 6 | 시그널 우선순위 | `src/utils/priorityScore.ts` | 0.35·z + 0.25·weight + 0.20·target + 0.20·memo | 가중치 근거 부재 |
| 7 | 시세 캐싱 | `src/hooks/useStockData.ts` | localStorage 10분 TTL + SWR | 10분 적합성 미검증 |
| 8 | 52주 위치 임계 | `src/components/portfolio/PortfolioSection.tsx` | < 0.3% 도달, < 3% 부근 | 3% 임의 |
| 9 | 기술지표 | `src/utils/technical.ts` | RSI(14), BB(20,2σ), MACD(12,26,9), Vol z-score | ✅ 교과서 표준 |
| 10 | 온보딩 3카드 | `src/components/onboarding/OnboardingFlow.tsx` | 가치 약속 (요약/촉/멘토) | PM 임의 선정 |
| 11 | 코치마크 4 핫스팟 | `src/components/onboarding/CoachMark.tsx` | 매크로/포트/촉/도움말 | IA 임의 |
| 12 | 샘플 포트폴리오 | `OnboardingFlow.tsx` | 005930.KS/AAPL/SPY | 대표주 임의 |
| 13 | AI 한도 (tier) | `src/lib/userTier.ts` | free 1+3, pro 30+30 | 회수 임의 |
| 14 | 컴플라이언스 lint | `src/utils/alertCompliance.ts` | 12개 금지 어휘 + 면책 | ✅ 잘 구성 |
| 15 | Universe 편입 | `src/config/chokUniverse.ts` | 수동 whitelist | 자동 검증 없음 |
| 16 | 멘토 6명 페르소나 | `src/config/mentors.ts` | 안정/가치/성장/배당/모멘텀/글로벌 | 가중치 없음 (AI 자유 해석) |
| 17 | 신규 상장 감지 | `src/app/api/cron/sync-listings/route.ts` | Finnhub diff + status 머신 | KS/KQ 미지원 |

→ 17개 중 **11개에 모호함**. 그러나 결정적 결함은 3개.

---

## 2. 9인 패널 시점 리뷰

### 패널 구성

| 시점 | 역할 |
|---|---|
| 📊 데이터 엔지니어 | 데이터 정확성·신뢰성 |
| 🧮 퀀트 분석가 | 알고리즘 수학적 정당성 |
| 🤖 ML/AI 엔지니어 | AI 프롬프트·멘토 룰 |
| 💰 금융 도메인 전문가 | 투자 이론 적합성 |
| 🏗️ 백엔드 아키텍트 | 시스템 일관성 |
| ⚖️ 컴플라이언스/법무 | 자본시장법 위반 가능성 |
| 🎨 UX 디자이너 | 알고리즘 결과의 사용자 가치 |
| 📈 통계 데이터 분석가 | 통계적 정당성 |
| 🔐 보안 전문가 | 데이터 처리 안전성 |

### 주요 발견

#### 📊 데이터 엔지니어
Universe 157종이 가장 큰 자산이자 부채. Finnhub 무료 한계로 KS/KQ 0건 — 한국 사용자 타깃 서비스가 한국 시장 자동 감지를 못 하는 모순. STOCK_KR 매핑은 37건 (사용자 검색 종목 매핑 0%).

#### 🧮 퀀트 분석가
건강 점수는 HHI 기반으로 학술적 근거 있음. 다만 4축 가중치(30+25+25+20)는 자의적. **백테스트도, 사용자 결과 추적도 안 함**. 개선: A/B 테스트로 가중치 검증.

#### 🤖 ML/AI 엔지니어
AI 촉 universe 35-slice + VIX bucket 캐시는 합리적. 그러나 멘토 6명 페르소나가 systemPrompt만 다르고 **수치 검증 없음** — 같은 종목을 6번 분석하면 정말 6가지 다른 결론이 나오는가? 검증 안 됨.

#### 💰 금융 도메인 전문가
**가장 큰 결함**: '12개월 상장 + 시총 $5B+ + 데이터 정상' universe 기준이 **문서에만 있고 코드에 없음**. 자본시장법상 'AI가 선별한 종목 리스트' 자체가 추천이고, 객관 기준 입증 없으면 분쟁 위험.

#### 🏗️ 백엔드 아키텍트
Tier 한도 작동하나 **합산 검증 없음**. 베타 100명 일일 400회 → 250 글로벌 한도 너무 작음. 5000명 시 일일 2만회 — 한도 재산정 필요.

#### ⚖️ 컴플라이언스/법무
FORBIDDEN_PHRASES + DISCLAIMER 잘 짜여있음. 하지만 2개 문제:
1. **AI 응답 텍스트 검증 안 됨** — Gemini가 '확실히 오릅니다' 생성 가능
2. 멘토 mentorVerdict/keyAdvice 필드 lint 검사 대상 외
→ **AI 응답 후처리 컴플라이언스 검증 필요**

#### 🎨 UX 디자이너
건강 점수 78점이 사용자에게 의미하는 게 명확하지 않음. '양호' 라벨은 있지만 78→80 올리려면 뭘 해야 하나? **액션 제안 없음**.

#### 📈 통계 데이터 분석가
priorityScore 가중치를 검증할 데이터가 있나? 추천 결과는 쌓이지만 사용자 행동(추가/거절)은 안 쌓임. **사용자 피드백 1탭 필요**.

#### 🔐 보안 전문가
데이터 처리 깨끗. PII cleanup 365일 + RLS + service role 분리 OK. 다만 CRON_SECRET 회전 메커니즘 없음.

---

## 3. 크로스 토론 합의

### 충돌 1: 임의 임계값 vs 백테스트
- 퀀트 + 통계: 모든 임계값 백테스트 필요
- 금융: 베타 단계에선 도메인 직관 OK
- **합의**: Phase 1 = 임계값 명문화 (`THRESHOLDS.md`), Phase 2 = 100명 데이터로 검증

### 충돌 2: AI 응답 컴플라이언스 검증
- 법무: 후처리 필수
- ML: 지연 위험
- **합의**: 응답 후 sanitize (replace) 또는 stream 후 비동기 검증

### 충돌 3: 점수가 사용자 가치인가
- UX: 숫자만으로 무의미
- 데이터: 데이터 표시 자체에 가치
- **합의**: 숫자 + 액션 카드 페어링

### 충돌 4: 멘토 효과 검증
- ML: 검증 안 됨
- UX: 페르소나 자체가 가치
- **합의**: 엔터테인먼트 가치 인정, 결과 객관성 주장 금지

---

## 4. 🔴 결정적 결함 (즉시 수정)

| # | 결함 | 영향 | 작업 |
|---|---|---|---|
| 1 | Universe 편입 기준 코드 미구현 | 분쟁 시 약점 | enrich-listings → 'eligible' 자동 승급 조건 (3중 AND) |
| 2 | AI 응답 컴플라이언스 후처리 부재 | 금지어 통과 위험 | `sanitizeAiOutput()` 함수 + ai-analysis 통합 |
| 3 | 건강 점수 액션 제안 부재 | UX 미완성 | `recommendNextAction(state)` 헬퍼 + UI 카드 |

---

## 5. 🟡 보강 (Phase 2)

| # | 과제 | 비고 |
|---|---|---|
| 4 | 임계값 SSOT 문서화 | [THRESHOLDS.md](THRESHOLDS.md) 작성 완료 |
| 5 | 사용자 피드백 수집 | AI 추천 카드 👍/👎 1탭 → `ai_feedback` 테이블 |
| 6 | 멘토 페르소나 마케팅 톤 조정 | "분석을 받아보세요" → "6가지 투자 철학으로 다르게 보세요" |

---

## 6. 누락 알고리즘 정립 제안

| 기능 | 현재 | 정립 제안 |
|---|---|---|
| Universe 편입 | 수동 whitelist | enrich-listings 통과 시 자동 'eligible' (3중 AND 코드 검증) |
| 사용자 추천 효과 | 측정 안 됨 | `priority_score_audit` 로그 + 주 1회 리뷰 cron |
| 건강 점수 → 액션 | 점수만 표시 | `recommendActions(state)` — 가장 큰 약점 1개 + 액션 |
| AI 응답 후처리 | 없음 | `sanitizeAiOutput()` — FORBIDDEN 검사 + 자동 replace |
| 알림 우선순위 | severity 1~5 정수 | severity = f(impact_to_pnl, urgency, user_consent) 가중합 |

---

## 7. 종합 결론

**현재 알고리즘 정당성**: 17개 중 11개 모호함. 결정적 결함 3개.
**개선 후**: 정당성 90% 달성 가능.
**제약**: 백테스트는 100명 사용자 누적 후만 가능. 그 전까지는 도메인 직관 + 문서화로 방어.

다음 단계는 [ROADMAP.md](ROADMAP.md) 의 Phase 1.
