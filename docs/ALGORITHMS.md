# SOLB PORTFOLIO 알고리즘 문서

> 모든 핵심 컴포넌트의 알고리즘·로직을 체계화한 문서. 깊이 평가, 약점, 업그레이드 로드맵 포함.
> 마지막 갱신: 2026-04-25 · 베타 출시 직전 알고리즘 감사

## 깊이 분류

- **D (Deep)**: 다중 신호 결합, 검증된 통계 지표, 종목별 baseline 사용
- **M (Medium)**: 일반적 수식 기반, 임계값 일부 하드코딩, 결과 신뢰 가능
- **S (Shallow)**: 단순 평균/카운트, 임계값 모두 하드코딩, 결과 왜곡 위험

## 핵심 철학

**모든 임계값을 "절대값"이 아닌 "본인 베이스라인 대비"로 바꾸는 것이 단순 알고리즘과 깊은 알고리즘의 분기점이다.**

---

## 1. 시각화 / 분석

### 1.1 PortfolioHeatmap — `src/components/portfolio/PortfolioHeatmap.tsx`

**목적**: 보유 종목을 평가금액(면적) × 수익률(색)로 시각화 (Squarify 트리맵).

**알고리즘**:
- Squarify (Bruls et al. 2000) — 셀 종횡비 1:1에 가깝게 수렴
- 1% 최소 바닥(FLOOR) — 0.17% 같은 슬라이버 가시화
- Top-N(compact 6 / full 10) + "기타" 묶음 — 가중 평균 PnL
- piecewise 색 스케일 (±1/2/3/5/7%+, 0% 차콜)
- 자동 폰트 스케일(`minDim * 0.30`), Progressive disclosure

**깊이**: M
- ✅ Squarify 자체는 검증된 알고리즘
- ✅ Top-N 그룹핑으로 가시성 보장
- ⚠️ 색 임계값 하드코딩(±1~7%) — 종목별 변동성 무시. 저변동주(KO) 1% 변동도 고변동주(TSLA) 1%와 동일 색

**업그레이드 후보 (P3)**:
- 색 매핑을 z-score 기반으로 (`z = today_return / σ_30d`, |z|≥2면 진한 색)
- "기타" 그룹 변동(min/max/std) 툴팁에 표시

---

### 1.2 PortfolioHealth — `src/utils/portfolioHealth.ts`

**목적**: 4개 축(집중도/섹터분산/목표설정/손익밸런스)으로 100점 만점 건강 점수.

**현재 알고리즘**:
- 집중도(30점): 최대 비중 임계값 기반 단계 점수 (>70%→5, 50~70%→15, 35~50%→22, ≤35%→30)
- 섹터분산(25점): 고유 섹터 카운트 (1→5, 2→15, ≥3→25) — 비중 무시
- 목표설정(25점): 목표 설정 종목 비율 × 25
- 손익밸런스(20점): 승률 × 20

**깊이**: S
- ❌ 종목 수 무시 — 2종목 50% vs 20종목 50% 동일 평가
- ❌ 섹터 가중치 무시 — IT 95%/헬스 5% = IT 50%/헬스 50%
- ❌ 손실 규모 무시 — 5개 +1% / 5개 -50% vs 5개 +30% / 5개 -1% 동일 점수
- ❌ 목표 "달성"과 "설정만" 구분 없음

**업그레이드 (P1, 본 세션 대상)**:
- HHI(Herfindahl-Hirschman Index) 기반 집중도: `HHI = Σ(w_i)²`. 0.18 이하 양호, 0.25 이상 위험
- 섹터 effective N: `1 / Σ(w_sector)²` (가중치 반영)
- 손실 규모 가중: 단순 승률 → downside variance + 평균 손실률
- 목표 달성률 별도 트래킹

---

### 1.3 BenchmarkCompare — `src/components/portfolio/BenchmarkCompare.tsx`

**목적**: 포트폴리오 수익률을 시장(S&P 500)과 비교.

**현재 알고리즘** (⚠️ 결함 있음):
- 포트폴리오: 누적 수익률 `(현재가 - 평단) × 보유 / (평단 × 보유)`
- 벤치마크: `macroData['S&P 500'].changePercent` — **오늘 일일 변동률**

**깊이**: S
- ❌ **시간 축 불일치**: 누적(여러 달~년) vs 일중(오늘) 비교는 무효
- ❌ "포트폴리오 +15%(3개월) vs S&P 오늘 +1%" → 이겼다는 거짓 신호
- ❌ 통계적 의미 없음

**업그레이드 (P0, 본 세션 대상)**:
- 같은 기간 비교: 포트폴리오 YTD vs S&P YTD (또는 30일 vs 30일)
- 또는 알파 분해: `α = R_p - β·R_SPY` (60일 회귀)
- 기간 명시 라벨

---

### 1.4 GoalProgress — `src/components/portfolio/GoalProgress.tsx`

**목적**: 종목별 + 포트폴리오 가중 목표 진척률.

**알고리즘**:
- 가중 목표: `Σ(targetReturn_i × weight_i)`
- 가중 현재: `Σ(pnlPct_i × weight_i)`
- 진척률: 현재/목표 × 100, 종목별 정렬

**깊이**: M
- ✅ 비중 가중치 적용
- ⚠️ 평균이 양극단(달성+미달성) 가림: +30%(목표 20%) + -10%(목표 20%) = 평균 +10%로 두 실패 숨김
- ⚠️ 종목 비중이 시간에 따라 변해도 원래 목표는 고정

**업그레이드 후보 (P3)**:
- 분포 시각화 (분산 표시)
- "평균 vs 중앙값" 동시 표시

---

### 1.5 PortfolioDNA — `src/utils/portfolioDNA.ts`

**목적**: 4축 레이더(집중/변동성/성장/방어)로 캐릭터 타입(8개) 분류.

**알고리즘**:
- 집중: HHI + 최대 비중 보너스(>50% 시 +20)
- 변동성: 평균 |dp| × 15 — 오늘 일일 변동률 평균
- 성장/방어: 섹터/티커 하드코딩 리스트 (SECTOR_MAP)
- 타입: 4축 임계값 조합 → 8개 캐릭터

**깊이**: M+
- ✅ HHI 사용
- ⚠️ 변동성이 "오늘만" — realized vol(30일 std) 대신 사용
- ⚠️ 성장/방어가 고정 리스트 — 시장 환경 변화 반영 없음
- ⚠️ 타입 우선순위(집중>성장>방어>변동성) 경직

**업그레이드 후보 (P3)**:
- realized volatility (30일 σ) 사용
- 섹터 분류 동적화 (PER 기반 등)

---

## 2. 인사이트 / 회고

### 2.1 TradePatternMirror — `src/components/portfolio/TradePatternMirror.tsx` ★

**목적**: 사용자 메모(감정 태그) → 결과(현재가 대비) 거울. "분석 vs 충동" 비교.

**현재 알고리즘**:
- 메모 텍스트 정규식 파싱 → action 분류
- 결과: `(현재가 - 노트시점가) / 노트시점가 × 100`
- 감정별 그룹 평균
- 표본 ≥ 2일 때만 비교 인사이트 표시 (최근 수정)

**깊이**: M
- ✅ 표본 크기 가드 (N≥2)
- ⚠️ 시간 가중치 없음 — 1년 전과 어제를 동등 취급
- ⚠️ 처분효과 등 행동재무학 지표 부재
- ⚠️ 매수가 vs 직전 추세 무관 (고점 추격 패턴 미감지)

**업그레이드 (P1, 본 세션 대상)**:
- **처분효과 지표(Disposition Effect)**: `DE = PGR - PLR`
  - `PGR = 실현이익횟수 / (실현이익+미실현이익)`
  - `PLR = 실현손실횟수 / (실현손실+미실현손실)`
  - DE > 0.2 → "이익은 빨리 팔고 손실은 안고 가는" 전형
- **평균 보유기간 비대칭**: 손실 종목 평균 보유일 / 이익 종목 평균 보유일 비율
- **EWMA 시간 가중치**: 최근 90일 가중치 1.0, 그 이전 0.5로 감쇠
- **신뢰도 라벨**: 거래 < 5건 "저", 5~15건 "중", ≥ 15건 "고"
- **매수 타이밍 percentile**: 매수가가 직전 20일 [low, high]에서 차지하는 위치 평균

---

### 2.2 ThrowbackCard — `src/components/portfolio/ThrowbackCard.tsx`

**목적**: N일 전 vs 현재 비교 + "그때의 결정" 메모.

**알고리즘**:
- 스냅샷 우선 (±3일) → 없으면 retrospective(현재 보유 × 과거 종가)
- 메모: 활성 기간 ±50% 범위 내 노트
- 커버리지 < 40% 시 조용히 제외

**깊이**: M
- ✅ 스냅샷/retrospective 이중 모드, 시각 배지
- ⚠️ 메모 범위 ±50%가 자의적 — 통계적 근거 없음
- ⚠️ Best/Worst만 표시, 분포 정보 없음

---

### 2.3 MonthlyReplay — `src/components/portfolio/MonthlyReplay.tsx`

**목적**: 30일 회고 + 카드 공유.

**알고리즘**: 30일 전 종가 vs 현재가, 최고의 하루 추적, 메모 활동.

**깊이**: M
- ⚠️ "최고의 하루" 절대값(달러) 무시
- ⚠️ 시간대 차이(KST vs UTC) 보정 없음

---

### 2.4 ConversationalTimeline — `src/components/portfolio/ConversationalTimeline.tsx`

**목적**: 채팅 형태 내러티브 메시지.

**알고리즘**: 5섹션 메시지 (인사/오늘 움직임/목표 근접/52주/요약).

**깊이**: S
- ❌ ±3%, ±5% 모든 임계값 하드코딩 — 종목별 변동성 무시
- ❌ 절대 변동액($) 무시, 부호만 봄

**업그레이드 (P2)**:
- 종목별 z-score 임계값
- 절대 변동액과 % 동시 표시
- 메시지 우선순위 점수화

---

### 2.5 MorningBriefing — `src/components/portfolio/MorningBriefing.tsx`

**목적**: 1일 1회 모닝 브리핑 (어제 vs 오늘, 큰 움직임, 알림, 메모).

**알고리즘**: (S&P + NASDAQ) / 2 평균 → 4단계 라벨, 어제 스냅샷 비교, |dp| 최대 종목.

**깊이**: S
- ❌ S&P/NASDAQ 평균 왜곡 (성격 다른데 동등 가중)
- ❌ "상승/보합" 임계값 고정 (시장 변동 환경 무시)
- ⚠️ 어제 스냅샷 없으면 컴포넌트 자체 숨김 (근사 fallback 없음)

---

### 2.6 StockPulse — `src/components/portfolio/StockPulse.tsx`

**목적**: 30일 가격 ECG 파형.

**알고리즘**: min-max 정규화, CV 변동성, 부호별 색.

**깊이**: S+
- ⚠️ min-max 정규화는 극단값 민감 (robust scaling 권장)
- ⚠️ CV는 절대 비교 어려움 (realized vol 권장)

---

### 2.7 AiChokSection — `src/components/portfolio/AiChokSection.tsx`

**목적**: AI 종목 추천.

**알고리즘**: VIX 4단계 + 섹터 집중도 → 프롬프트 컨텍스트.

**깊이**: D (프롬프트 레이어)
- ✅ 투자자 유형/시장 사이클 명시적 주입
- ✅ 자본시장법 준수 어휘
- ⚠️ 응답 구조 단순 (확신도 등 부재)

---

## 3. 알림 / 이벤트

### 3.1 alertsEngine — `src/utils/alertsEngine.ts`

**목적**: 20개 단일 + 5개 복합 조건 → severity 1~5 알림 생성.

**알고리즘**:
- 가격: 손절·목표·52주
- 기술: SMA 교차, RSI(<30/>70), 볼린저, MACD
- 복합: RSI + 볼린저 + 거래량 동시 신호
- 우선순위: severity 1~2 모두, 3~5 top 25

**깊이**: D
- ✅ 다중 신호 결합
- ✅ 거래량 급증/급감 별도 추적
- ❌ 모든 임계값 하드코딩 (RSI 30/70, 52주 ±2~3% 등)
- ❌ 거래량 평균 20일만 (계절성/이벤트 무시)
- ⚠️ MACD histogram 강도 무시 (교차만 봄)

**업그레이드 (P2)**:
- 종목별 적응적 임계값 (z-score 기반)
- 신뢰도 등급 추가

---

## 4. AI / 분석

### 4.1 ai-analysis 프롬프트 빌드 — `src/app/api/ai-analysis/route.ts` + `src/config/analysisPrompt.ts`

**알고리즘**: 3-layer (User Type → 종목 판별 → 개인 상황 → 지표 종합 → 펀더멘털 → 결론).

**깊이**: D
- ✅ 지표 충돌 시 우선순위 명확
- ✅ 종목 유형(ETF/레버리지/개별주) 분기
- ⚠️ 52주 위치 5단계 고정 (계산값 직접 표시 권장)
- ⚠️ PER 섹터 벤치마크 수동 (동적 데이터 없음)
- ⚠️ 사용자 메모 단순 나열 (가중치 없음)

**업그레이드 (P2)**:
- 시그널 우선순위 점수: `0.35·|z| + 0.25·weight + 0.20·goal_proximity + 0.20·user_memo_recency`
- 시계열 사전 추출 ("20일선 위 12거래일째", "RSI 71 과매수 4일째")
- 메모 가중치: "분할매수 중" 메모 있으면 priority +0.3

---

### 4.2 InvestorTypes 분류 — `src/config/investorTypes.ts`

**목적**: 5문항 → 5타입 분류.

**알고리즘**: 점수 합산, 동점 시 diversified 우선.

**깊이**: M
- ❌ 5문항만으로 고정, 행동 데이터 미반영
- ❌ 가중치 1~3만 (질문별 영향도 무시)
- ❌ 사후 변경 불가 (재퀴즈 전까지)

**업그레이드 후보 (P3)**:
- 3차원 임베딩(가치-성장/단기-장기/집중-분산), 행동 데이터로 보정
- 신뢰도 표시 (거래 5건 미만 30%, 30건 이상 90%)
- 시간 추적 (분기별 변화 벡터)

---

## 5. 유틸 / 인프라

### 5.1 dailySnapshot — `src/utils/dailySnapshot.ts`

**목적**: 일일 스냅샷 저장/조회.

**알고리즘**:
- KST 보정 → YYYY-MM-DD
- 가장 가까운 스냅샷 찾기 (±toleranceDays)
- 365일 prune

**깊이**: M
- ⚠️ tolerance 고정 3일 (시장 휴일 보정 없음)
- ⚠️ 동점 처리 미정의 (배열 순회 순서 의존)

---

## 핵심 약점 종합

| 패턴 | 영향받는 컴포넌트 | 사용자 영향 |
|---|---|---|
| 하드코딩 임계값 | alerts, ConversationalTimeline, MorningBriefing | 종목별 노이즈/누락 |
| 시간 축 불일치 | BenchmarkCompare | 거짓 비교 신호 |
| 표본 크기 미검증 | TradePatternMirror(수정됨), MonthlyReplay | 통계적 의미 없는 평균 |
| 위험 가중 부재 | PortfolioHealth, GoalProgress | 위험 과소평가 |
| 시간 가중치 무시 | TradePatternMirror, ThrowbackCard | 오래된 데이터 동등 취급 |

---

## 업그레이드 로드맵

### P0 (즉시 — 거짓 신호) ✅ 완료
- [x] **BenchmarkCompare 시간 축 수정** (2026-04-25)
  - 포트폴리오 누적 vs S&P 일중 비교 → 둘 다 오늘 일일 변동률
  - "알파"(시장 대비 초과 수익) 명시
  - 누적 손익은 보조 정보로 (시간 축 다름 명시)

### P1 (이번 세션) ✅ 완료
- [x] **PortfolioHealth HHI 기반 재설계** (2026-04-25)
  - 집중도: HHI 0~0.4 비선형 매핑, Effective N 표시
  - 섹터분산: 1/Σ(w_sector)² (Effective Sectors), 가중치 반영
  - 목표설정: 설정율(15) + 달성율(10) 분리
  - 손익밸런스: 승률(12) + W/L Ratio(8) — 평균 이익/평균 손실 비율로 손실 규모 반영
- [x] **TradePatternMirror 시간 가중 + 신뢰도** (2026-04-25)
  - EWMA 시간 가중치: 90일 이내 1.0, 그 이전 지수 감쇠 (e^(-(d-90)/180))
  - 신뢰도 라벨(저 N<5 / 중 5~14 / 고 ≥15) 헤더 표시
  - 모든 평균(전체, 감정별)에 시간 가중치 적용

### P2 (다음 세션)
- [ ] **z-score 유틸 함수** — `src/utils/volatility.ts` (30일 EWMA σ, z-score 계산)
- [ ] **AlertsEngine 적응적 임계값** — z-score 기반
- [ ] **ConversationalTimeline 동적 임계값**
- [ ] **AI 프롬프트 시그널 우선순위 점수화**

### P3 (향후)
- [ ] **InvestorTypes 행동 보정**
- [ ] **PortfolioDNA realized vol** 사용
- [ ] **MorningBriefing 시장 심리 정교화**
- [ ] **Heatmap 색 z-score 매핑**

---

## 정합성 감사 (2026-04-25)

전체 코드베이스 수치/데이터 정합성 감사 결과. 핀테크 앱이므로 **실제 손실 가능 결함**은 즉시 수정.

### 🔴 즉시 수정 완료 (커밋됨)

#### C1-calc: 분수주 미지원 → parseFloat
- **파일**: `src/components/common/EditStockModal.tsx`, `src/components/portfolio/BuySimulator.tsx`
- **결함**: `parseInt(shares)`로 0.5234주 같은 분수주가 0 또는 정수로 잘림. OcrImportModal은 parseFloat로 분수주 받는데 EditStockModal에서 잘려 저장 → 종목별 평단·총평가 왜곡
- **수정**: 모든 shares 파싱을 `parseFloat`로 통일. Input에 `step="0.0001"` 추가. BuySimulator도 `Math.floor(x*10000)/10000`로 분수주 4자리 정밀도

#### C2-calc: 가중평균 환율 분모 오류
- **파일**: `EditStockModal.tsx:104-107`
- **결함**: `(USD 비용) / (USD 비용)` 형태 → 정의상 분모는 수량이어야 함. `|| 1` fallback이 oldCost=0에서 천문학적 환율 유발
- **수정**: `(oldShares × oldRate + addShares × addRate) / newTotalShares` (교과서 형태)

#### C3-data: snapshot 중복 dedup
- **파일**: `src/utils/dailySnapshot.ts:74`
- **결함**: 두 탭 동시 마운트 / KST 자정 경계에서 같은 date 2회 push. prune이 dedup 안 함
- **수정**: prune 내부 Map<date, snap> dedup. 같은 날짜 중복 시 totalValue 큰 것 보존 (시세 더 많이 로드된 시점)

#### C1-data: DB 덮어쓰기 race 차단
- **파일**: `src/lib/portfolioSync.ts`, `src/hooks/usePortfolioSync.ts`
- **결함**: loadPortfolioFromDB가 null만 반환해 "row 없음"과 "쿼리 실패"를 구분 못 함. 실패 시 caller가 save 호출 → 빈 localStorage가 DB의 실제 데이터를 삭제
- **수정**: `loadPortfolio()` 신규 함수 — `LoadResult` 타입(`'ok' | 'empty' | 'error'`)으로 명시 분기. error 시 save 절대 금지, initialLoadDone 응답 후에만 true. 기존 함수는 deprecated로 호환 유지

### ⚠️ 추가 발견 (P1, 다음 세션)

| ID | 결함 | 위치 | 위험도 |
|---|---|---|---|
| C2-data | 계정 전환 시 이전 데이터 잔존 | useAuth + usePortfolioSync | 🔴 |
| H1-calc | totalPLPct 분모 단위 혼재 | Dashboard.tsx:84 | 🟠 |
| H2-calc | fallback 환율 1400 무고지 | 다수 | 🟠 |
| H1-data | persist version/migrate 부재 | portfolioStore.ts | 🟠 |
| H4-data | 종목 삭제 시 notes Undo 부재 | portfolioStore.ts | 🟠 |
| M2-data | notes.date 형식 불일치 | InvestmentNotes vs EditStockModal | 🟡 |
| M3-data | 카테고리 자동 이동 시 idx race | portfolioStore.ts:282 | 🟡 |

### ❌ 검산 후 false alarm

#### C4-calc: 환차익 분해식 — 실제로는 정확
- 감사 에이전트 주장: `stockPnLWon + fxPnLWon ≠ plWon`, 교차항 누락
- 검산: `(price-avgCost)*shares*usdKrw + avgCost*shares*(usdKrw-purchaseRate)` = `shares*(price*usdKrw - avgCost*purchaseRate)` = `currentValueKrw - purchaseCostKrw` = plWon ✓
- **결론**: 분해식은 수학적으로 합 보존됨. 수정 불필요

---

## 통계/금융 용어 사전 (개발자용)

| 용어 | 정의 | 사용처 |
|---|---|---|
| HHI | Σ(w_i)² — 집중도 0~1 | PortfolioHealth |
| MCR | Marginal Contribution to Risk | PortfolioHealth (P3) |
| Effective N | 1 / Σ(w_i)² — 유효 종목/섹터 수 | PortfolioHealth |
| z-score | (x - μ) / σ — 표준 편차 단위 | Alerts (P2) |
| EWMA σ | RiskMetrics λ=0.94 지수 가중 변동성 | Alerts (P2) |
| Disposition Effect | PGR - PLR — 처분효과 | TradePatternMirror |
| Sharpe | (R̄ - R_f) / σ | TradePatternMirror (P3) |
| Realized Volatility | 일별 수익률 σ × √252 | DNA (P3) |
| Alpha | R - β·R_market | BenchmarkCompare (P3) |
