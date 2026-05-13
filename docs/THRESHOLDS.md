# Thresholds SSOT — 임계값 단일 진실 공급원

> **작성일**: 2026-05-13
> **목적**: 솔비서(주비) 코드 전체에 박힌 17개+ 임계값을 한 곳에 모아 근거·재검증 우선순위 추적
> **관련**: [ALGORITHM_REVIEW.md](ALGORITHM_REVIEW.md), [docs/CRONS.md](CRONS.md)

## 근거 라벨

- ✅ **표준** — 학술·산업 표준 공식
- 🎯 **경험** — 도메인 직관·합리적 추정
- 🤷 **임의** — 근거 없음, A/B 테스트 또는 백테스트 필요

---

## 1. 알림·시그널 임계값

| # | 임계값 | 위치 | 근거 | 재검증 우선순위 |
|---|---|---|---|---|
| 1 | 손절 근접 5% (price ≤ stopLoss × 1.05) | `alertsEngine.ts` | 🎯 | P2 |
| 2 | 목표 근접 5% (price ≥ targetSell × 0.95) | `alertsEngine.ts` | 🎯 | P2 |
| 3 | 일일 급등락 ±5% | `alertsEngine.ts` | 🎯 | P1 (변동성 큰 종목에 무딘 가능성) |
| 4 | 52주 위치 < 3% 근접 | `PortfolioSection.tsx:319` | 🤷 | P1 (어제 0.3% 추가했지만 3%는 그대로) |
| 5 | 52주 신고가/저가 도달 < 0.3% | `PortfolioSection.tsx:318` | 🎯 (0.3% = 거의 정확히 도달) | P3 |
| 6 | 푸시 종목당 24h 최대 3개 | `alertPolicy.ts` | 🎯 (피로도 방지) | P2 |
| 7 | 인앱 카테고리당 5개/일 | `alertPolicy.ts` | 🤷 | P2 |
| 8 | 알림 7일 ramp-up (신규 유저) | `alertPolicy.ts` | 🤷 | P2 (14일/30일 검토) |
| 9 | 토스트 60초 쿨다운 | `ToastAlert.tsx` | 🎯 | P3 |

## 2. AI 호출 한도

| # | 임계값 | 위치 | 근거 | 재검증 |
|---|---|---|---|---|
| 10 | Free: AI 촉 1회/일 | `userTier.ts` | 🤷 (PRO 전환 동기로 추정) | P1 (3회/일 vs 1회/일 비교) |
| 11 | Free: AI 분석 3회/일 | `userTier.ts` | 🤷 | P1 |
| 12 | Pro: 촉·분석 각 30회/일 | `userTier.ts` | 🤷 | P2 |
| 13 | 글로벌 일일 한도 250회 | `ai-analysis/route.ts:18` | 🤷 (Gemini 무료 한계 기반 추정) | P1 (5,000명 시 한계 도달) |
| 14 | Claude 일일 500회 | `aiProvider.ts:33` | 🎯 (비용 가드) | P3 |
| 15 | Rate limit aiAnalysis: 시간당 15회(로그인) / 3회(비로그인) | `rateLimiter.ts:21` | 🎯 | P3 |
| 16 | Circuit breaker: 5분 내 20회 + 50% 실패 → 1분 차단 | `circuitBreaker.ts:22` | 🎯 | P3 |

## 3. 건강 점수 (HHI 기반)

| # | 임계값 | 위치 | 근거 | 재검증 |
|---|---|---|---|---|
| 17 | 집중도 30점 만점: HHI ≤ 0.18 | `portfolioHealth.ts` | 🎯 (FCC 기준 0.15 유사) | P2 |
| 18 | 집중도 22점: 0.18~0.25 | 동일 | 🤷 | P2 |
| 19 | 집중도 10점: 0.25~0.40 | 동일 | 🤷 | P2 |
| 20 | 섹터 분산 25점: effective sectors ≥ 4 | 동일 | 🎯 | P2 |
| 21 | 목표 설정 점수: 15(설정) + 10(달성) | 동일 | 🤷 | P3 |
| 22 | 손익 밸런스: 승률 ×12 + WL ratio ×8 | 동일 | 🤷 | P2 |
| 23 | WL ratio cap 2.0 (손실 없을 때) | 동일 | 🎯 (편향 제거) | P3 |
| 24 | 라벨 경계: ≥80 건강 / ≥60 양호 / ≥40 주의 / <40 위험 | 동일 | 🤷 | P3 |

## 4. AI 촉 폴백 점수

| # | 임계값 | 위치 | 근거 | 재검증 |
|---|---|---|---|---|
| 25 | 52주 위치 가중 30점: (1 - week52%/100) × 30 | `chokFallback.ts` | 🤷 | P2 |
| 26 | PER 가중 30점: (1 - min(PER/30, 1)) × 30 | 동일 | 🤷 | P2 |
| 27 | 1Y 수익률 가중 20점: min(return/50, 1) × 20 | 동일 | 🤷 | P2 |
| 28 | Universe slice 35종 | `ai-chok/route.ts` | 🤷 (토큰 절약) | P3 |
| 29 | VIX bucket 경계: 15/20/25/30 | `ai-chok/route.ts:42-46` | 🎯 (VIX 표준 zone) | P3 |

## 5. 시그널 우선순위

| # | 임계값 | 위치 | 근거 | 재검증 |
|---|---|---|---|---|
| 30 | 가중치: 0.35·z + 0.25·weight + 0.20·target + 0.20·memo | `priorityScore.ts` | 🤷 | P1 (사용자 행동 데이터로 A/B) |
| 31 | memoRecency 반감기 14일 | 동일 | 🤷 | P2 |
| 32 | goalProximity 만점 구간 0.85~1.10 | 동일 | 🎯 | P3 |

## 6. 캐시·시세

| # | 임계값 | 위치 | 근거 | 재검증 |
|---|---|---|---|---|
| 33 | 시세 캐시 TTL 10분 | `useStockData.ts` | 🎯 (실시간 vs 비용) | P2 |
| 34 | candle 캐시: 일별 (날짜 키) | `useStockData.ts:269-288` | ✅ | — |
| 35 | macro 캐시 5분 | `useStockData.ts:159` | 🎯 | P3 |
| 36 | 뉴스 24h 우선, fallback 72h | `useStockData.ts:62-69` | 🎯 | P3 |

## 7. 기술 지표 (모두 표준 ✅)

| # | 임계값 | 위치 | 근거 | 재검증 |
|---|---|---|---|---|
| 37 | RSI 기간 14일 | `technical.ts` | ✅ Wilder | — |
| 38 | RSI 과매수 70 / 과매도 30 | 동일 | ✅ 표준 | — |
| 39 | Bollinger 20일, 2σ | 동일 | ✅ 표준 | — |
| 40 | MACD 12/26/9 | 동일 | ✅ 표준 | — |

## 8. 신규 상장 (Universe 편입)

| # | 임계값 | 위치 | 근거 | 재검증 |
|---|---|---|---|---|
| 41 | 상장 12개월 이상 | 회의록 (코드 미구현) | 🎯 | P0 (코드 구현 시급) |
| 42 | 시총 $5B (한국 1조원) 이상 | 회의록 (코드 미구현) | 🎯 | P0 |
| 43 | 데이터 정상 (Finnhub PER/EPS/52w) | 회의록 (코드 미구현) | 🎯 | P0 |
| 44 | 신규 상장 배지 6개월 이내 | `search/route.ts:10` | 🎯 | P3 |
| 45 | enrich-listings batch 40건/일 | `enrich-listings/route.ts` | 🎯 (Hobby 60s 안전 마진) | P3 |

## 9. 컴플라이언스

| # | 항목 | 위치 | 근거 | 재검증 |
|---|---|---|---|---|
| 46 | FORBIDDEN_PHRASES 12개 | `alertCompliance.ts` | ✅ (자본시장법 회피) | P1 (AI 응답 후처리 통합) |
| 47 | DISCLAIMER 면책 자동 첨부 | `alertCompliance.ts` | ✅ | — |
| 48 | PRO 결제 페이지 등장 = 즉시 Vercel Pro 전환 트리거 | (회의 메모리) | 🎯 | P1 |

## 10. Vercel·인프라

| # | 임계값 | 위치 | 근거 | 재검증 |
|---|---|---|---|---|
| 49 | Cron 일별 1회 (Hobby 한계) | `vercel.json` | ✅ (Vercel 공식 한계) | — |
| 50 | Function 60s maxDuration (Hobby) | (자동) | ✅ | — |
| 51 | Concurrent Builds 1 (Hobby) | (자동) | ✅ | — |

---

## 재검증 우선순위 요약

### P0 (즉시 코드 구현)
- #41~43: Universe 편입 3중 AND 조건 → enrich-listings 자동 승급

### P1 (1~2개월, 사용자 100명 데이터 누적 후)
- #4 (52주 3% 부근), #10~11 (AI 한도), #13 (글로벌 250), #30 (priorityScore 가중치)
- #46 (AI 응답 후처리), #48 (PRO 시점)

### P2 (3~6개월, 백테스트 가능 시점)
- #1~3 (알림 거리), #17~24 (건강점수 4축), #25~27 (폴백 점수), #33 (캐시 TTL)

### P3 (1년+, 안정화 단계)
- 나머지 (이미 표준이거나 미세 조정)

---

## 변경 정책

이 문서를 수정할 때:
1. 임계값 변경 시 **위치 + 근거 + 재검증 우선순위** 동시 갱신
2. 새 임계값 추가 시 P0~P3 라벨 부여
3. A/B 테스트 결과는 이 문서에 인용 (어느 임계값이 더 좋았는지)
4. ✅ 표준 라벨 변경 금지 — 표준 공식 위반 시 코드 자체가 깨진 것

---

## 외부 참조

- HHI (Herfindahl–Hirschman Index): https://en.wikipedia.org/wiki/Herfindahl–Hirschman_index
- Wilder's RSI: https://en.wikipedia.org/wiki/Relative_strength_index
- Bollinger Bands: https://en.wikipedia.org/wiki/Bollinger_Bands
- Vercel Hobby Cron 한계: https://vercel.com/docs/cron-jobs/usage-and-pricing
