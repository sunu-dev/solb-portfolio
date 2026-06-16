# 2026-06-16 — SpaceX IPO+추종 LETF 티커 알고리즘 리뷰 → 레버리지 가드 미국 커버리지 보강

> 흐름: 파운더 "6/12 SpaceX 상장 + 6/15 SpaceX 추종 레버리지 상품 출시 → 우리 티커 추가/제거 알고리즘이 제대로 표시하는지 리뷰 + 전문가 회의" → 코드 정독 → 3렌즈 적대적 패널(workflow, 25 에이전트) → 단일 루트커즈 적발 → 7단계 fix 전부 구현(브랜치).

## 작업 요약

### 1. 리뷰 (코드 정독 + 패널)
- 병렬 Explore 3건으로 파이프라인 정독: `sync-listings`(감지)·`enrich-listings`(분류·4중 AND 자동승급)·`leverageGuard.ts`(분류 SSOT)·`ai-analysis`·`search`·`ai-chok`·알림.
- Workflow 패널(조사→3렌즈→교차검증→종합): 19 finding 중 18 교차검증 통과. deep-research가 실제 발행사 LETF 작명 그라운딩(GraniteShares/Direxion/Defiance/T-REX/Leverage Shares).

### 2. 핵심 발견 (만장일치 루트커즈)
- **SpaceX 보통주**: ✅ 정상. classify='normal'이지만 상장 4일<12개월 → meetsUniverse=false → watch 유지. 검색 신규배지·보유 가능, universe 미편입 → AI촉/알림 제외. 의도된 객관기준 동작.
- **SpaceX 레버리지**: ⚠️ 부분 결함. 두 분류 함수가 **별도 정규식 + 같은 입력에 반대 판정**:
  - `isSingleStockLeverage`: 리터럴 `\b2X\b`+고정 미국티커 18개만 → 1.5X/3X/5X/Bull/Bear 누수.
  - `classifyAssetClass`: step4 한국어 `단일종목` 요구·step5 `2X` 미검사 → 미국 '2x Long SpaceX'를 'normal'로 → enrich 자동거부(leveraged_single/inverse_single에만) 0% 발동.
  - 결과: 검색 라벨·AI 분석 거부·매수유인 알림 억제·universe 자동거부가 비-2X에서 **동시 무력화** → §6 노출(AI가 상승 시나리오/positive 산출 가능).
- **과장 교정**: "universe 자동편입 시한폭탄(critical)"은 medium 하향 — (a) 자동은 eligible까지·universe는 admin수동+PR (b) admin PATCH 재차단 (c) AI촉은 하드코딩 CHOK_UNIVERSE 읽음 (d) 12개월 게이트. 진짜 라이브 위험은 universe가 아니라 **런타임 가드**.

### 3. 구현 (브랜치 `fix/leverage-guard-us-letf-coverage`, 미커밋·미배포, 12파일 +428/−100)
1. `leverageGuard.ts`: 공유 헬퍼 `detectLeverageProfile(symbol,name)→{isLeverage,isSingle,isInverse,multiple}` 신설, 두 함수 통합. 일반 배수 `/-?\b\d+(?:\.\d+)?X\b/`+영어 어휘. **단독 배수는 펀드 컨텍스트와 AND**(오탐 차단). 지수/단일 판별.
2. `__tests__/leverageGuard.test.ts`(신규): SpaceX 13종 양성 + 정상주 11종(10X Genomics·Build-A-Bear·iShares·US Steel 등) 음성 + 기존 동작 보존 불변식.
3. `ai-analysis/route.ts`: `isLev` 서버 권위화(service-role로 stock_listings.asset_class+서버 description 조회, 클라 body fallback OR). RLS=select using false라 service-role 필수.
4. `check-alerts/route.ts`: 푸시 발송 지점 asset_class 배치 조회 → forceLeverage 심층방어(닉네임 누수 차단).
5. `admin/listings/add/route.ts`: classifyAssetClass+!isUniverseEligibleClass면 status→watch 강등, asset_class 영속(기존엔 미설정).
6. `search/route.ts`+`useStockData.ts`+`SearchBar.tsx`: 응답 `isLeverage` 플래그 + 클라 칩/게이트 (서버 OR 로컬) 합집합.
7. (low) `admin/listings/enrich`: asset_class 동기화. `AnalysisPanel`: 신규IPO 박형데이터 배너 카피 분기(isThinData). `enrich-listings`: HOL 커서(+마이그 `2026-06-16_stock_listings_enrich_cursor.sql`).

### 4. 검증
tsc 0 · 신규 테스트 24+케이스 통과(SpaceX 전 배수 차단·정상주 음성) · mentorScores 통과 · lint:alerts/korean 0 · eslint main 대비 신규 0. formatKRW 4건 실패는 기존(무관).

## 결정사항 (왜)
- **패턴 일반화 + 컨텍스트 AND**: 배수 토큰 단독 매칭은 '10X Genomics'(TXG)·'Build-A-Bear'·'Ultra Clean' 오탐 → 정상주 부당 차단=universe 배제 사고. 그래서 배수는 펀드 컨텍스트와 AND, 영어 BULL/BEAR/LONG/SHORT는 배수 동반 필수. `LEVERAGED`(형용사)·한국어만 단독 허용. 회귀 불변식 테스트가 전제조건(패널 합의).
- **서버 권위화**: isLev이 클라 body description에만 의존 → 위변조·누락 시 유일 보호 무력화. asset_class+서버 description 우선, 행 없는 신규 상품만 클라 fallback.
- **단일/지수 기본값 single**: 불확실 시 보수적으로 단일(universe는 둘 다 부적격이라 무해, AI 거부는 단일만). 지수명 사전(S&P/QQQ/SEMICONDUCTOR…) 매칭 시 index.
- **migration 분리 + 배포순서 명시**: HOL 커서는 §6 무관·시나리오 무관 위생 이슈지만 파운더 "전체 다" 지시. 단 마이그 미적용 시 cron 500 위험 → 헤더+메모리+요약에 '코드 배포 전 선적용' 박제.
- **배포 게이트 유지**: 약관 v4 변호사 검토 전 production 금지 원칙 그대로. 코드는 브랜치 보관.

## 미해결 TODO
- [ ] **(배포 전) 마이그 `2026-06-16_stock_listings_enrich_cursor.sql` Supabase 선적용** — enrich-listings 코드보다 먼저.
- [ ] **변호사 게이트 추가 질문 2건** (PROFESSIONAL_REVIEW_REGISTER): 미국 LETF(1.5X/3X/5X) 보유 등록 허용 경계가 §6 회피선으로 충분한가 / 영구차단 근거를 '12개월 시간 게이트' 아닌 '상품 성격'에 둬야 하는가.
- [ ] **브랜치 머지 결정** — `fix/leverage-guard-us-letf-coverage`. 레버리지 정책 전체가 약관 v4 변호사 게이트 하라 배포 보류 중이므로 머지·배포 타이밍은 그 게이트와 함께.
- [ ] (별건, 사전존재) `formatKRW.test.ts` 4건 실패 — 축약 vs 전체표기, 테스트/구현 결정.

## 다음 세션 진입점
- 메모리 `project_leverage_single_stock_policy`에 2026-06-16 블록 박제 완료. 브랜치 `fix/leverage-guard-us-letf-coverage`에 12파일 스테이징(미커밋).
- 배포하려면: ① 마이그 선적용 ② 약관 v4 변호사 검토(기존 게이트) ③ 머지·배포. 그 전엔 브랜치 보관.
- BLOCKER#1(세무 v1 카나리)는 여전히 파운더 액션 대기 — 이번 작업과 독립.
