# 2026-05-12 — 신규 상장 종목 감지·검수 파이프라인 + UX 픽스 2건

> 이 세션은 [2026-05-12-ai-api-quota-redesign](2026-05-12-ai-api-quota-redesign.md) 이후의 후속 작업.

## 작업 요약

세션 후반부 큰 작업 3건 — 9인 회의 패턴으로 회의 → 합의 → 즉시 구현 → 배포까지 일관 진행.

### A. 52주 고점 카피 픽스 + 비로그인 샘플 진입 즉시화 (커밋 281dac3)

**이슈 1**: "KORU가 52주 고점 근처 (0.0%)" 모호 표현
- `PortfolioSection.tsx:318` highDist 기반 분기 미흡 → 0.0% = 신고가인데 "근처 (0%)" 로 표시
- 수정: `< 0.3%` → "52주 최고가 도달 🚀", `< 3%` → "52주 최고가 -X.X% 부근". 저점도 동일 패턴.

**이슈 2**: 비로그인 샘플 진입 느림
- 9인 회의에서 가설 다수 (addStock N번 fetch / 직렬 호출) 제기, **진단 결과 모두 거짓**.
- `addStock` 동기, `/api/quotes` 이미 batch API, candles 3개씩 병렬.
- 진짜 원인: 비로그인 첫 진입은 `solb_quote_cache` localStorage 부재 → 시세 fetch 도착까지 빈 화면.
- 수정: SAMPLE_PORTFOLIO에 `fallback: { c, d, dp }` 추가, 샘플 클릭 시 localStorage에 즉시 주입.
- `OnboardingFlow.tsx` + `PortfolioSection.tsx` 두 진입점 동일 적용.

### B. 신규 상장 종목 감지·검수 파이프라인 — Phase 1+2+3 (커밋 87ab552, +817 / −9, 9 files)

**회의 결과**: "계속 생성되는 티커" = 시장 신규 상장 (IPO/신규 ETF). 매일 외부에서 생성되는 종목을 어떻게 흡수할 것인가.

**합의된 아키텍처**:
```
[매일 cron] Finnhub /stock/symbol → diff → stock_listings 테이블
   ↓ Slack 알림 (universe 상폐 시 강조)
[Admin 검수] /admin → 📚 신규 상장 탭 → 상태 머신 + Gemini 한국어명
   ↓
[코드 PR] CHOK_UNIVERSE 갱신 (수동, 의도 보존)
[사용자 검색] /api/search → IN 절 1-query → "📅 신규" 배지 + "데이터 제한"
```

**Phase 1 — 감지 파이프라인** (구현 완료):
- `supabase/migrations/2026-05-12_stock_listings.sql`: 상태 머신 (`watch`/`eligible`/`universe`/`rejected`/`delisted`) + last_seen 트리거 + 인덱스 4종
- `/api/cron/sync-listings`: US/KS/KQ 병렬 fetch, diff 후 신규 insert/상폐 마킹, 1000개 청크 처리, Slack 알림 (universe 상폐는 별도 강조)
- `vercel.json`: 매일 UTC 00:00 (KST 09:00) 스케줄

**Phase 2 — Admin 검수** (구현 완료):
- `/api/admin/listings`: GET(필터+카운트) / PATCH(상태·한국어명·메모) / POST(Gemini 한국어명)
- `ListingsPanel.tsx`: 상태 칩 + 카운트, 인라인 편집, "🤖 한국어 자동" 버튼, universe 편입 시 한국어명 필수 가드
- `/admin` 새 탭 "📚 신규 상장"

**Phase 3 — 사용자 UX** (구현 완료, AI 안내는 후속):
- `/api/search`: stock_listings IN 절 1-query로 `isNewListing`/`listedAt` 부착
- `SearchBar`: "📅 신규" 배지 + "데이터 제한" 안내
- `useStockData.searchStocks`: `StockSearchResult` 타입 확장

**미진**: ai-analysis 신규 IPO 안내 (stock_listings 데이터 채워진 후 다음 세션)

## 결정사항

### 회의에서 도출된 큰 결정들

1. **자동 편입은 절대 안 함** — 큐레이터·법무 의견. cron은 감지만, 편입은 코드 PR + 운영자 검수.
2. **universe 편입 3중 조건 (AND)**:
   - 상장 12개월 이상
   - 시총 $5B (한국 1조원) 이상
   - PER/EPS/52주 데이터 fundamentals API에서 정상 fetch
   - → 자본시장법 유사투자자문업 회피, 임의 큐레이션이 아닌 객관 기준 입증
3. **검색 vs 추천 분리 강화** — 검색은 Finnhub 전체 자유, 추천은 CHOK_UNIVERSE 한정 (이미 분리됨). 6개월 이내 IPO만 "데이터 제한" 배지로 안전장치.
4. **한국어 표기 규칙** — 일반 기업은 한국 미디어 표기 (엔비디아, 테슬라), 글로벌 ETF는 영문 유지 (SPY, QQQ), 한국 ETF는 운용사 한국명 (KODEX, TIGER). Gemini 자동 생성 + 검수 워크플로.
5. **샘플 fallback 가격 = 코드 박힘** — 3~6개월마다 갱신 필요. TODO 등록.

### 진단으로 밝혀진 사실

- AI 호출 통제 정책 (앞 세션) 변경 후 빌드 자동 트리거 — 별도 작업 없음.
- 비로그인 샘플 느림의 진짜 원인은 캐시 부재, addStock·batch API 아님.
- 9인 회의의 가치: 가설 분기 → 실측 진단 → 진짜 원인 도출 패턴이 일관됨.

## 미해결 TODO

- 🔴 **Supabase migration 적용** — stock_listings 추가로 미적용 6건
- 🟡 `/api/cron/sync-listings` 수동 트리거 (첫 데이터 채움)
- 🟡 `docs/UNIVERSE_INCLUSION_CRITERIA.md` 작성 (회의 합의 객관 기준 문서화)
- 🟡 `ai-analysis` 신규 IPO 안내 추가 (다음 세션, stock_listings 데이터 후)
- 🟡 SAMPLE_PORTFOLIO fallback 가격 3~6개월마다 갱신
- 🟢 사용자가 검색·추가한 종목을 stock_listings에 즉시 insert (지금은 cron 매일 1회만)

## 다음 세션 진입점

1. 위 사용자 액션 3건 완료 확인 후
2. **온보딩/스타트 가이드 강화** — 새 주제. 사용자가 처음 왔을 때 안내가 빈약. (다음 회의)
3. 또는 `docs/UNIVERSE_INCLUSION_CRITERIA.md` 작성 (1시간 분량)

## 메모리 승급 자문

후보:
1. **신규 상장 감지·검수 파이프라인** — `project_listings_pipeline.md` 신규. 상태 머신 + cron + universe 편입 객관 기준. 운영 메커니즘 영속적.
2. **universe 편입 객관 기준** — `feedback_universe_inclusion.md` 신규. 회의에서 도출된 룰 (12개월/시총 $5B/데이터 정상). 향후 종목 추가 결정 시 자동 참조.

사용자 동의 시 승급.
