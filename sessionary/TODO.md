# 미해결 TODO

이 파일은 세션 간 누적되는 미해결 작업 항목입니다.
세션 시작 시 자동 로드되며, 세션 종료 시 갱신합니다.

## 🎯 다음 세션 자동 브리핑 (2026-05-30+)

> **자동 로드 sessionary**: `2026-05-29-search-coverage-and-consent.md` (변호사 점검 + 동의 버전 정합화 + P0 5건 인지 갭 해소)
> **베타 D-6 상태**: 카운트다운 진행 중. 코드 BLOCKER 0건. 사용자 액션 BLOCKER 2건.
> **2026-05-29 (3) 완료**: 동의 버전 정합화(legalVersions SSOT) ✅ · P0 5건 인지 갭(검색 30→113종, 13/13 시세 검증) ✅ · §8 변호사 질문지 `docs/LEGAL_CONSULTATION_LEVERAGE.md` ✅. **단일종목 레버리지 차단 인프라 그대로 유지.**

### 🔴 즉시 우선순위 (BLOCKER)

1. **변호사 1시간 상담 예약** (자본시장법 전문, 30~50만원)
   - 메모리 [legal] 트리거 자동 발동 (2026-05-29 박제)
   - **질문지 완성**: `docs/LEGAL_CONSULTATION_LEVERAGE.md` (질문 10건 + 사업구조 + 현행 안전망, 변호사 지참용)
   - 트리거 사유: 사용자가 옵션 C(단일종목 레버리지 일반 분석) 선택 → 단계 2 진입 전 변호사 답변 필수
2. **Phase A — joobi.kr 결제 + Vercel Add Domain + DNS + Resend**
   - 가비아 결제 진행 중 (메모리 [solb_status])
   - 결제 완료 후 자동 진행 흐름: sessionary/2026-05-20 + 5/18 박제
   - 트리거 단어: "결제 완료", "joobi.kr 진행하자", "Phase A 진행"
3. **카나리 24h 페르소나 5명 모집** (사용자 직접)
   - 다증권사 30대 iOS · 1증권사 20대 Android · **Samsung Internet** 30대 · **카카오 인앱브라우저** 20대 · PC desktop 30대

### ✅ 정책 무관 P0 5건 — 2026-05-29 (3) 완료 (검증 통과)

한국 종목 커버리지 확장 — 사용자 인지 갭 직접 해소. tsc 0 · lint 0 · 앱 실검증 13/13 시세 정상.
- [x] ~~검색 30→113종~~ — `kr-quote/route.ts`가 `KOREAN_UNIVERSE`(100) 재활용 + 우선주 8·ETF 5 보강. "삼성전" 1~2 → 4건
- [x] ~~검색 EmptyState 3분기~~ (차단·한국어오타·영문오타) — `SearchBar.tsx`
- [x] ~~자산 클래스 칩~~ — `utils/searchAssetClass.ts` 신설(표시 전용). **중립 회색**(Amber 원안에서 편차) → 🟡 색상 최종 확정 필요
- [x] ~~assetClassOrder 정렬~~ (보통주→ETF→우선주→혼합)
- [x] ~~admin add "단일종목" lint~~ — description+kr_name 둘 다 검사

### 🟡 위 후속 (2026-05-29 (3))
- [x] ~~칩 색상 최종 확정~~ — **중립 회색 확정** (사용자 결정 2026-05-29, 디자인 메모리 부합)
- [ ] **검색 커버리지 더 확장** — 채권혼합 ETF 등 → KRX 마스터 CSV (V1.2)
- [ ] **기존 사용자 약관 v3 재동의 고지 확인** — 로그인 유지 중 사용자는 재로그인 전까지 DB v2. 변경 고지 이력 점검

### 📋 2026-05-29 오늘 누적 (7 커밋)

1. **5인 디자인 패널 + 한국어 UI 시스템 SSOT 격상** (`3f727cb` `46fc031`) — 문서/유틸 3/lint/메모리 2 SSOT 골격 박제
2. **격식 어휘 66건 sweep + lint:korean strict 격상** (`60de522` `125d134`) — 25 files 변환, prebuild strict
3. **`<br />` 1차 sweep 9건 + 카테고리 표** (`95d883c` `f36a243`) — 40+ → 31 baseline, KOREAN_UI_SYSTEM §3.1 보강
4. **9인 패널 + 정책 재검토 + 변호사 상담 트리거 박제** (`f66b234`) — 코드 변경 X, sessionary 270줄 박제

### ⚠️ 작업 시 주의

- **단일종목 레버리지 차단 인프라 그대로 유지** (변호사 답변 전 해체 X) — leverageGuard SSOT · 5축 차단 · 약관 v3 · DB CHECK constraint 모두 보존
- **메모리 정책 SSOT 그대로** — `project_leverage_single_stock_policy` 정정·archive 보류
- **lint:korean strict 가동 중** — 격식 어휘 추가 시 빌드 차단. `koreanCopy.toTossTone()` 사용 또는 직접 구어체

## 진행 중

- [x] ~~**🟡 Obsidian export** — 2026-05-13~05-20 세션 결과물 13건을 `~/Dev/Obsidian/sunu-space/00_Inbox/from-projects/solb-portfolio/`로 export 완료 (2026-05-20)~~

## 🆕 2026-05-29 세션 (2) — 단일종목 레버리지 정책 재검토 (9인 패널 + 변호사 상담 트리거)

> **종합 문서**: `sessionary/2026-05-29-leverage-policy-review.md`
> **사용자 호소**: "삼성전자 레버리지 검색 안 됨, 토스와 뭐가 다른지" → "무료면 상관없지 않아?" → 옵션 C(일반 종목 동일 분석) 선택
> **결과**: 9인 패널 만장일치 "유지" 권고 + 사용자 옵션 C 결정 + 메모리 [legal] 트리거 발동 → **단계 1만 박제, 코드 변경 보류**

### 결정 박제 ✅
- [x] ~~9인 패널(3분야×3인) 결과 + 만장일치 "차단 유지" 의견 + 사용자 옵션 C 결정 박제~~
- [x] ~~정직한 자본시장법 분해 (§6·§101 회색 지대 vs 안전 영역) sessionary 박제~~
- [x] ~~변호사 상담 질문 목록 10건 작성 (sessionary §8)~~
- [x] ~~단계 1~6 진행 계획 박제~~
- [x] ~~코드·약관·메모리 변경 보류 — 변호사 상담 후 단계 3~6 진행~~

### 🔴 단계 2 (BLOCKER, 사용자 액션)
- [ ] **자본시장법 전문 변호사 1시간 상담 예약** (30~50만원, 스타트업·핀테크 전문)
- [ ] 변호사 상담 후 답변 정리 → 단계 3 진입

### 🟡 단계 3~6 (변호사 답변 후)
- [ ] **약관 v4 작성** (변호사 검토) — 제5조 단일종목 레버리지 분석 활성화 시 면책 강화
- [ ] **메모리 정정/archive** — `project_leverage_single_stock_policy.md` · `feedback_risk_product_guard_pattern.md`
- [ ] **코드 단계적 해제** — 검색 → 보유 → 분석 순. leverageGuard SSOT 부분 해체
- [ ] **안전 마진 강화** — 손실 경고 모달·적합성 자가 점검·강제 경고 띠·증거 로깅 확장
- [ ] **카나리 4일** (5명 페르소나 + 모니터링)
- [ ] **Production 승격**

### ✅ 정책과 별개 (9인 패널 P0 5건) — 2026-05-29 (3) 완료
- [x] ~~검색 30→113종~~ (KOREAN_UNIVERSE 재활용 + 우선주 8·ETF 5) — `src/app/api/kr-quote/route.ts`
- [x] ~~검색 EmptyState 3분기~~ — `src/components/portfolio/SearchBar.tsx`
- [x] ~~자산 클래스 칩~~ — `src/utils/searchAssetClass.ts` (표시 전용 SSOT)
- [x] ~~assetClassOrder 정렬~~
- [x] ~~admin add "단일종목" lint~~ (description+kr_name)
> 상세·후속: 본 파일 최상단 "다음 세션 자동 브리핑" + `sessionary/2026-05-29-search-coverage-and-consent.md`

### ✅ 동의 버전 정합화 — 2026-05-29 (3) 완료
- [x] ~~`legalVersions.ts` SSOT 신설~~ — terms v2→v3 결함 수정. 화면·동의로깅·DB 버전 단일화. 4파일 연결.

## 🆕 2026-05-29 세션 — 한국어 UI/UX 시스템 SSOT 격상 (5인 패널 + 자성)

> **종합 문서**: `sessionary/2026-05-29-korean-ui-system.md`
> **사용자 호소**: "이런 어절에 대해서는 기본적인 ui/ux 의 알고리즘 골력이 갖워 있어야 하지 않나?"
> **결과**: 5인 디자인 패널 + 자성 → 한국어 UI 시스템 SSOT 격상. 산발 룰을 단일 골격으로 통합 (문서 1 + 유틸 3 + lint 1 + 메모리 2).

### 코드·문서 반영 완료
- [x] ~~Phase A: `docs/KOREAN_UI_SYSTEM.md` 신설 (8개 룰 카테고리 + 유틸 매핑 + 시스템 부재 신호 인지 룰)~~
- [x] ~~Phase B: 유틸 3개 신설 (`koreanNumber.ts`·`koreanDate.ts`·`koreanCopy.ts`)~~
- [x] ~~Phase C: `scripts/lint-korean.mjs` + strict/soft 모드 + `prebuild` 통합 (soft)~~
- [x] ~~Phase D: 메모리 승급 (`project_korean_ui_system.md` 신설 + `feedback_panel_audit_methodology` 보강)~~
- [x] ~~`globals.css` body word-break: keep-all + monospace reset (P0, 사용자 호소 1차)~~
- [x] ~~`LoginModal.tsx` 면책 영역 `<br />` 제거 + 카피 simplify (P0, 사용자 호소 1차)~~

### 검증
- [x] ~~`npx tsc --noEmit` 통과~~
- [x] ~~`npm run lint:alerts` 통과~~
- [⚠️] **`npm run lint:korean` 66건 위반 검출 (V1.2 sweep 대상, soft로 prebuild 통과)**
- [x] ~~`npm run prebuild` 통과~~

### 🟡 V1.2 sweep (P1)
- [x] ~~**격식 종결 어휘 66건 sweep**~~ — 자동 sed 일괄 적용 + 예외 경로 추가 (koreanCopy.ts·analysisPrompt.ts) → **lint:korean 0건** + **prebuild strict 격상 완료** (2026-05-29 같은 세션)
- [x] ~~**`<br />` 1차 sweep**~~ — 40+ → 31 (9건 자연 위임 제거: InviteGate·SettingsPanel 5·CohortReference·ChapterKeywordPrompt·ChapterShelf). KOREAN_UI_SYSTEM.md §3.1에 카테고리 분류 표 박제 (2026-05-29 같은 세션)
- [ ] **`<br />` V2 후속 — 의도 라벨링 + ESLint plugin 검출** — 31건 시각 의도 유지분에 `{/* keep-br: tagline */}` 라벨 추가 + ESLint plugin에서 한국어 사이 검출 + 화이트리스트 인지
- [ ] **`formatKrw`·`formatPct` 컴포넌트 통합** (Dashboard·MergedHoldingsCard·MorningBriefing 등 산발 포맷 통합)
- [ ] **`formatRelativeKo` 적용** (newsCacheTimes "방금 갱신" 배지 등)
- [ ] **디자인 토큰화** (`--text-korean-wrap`, `--text-korean-body` V1.2 토큰 시스템 확장)
- [ ] **ESLint 커스텀 룰 격상** (prebuild 스크립트 → ESLint plugin, IDE 인라인 경고)

### 🟡 V2
- [ ] 영문 단어 발음 받침 룰 (l/m/n/ng 영문 처리)
- [ ] AI 응답 자동 toTossTone 적용 (analysisPrompt 결과·멘토 카드, 면책 영역 제외)

### 패널 운영 — 시스템 부재 신호 인지 룰 (메모리 박제 완료)
모더레이터가 패널 결과 받으면 항상 4개 질문 자성:
1. 매번 패널이 발견할 일인가, 시스템화로 끝날 일인가?
2. 비슷한 사례가 다른 화면에 N개 있는가?
3. 빌드 시 검증으로 자동화 가능한가?
4. 메모리 승급 가치 있는 영속 사실인가?

→ 2개 이상 YES = 시스템 격상 (문서 + 유틸 + lint + 메모리 4축 동시 박제)

## 🆕 2026-05-28 세션 (2) — 검색 UX·연관 종목 8인 패널 (P0 4건 코드 ✅)

> **종합 문서**: `sessionary/2026-05-28-search-ux-panel.md`
> **사용자 호소**: "삼성전자 검색 시 005930.KS가 먼저 나오는게 맞나? 토스는 연관 종목 보여주는데 여기는 그것도 아니네"
> **결과**: 4분야×2인=8인 패널 만장일치 → P0 4건 (3개 파일) 즉시 + P1 연관 종목 V1.2 후속

### 코드 반영 완료 (P0 4건, 3개 파일)
- [x] ~~P0-1: SearchBar `getDisplayName()` + `getInitial()` helper + JSX 위계 반전 (종목명 15pt/700 메인 + 종목코드 12pt monospace 보조)~~
- [x] ~~P0-2: 좌측 회색 원 `symbol.charAt(0)` → `getInitial(item)` (한글/영문 첫 글자, 노이즈 제거)~~
- [x] ~~P0-3: FORBIDDEN_PHRASES 3구 추가 ('인기 종목'·'같이 사는'·'함께 매수') — V1.2 연관 종목 사전 준비~~
- [x] ~~P0-4: 약관 v3 제2조 1문단 추가 ("연관 정보=객관 기준 정보 제공, 매매 권유 아님") + universe 기준에 '자산 클래스' 명시~~

### 검증
- [x] ~~`npx tsc --noEmit` 통과~~
- [x] ~~`npm run lint:alerts` "금지 어휘 검출 없음"~~

### 🟡 V1.2 후속 (P1, 출시 후 1~2주)
- [ ] **`src/utils/relatedSymbols.ts` SSOT 신설** — `getRelatedSymbols(symbol, limit)` 함수, chokUniverse.sector + isBlockedLeverage 강제 필터 + 시총대 ±50% 가중
- [ ] **종목 상세 페이지 하단 "같은 산업의 다른 종목" 4칸 카드** (같은 sector 3개 + 대표 ETF 1개 + 라벨)
- [ ] **`STOCK_KR` 30종에 sector 필드 추가** 또는 `koreanUniverse.ts` 신설 (한국 종목 sector 매핑)
- [ ] **면책 카피 통합**: "같은 산업 분류 기준 안내이며 매수·매도 추천이 아니에요"

### 🟡 V2 (PRO 차별점)
- [ ] **6축 mentorScores 유사도 기반 "성향 비슷한 종목"** PRO 도구
- [ ] **AI 촉 "이 종목과 ○○의 차이" 비교 학습 카드** (PRO 전용)

### 🚫 P2 (영구 금기)
- 개인화 점수·인기순 정렬 도입 절대 금지
- "추천" 어휘 절대 금지 (FORBIDDEN_PHRASES 박제)
- 단일종목 레버리지/인버스 연관 추천 노출 절대 금지

### 권고 어휘 매트릭스 (법무 SSOT)
| 안전 ✅ | 회색 ⚠ | 위험 ❌ |
|---|---|---|
| **같은 산업의 다른 종목** ★ | 관련 종목 | 추천 종목 |
| 같은 섹터 종목 | 함께 보는 종목 | 인기 종목 |
| 같은 업종 기업 | 참고 종목 | 이 종목 사면 같이 |

## 🆕 2026-05-28 세션 — 단일종목 레버리지 ETF/ETN 5분야 패널 (P0 8건 코드 ✅)

> **종합 문서**: `sessionary/2026-05-28-leverage-single-stock-panel.md`
> **사건**: 2026-05-27 KRX 단일종목 레버리지 18종(ETF 16+ETN 2, 4.3조원) 사상 최초 동시 상장 → 사용자가 막 검색 시작할 시점에 베타 D-6.
> **결과**: 외부 조사 + 5분야 20인 패널 → 만장일치 결론(universe 영구 배제 + 진입점 5곳 일관 차단) → P0 8건 동일 세션 반영 (9개 파일).

### 코드 반영 완료 (P0 8건, 9개 파일)
- [x] ~~P0-1: `src/utils/leverageGuard.ts` SSOT 신설 (deny-list + 정규식 + 카피)~~
- [x] ~~P0-2: `search/route.ts` Finnhub filter에 isBlockedLeverage 추가~~
- [x] ~~P0-3: `admin/listings/add/route.ts` POST 400 reject 분기~~
- [x] ~~P0-4: `analysisPrompt.ts` "단일종목 레버리지·인버스 ETF/ETN (분석 거부 대상)" 새 분기 + 한국 520xxx·미국 TSLL/NVDU 명시~~
- [x] ~~P0-5: `alertsEngine.checkAllAlerts` 진입 filter (모든 알림 6개 루프 차단) + `morning-brief.buildBrief` filter~~
- [x] ~~P0-6: 약관 v2 → v3 시행 (2026-05-28), 제5조 "분석 대상 제외" + 제7조 음의 복리·예탁금·발행사 신용 면책~~
- [x] ~~P0-7: `alertCompliance.FORBIDDEN_PHRASES` 9구 추가 (레버리지·인버스·곱버스 권유) + SAFE_REPLACEMENTS~~
- [x] ~~P0-8: SearchBar EmptyState 분기 + handleAdd alert (localStorage·옛 데이터 경로 차단)~~

### 검증
- [x] ~~`npx tsc --noEmit` 통과~~
- [x] ~~`npm run lint:alerts` "금지 어휘 검출 없음"~~

### P1 후속 — 같은 세션 진행 완료 (7/10 ✅ + OCR 보너스 + 3건 V1.2 분리)

> 상세: `sessionary/2026-05-28-leverage-single-stock-panel.md` P1 후속 단락

- [x] ~~**`stock_listings.asset_class` 컬럼 마이그레이션** + `enrich-listings` 자동 태깅~~ — 🆕 마이그 `2026-05-28_stock_listings_asset_class.sql` + `classifyAssetClass()` SSOT
- [x] ~~**출생연도 입력 14세 게이트 강화**~~ — LoginModal 단순 체크박스 → 출생연도 4자리 입력 + 자동 검증
- [x] ~~**`mentorScores.getAssetType()` 한국 단일종목 레버리지 분기**~~ — **algorithm critical #1 해결**. classifyAssetClass + STOCK_KR fallback
- [x] ~~**`ai_chok_recommendations` CHECK constraint**~~ — 🆕 마이그 `2026-05-28_ai_chok_recommendations_constraint.sql` (한국 ETN 5xxxxx DB-레벨 차단)
- [x] ~~**THRESHOLDS.md 4번째 룰**~~ — #46 박제 + #41-43 ✅ 표시
- [x] ~~**ai-chok/route.ts에 isBlockedLeverage 보강**~~ — universe slice + logRecommendations insert
- [x] ~~**OCR 가드 추가 (보너스)**~~ — OcrImportModal applyToPortfolio에 isBlockedLeverage + skippedLeverage 카운터 + done 화면 ⚠ 표시
- [x] ~~**Phase D — Supabase 마이그 2건 적용** (2026-05-28)~~ — asset_class · ai_chok_recommendations CHECK 모두 적용 완료

### 🟡 V1.2 분리 (ROI 검토 후, 베타 출시 후 사용자 피드백 보고 재조정)
- [ ] **종목 카드 Amber 띠 (P1-G)** — PortfolioSection 600줄+ 변경 필요, 진입점 차단으로 보유 카드 진입 사실상 0건 → 시각 안전망 가치 < 비용
- [ ] **보유 등록 2단계 동의 모달 (P1-H)** — 5개 진입점이 모두 차단해서 모달 발동 시나리오 없음. 안전망 가치 매우 낮음
- [ ] **"왜 안 다루나요?" 풀시트 (P1-J)** — SearchBar EmptyState 카피로 이미 충분, 풀시트 신설은 중복

### 🟡 V2 분리 (외부 정보 필요)
- [ ] **ETF 16종 정확한 종목코드 KRX 공시 확인** → `LEVERAGE_DENY_SYMBOLS` 보강. 현재는 종목명 정규식 + 한국 ETN 5xxxxx 패턴으로 임시 차단(ETN 2종만 확정 deny-list)

### 🚫 P2 (영구 금기 — 절대 하지 않음)
- AI 촉 유니버스 편입 (chokUniverse.ts에 단일종목 레버리지 추가 금지)
- 점진 노출·임의 화이트리스트 (§6 트리거)
- PRO 차별점 도구로 노출 (§101 직격)
- 마케팅·SNS·인플루언서 '단일종목 레버리지'·'2배'·'곱버스' 어휘 (광고심사법 §3 + 자본시장법 §57)
- KIS Developers·KRX OpenAPI 인프라 구축 시도 (V2 별도 결정)

## 🆕 2026-05-20 세션 — 20인 패널 종합 감사 (P0 18건 코드 ✅)

> **종합 문서**: `docs/BETA_D6_PANEL_AUDIT.md` (5분야 회의 결과 + 반영 + 사용자 액션 + P1/P2)

### 코드 반영 완료 (18건)
- [x] ~~P0-1: check-alerts cron GET 핸들러 추가 (POST→POST+GET 분기)~~ — 알림 100% 누락 차단
- [x] ~~P0-2: ai_chok_cache admin client (anon → service-role)~~ — Gemini quota 폭발 차단
- [x] ~~P0-3: ai_chok_recommendations admin INSERT~~ — 백테스트 누적 활성화
- [x] ~~P0-4: codes/validate body userId → token 검증~~ — 보안
- [x] ~~P0-5: user_consents·user_profiles_tier 마이그 git 복구~~
- [x] ~~P0-6: technical.ts historicalNote 환각 통계 제거~~
- [x] ~~P0-7: getChartShapeSummary "70% 확률" 제거~~
- [x] ~~P0-8: 환율 fallback 1400 사용 시 console.error → Sentry 캡쳐~~
- [x] ~~P0-9: 검색 API 비-USD/비-KRW 종목 차단 (.T/.HK/.L 등)~~
- [x] ~~P0-10: 종목당 일일 푸시 3개 cap (NOTIFICATION_POLICY §3.1)~~
- [x] ~~P0-11: "SOLB" 7곳 → "JOOBI" + invite prefix `SOLB-`→`JB-`~~
- [x] ~~P0-12: "폭풍우" 3곳 → "내 주식, 매일 한 줄로 읽어드려요"~~
- [x] ~~P0-13: LoginModal·Header 빨강 J → Mossy Teal~~
- [x] ~~P0-14: alert_log silent fail 제거 + sendCronAlert~~
- [x] ~~P0-15: notification_log 마이그 + morning-brief 멱등성 가드~~
- [x] ~~P0-16: cronAlert 유틸 신설 + check-alerts·morning-brief 적용~~
- [x] ~~P0-17: OCR 카피 "처리 후 즉시 폐기" 정확화~~
- [x] ~~P0-18: 인앱 버그 신고 채널 (bug_reports + /api/feedback/report + /help 폼)~~

### 🔴 사용자 액션 (D-6 안 필수) — Phase A~G
- [ ] **Phase A**: 가비아 joobi.kr 결제 완료 + Vercel Add Domain + 가비아 DNS + Resend 가입 + SPF/DKIM TXT
- [ ] **Phase B**: Sentry 가입 + DSN 복사
- [ ] **Phase C**: Vercel env 입력 — `RESEND_API_KEY` `EMAIL_FROM` `NEXT_PUBLIC_SENTRY_DSN` `SENTRY_DSN`
- [x] ~~**Phase D**: Supabase SQL Editor에 2건 적용 — `2026-05-20_notification_log.sql` · `2026-05-20_bug_reports.sql` (2026-05-20 완료)~~
- [ ] **Phase E**: 카카오 콘솔·Supabase Auth Redirect URLs production만 화이트리스트
- [ ] **Phase F**: Slack workspace + 채널 4개 (#beta-bug, #beta-alert, #beta-deploy, #beta-feedback) + Vercel env `SLACK_WEBHOOK_CRON` `SLACK_WEBHOOK_BUG`. 카카오 오픈채팅방 개설
- [ ] **Phase G**: Redeploy + Sentry test event + morning-brief 수동 트리거 + /help 신고 폼 검증

### 카나리 24h 페르소나 화이트리스트 (운영 패널 합의)
- [ ] 다증권사 30대 (iOS Safari)
- [ ] 1증권사 20대 (Android Chrome)
- [ ] **Samsung Internet** 30대 (필수)
- [ ] **카카오 인앱브라우저** 20대 (필수)
- [ ] PC desktop 30대

### 합의된 출시 일자
- [ ] **5/26(월) 권고** — 5/22(금)은 risk-adjusted 음수. joobi.kr 5/21 이전 완료 시 카나리 4일 가능

## 🆕 2026-05-19 세션 결과물 (베타 D-7 BLOCKER 묶음 — 코드 ✅)

> 상세: `sessionary/2026-05-19-news-tab-p0.md` + `sessionary/2026-05-19-logout-race-and-josa.md`

### 뉴스탭 P0 — 코드 ✅
- [x] ~~3인 전문가 병렬 회의 (데이터/Next.js/UX)~~
- [x] ~~P0-A 빈 응답 캐시 no-store~~
- [x] ~~P0-B cacheTimes 버그 픽스 (Zustand newsCacheTimes)~~
- [x] ~~P0-C 클라이언트 타임아웃 + 반환 타입 분기 (NewsFetchResult)~~
- [x] ~~P0-D 내 종목 탭 progressive setState + fan-out 5→3~~
- [x] ~~P0-E API 타임아웃 단축 (8→5s, 6→3.5s)~~
- [x] ~~P0-F useAutoRefresh section/visibility 가드~~
- [x] ~~P0-G EmptyState 4분기 + retry counter (1/3)~~

### 로그아웃 race 3계층 — 코드 ✅
- [x] ~~InviteGate signOut 우회 수정 (useAuth.signOut 경유)~~
- [x] ~~resetPortfolio 4필드 추가 (investorType/setAt/dailySnapshots/customEvents)~~
- [x] ~~clearUserStorage 누락 8키 + prefix 매칭 + candle_* 동적 키~~
- [x] ~~useAuth.signOut try-catch + window.location 리다이렉트~~
- [x] ~~onAuthStateChange 로그아웃 분기 (prevId && !newId)~~
- [x] ~~usePortfolioSync syncUserIdRef 가드 + pending timer 취소~~

### 한국어 조사 유틸 — 코드 ✅
- [x] ~~src/utils/koreanJosa.ts 신설 (hasJongseong/iGa/eunNeun/eulReul/gwaWa/euroRo)~~
- [x] ~~CohortReference.tsx HIDDEN PICKS 카드~~
- [x] ~~technical.ts pattern desc~~
- [x] ~~alertsEngine.ts 급등/급락 알림~~
- [x] ~~SearchBar.tsx 종목 중복 confirm~~

### 🔴 사용자 액션 (실기기 검증 필수, 베타 출시 전)
- [ ] **로그아웃 3시나리오 종목 잔존 0건 확인**: 정상/InviteGate/다른 탭
- [ ] **"성장 투자자가 자주 보는"** HIDDEN PICKS 카드 표시 확인
- [ ] **뉴스탭 회선 끊김 → "연결을 확인해주세요" + retry counter** 동작 확인
- [ ] **로그아웃 후 자동 reload** 동작 + 헤더/포트폴리오 정리 확인

### 🟡 다음 세션 P1 (D+7 안)
- [ ] **네이버 Search API fallback** — CLIENT_ID/SECRET 발급 + Vercel env + route.ts 시퀀스 추가
- [ ] **"방금 갱신" 배지** — `newsCacheTimes` 활용 (Mossy Teal 점 + "N분 전 갱신")
- [ ] **Pull-to-refresh** (모바일)
- [ ] **SWR optimistic 탭 전환** (cache hit 시 0ms cross-fade)
- [ ] **BETA_SMOKE_CHECKLIST.md** 보강 — 로그아웃 잔존 + 조사 + 뉴스탭 시나리오
- [ ] **한국어 조사 유틸 적용 범위 확대** — analysisPrompt.ts, 멘토 결과 텍스트 전수 검사

### 🟡 V1.2 (P2)
- [ ] **Cache Components (`'use cache'`) 시장 탭 한정 도입** — `cacheComponents: true` 활성화, 라우트 판정 알고리즘 변경 영향 검토
- [ ] **Supabase + Cron 뉴스 사전 수집** — Google News 의존 최종 제거
- [ ] **시장 탭 Server Component + Suspense streaming** 점진 분리
- [ ] **영문 발음 받침 룰** (l/m/n/ng 끝나는 영문 처리)

## 🚀 베타 출시 D-7 진행 상황 (2026-05-15)

> 상세: `docs/BETA_LAUNCH_REVIEW.md` · QA: `docs/BETA_SMOKE_CHECKLIST.md`

### 인프라 (D-6) — 코드 ✅
- [x] ~~check-alerts cron vercel.json 등록~~ — `d0891e8` (KST 22:00)
- [x] ~~Vercel Analytics + Sentry 설치~~ — `1e76442` (DSN 없으면 자동 비활성)
- [x] ~~Service Role 클라 누출 검증~~ — 0건
- [x] ~~Cron 7개 Authorization 가드 검증~~ — 모두 통과
- [ ] **🔴 사용자 액션 (결제 진행 중, 결제 완료 후 즉시 시작 가능)**: joobi.kr 도메인 + RESEND·SENTRY env 4개
  - **현재 상태 (2026-05-18)**: 가비아에서 `joobi.kr` 2년 결제 진행 중. KIPRIS 상표 검토 완료 (JOOBI 충돌 0건, 한글 "주비"는 아소비교육 38류 캐릭터로 카테고리 다름 → 사용 OK)
  - **트리거 단어 (다음 세션)**: "등록했어", "결제 완료", "joobi.kr 진행하자", "1번 진행", "Phase A 진행" 중 무엇이든 OK
  - **결제 완료 후 진행 흐름**:
    1. **Vercel Add Domain** (3분, 함께): solb-portfolio → Settings → Domains → Add `joobi.kr` + `www.joobi.kr`
    2. **가비아 DNS 레코드 추가** (5분, 함께): A `@` → 76.76.21.21 + CNAME `www` → cname.vercel-dns.com (Vercel 안내값 그대로)
    3. **DNS 전파 대기** (5분~24시간 자동)
    4. **`https://joobi.kr` 정상 접속 확인** + HTTPS 자동 발급
    5. **Phase A — Resend**: resend.com Google OAuth 가입 → API Keys → Create (`solb-portfolio-prod`, Sending access) → `re_xxxx` 복사 → DNS TXT 추가 (SPF/DKIM, 가비아) → `EMAIL_FROM="주비 <noreply@joobi.kr>"`
    6. **Phase B — Sentry**: sentry.io Google/GitHub OAuth 가입 → Create Project → Next.js → DSN 복사
    7. **Phase C — Vercel env 입력**: `RESEND_API_KEY` · `EMAIL_FROM` · `NEXT_PUBLIC_SENTRY_DSN` · `SENTRY_DSN` (Production+Preview+Dev 모두 체크)
    8. **Phase D — 검증**: Vercel Redeploy → Sentry test event → morning-brief cron 수동 트리거 → 이메일 수신 확인 (Gmail·Naver)
  - **Phase B — Sentry 가입 + DSN**:
    - sentry.io Google/GitHub OAuth 가입 → Create Project → Platform: **Next.js** → Project name: `solb-portfolio` → DSN 복사 (`https://xxxx@xxxx.ingest.sentry.io/xxxx`)
    - tracesSampleRate 0.1 (이미 코드 적용)
  - **Phase C — Vercel UI 입력** (vercel.com → solb-portfolio → Settings → Environment Variables):
    - `RESEND_API_KEY` = `re_xxxx` (Phase A에서 발급)
    - `EMAIL_FROM` = (Phase A에서 결정)
    - `NEXT_PUBLIC_SENTRY_DSN` = (Phase B DSN)
    - `SENTRY_DSN` = (위와 같은 값)
    - 4개 모두 Production + Preview + Development 체크
  - **Phase D — 검증** (Claude가 자동 진행 가능):
    - Vercel Redeploy 트리거 (또는 자동 재배포 대기)
    - Sentry 대시보드에서 test event 확인
    - morning-brief cron 수동 트리거 → 이메일 수신함 확인 (Gmail·Naver)

### 법무 (D-5) — 코드 ✅
- [x] ~~14세 게이트 + 동의 체크박스 (LoginModal)~~ — `1a002e7`
- [x] ~~동의 시점 DB 로깅 (user_consents 테이블·useAuth INSERT)~~ — `1a002e7`
- [x] ~~AI 촉 카드 인라인 면책 + FORBIDDEN_PHRASES 7개 추가~~ — `1a002e7`
- [x] ~~멘토 6명 퍼블리시티 검수 (balance tagline 톤다운)~~ — `1a002e7`
- [x] ~~**사용자 액션**: `supabase/migrations/2026-05-15_user_consents.sql` 적용~~ — 2026-05-15 완료
- [ ] **🔴 사용자 액션**: 카카오 콘솔·Supabase Auth Redirect URLs production만 화이트리스트

### 디자인 V1 (D-4) — 코드 ✅
- [x] ~~color_scheme: light lock~~ — `e044602`
- [x] ~~OG 이미지 동적 생성 (opengraph-image.tsx)~~ — `e044602`
- [x] ~~logo-solb.svg 잔존 정리~~ — `e044602`
- [ ] **🟡 외부 자산**: maskable 아이콘 별도 PNG (현재 임시 same file)
- [ ] **🟡 외부 자산**: iOS PWA 스플래시 8종 (iPhone SE~Pro Max)
- [ ] **🟡 사용자 결정**: 로고·primary color·랜딩 슬로건 V1 디자인

### UX 함정 (D-3) — 코드 ✅
- [x] ~~샘플 포트폴리오 sandbox 분리 (watching + 안내)~~ — `9a7bd0e`
- [x] ~~랜딩 슬로건 톤다운 + "수동 입력"·OCR 보안 카피~~ — `9a7bd0e`
- [x] ~~iOS PWA PwaInstallCard 기존 존재 검증~~ — SettingsPanel 마운트
- [ ] **🟡 V1.2**: 랜딩 슬로건 A/B 인프라 (`/landing?v=a/b`)
- [ ] **🟡 V1.2**: PER/VIX hover tooltip (커스텀 `<TermHint>` 컴포넌트)
- [ ] **🟡 V1.2**: 푸시 권한 타이밍 재설계 (2번째 세션 + AI 촉 1회 직후)

### 디자인 리브랜딩 V1.1 — 코드 ✅ (2026-05-15 한 세션 압축 완료)
- [x] ~~3인 패널 회의 (아트·UX·페르소나27)~~ — Mossy Teal #0E7C7B + Amber #F59E0B 합의
- [x] ~~Step 1: CSS 토큰 시스템 (globals.css `:root`·`.dark`)~~ — `a56b05c`
- [x] ~~Step 2: 첫 화면 5개 (landing·OG·LoginModal·Onboarding·AiChokSection)~~ — `a56b05c`
- [x] ~~Step 3: 카드 3종 (MorningBriefing·MergedHoldings·BrokerSummary)~~ — `738d504`
- [x] ~~Step 4: 레이아웃 + /help (Header·RightSidebar·MobileNav·help)~~ — `738d504`
- [ ] **🟡 V1.2**: 다크모드 정식 토글 + 위험 영역 3개 (AI 촉 그라데이션·멘토 SVG·차트 grid)
- [ ] **🟡 V1.2**: admin·debug 화면 마이그레이션 (Step 5)
- [ ] **🟡 V1.2**: inline-style hex 잔존 lint (`no-inline-hex` 룰)

### QA (D-1) — 실기기 수동 sweep
- [x] ~~체크리스트 작성 (docs/BETA_SMOKE_CHECKLIST.md)~~ — `9a7bd0e`
- [ ] **🔴 사용자 액션**: 톱 10 시나리오 실기기 통과 (iOS·Android·PC 각 1대)
- [ ] **🔴 사용자 액션**: 카나리 5명 24h 검증 → Production 승격

### 인프라 보강 (BLOCKER 외 🟡)
- [ ] **`notification_log` UNIQUE(user_id, alert_type, date) + idempotency key** — cron retry 중복 알림 차단 (오늘 23,413 오탐과 같은 종류)
- [ ] **Supabase Free `pg_dump` GitHub Actions 일별 cron** (03:00 KST, S3/Drive 업로드)
- [ ] **Web Push 410 GONE → `push_subscriptions` 자동 삭제 핸들러**
- [ ] **`usdKrw` stale 환율 가드** (모닝브리프 발송 직전 freshness 체크)

### 출시 후 즉시 (V1.2, D+7 이내)
- [x] ~~디자인 리브랜딩 핵심 (V1.1 Step 1~4)~~ — 한 세션 압축 완료 (2026-05-15)
- [ ] **PRO 결제 페이지 UI 시안** (`/upgrade` 더미) — 결제 의향 측정 시작
- [ ] **멘토 시연 영상 5분 — 6/30 전 라이브** (토스 AI 출시 방어 시그니처)
- [ ] **인스타 릴스 30초 × 3** (멘토 6명 NVDA 분석 차이)
- [ ] **베타 첫 10명 인터뷰 후기 카드** (Notion 공개 + 카톡 공유용)

### KPI 임계 (베타 1개월 측정)
- D7 retention ≥30% / 가입→첫 AI 촉 ≤5분·≥70% / WAU/MAU ≥0.5 / AI 촉 👍률 ≥60% / PRO survey ≥25%
- **PRO 출시 트리거 동시 충족**: 가입 1500+ AND D7 30%+ AND PRO survey 15%+ AND affiliate 1건+

## 대기 (우선순위 순)

### 🔴 사용자 액션 필요 (이메일 백업 채널 활성화 위해)

- [x] ~~**Supabase migration 모두 적용 완료** (2026-05-13 통합 SQL `_combined_pending_2026-05-13.sql` 한 번에 실행)~~
  - [x] ~~`2026-04-28_ai_chok_recommendations.sql`~~ — AI 촉 백테스트 로깅
  - [x] ~~`2026-05-02_alert_log.sql`~~ — 알림 송신 로그 (분쟁 증거)
  - [x] ~~`2026-05-02_email_subscriptions.sql`~~ — 모닝브리프 이메일 옵트인
  - [x] ~~`2026-05-02_email_subscriptions_monthly_d3.sql`~~ — 월말 D-3 옵트인
  - [x] ~~`2026-05-02_push_subscriptions_created_at.sql`~~ — 7일 ramp-up
  - [x] ~~`2026-05-10_ai_chok_cache.sql`~~ — AI 촉 캐시 + 다양성 컬럼
  - [x] ~~`2026-05-12_stock_listings.sql`~~ — 신규 상장 감지
  - [x] ~~`2026-05-12_user_profiles_tier.sql`~~ — PRO 멤버십 게이트
  - [x] ~~`2026-05-13_ai_feedback.sql`~~ — 1탭 피드백 (Phase 1 P0-3)
- [ ] **Vercel 환경변수 추가**
  - `RESEND_API_KEY` (resend.com 발급, 무료 월 3천건)
  - `EMAIL_FROM` (예: `"주비 <noreply@solb.kr>"`, 도메인 검증 필요)
  - `EMAIL_UNSUB_SECRET` (선택 — 없으면 CRON_SECRET fallback)
  - (선택) `CHOK_DAILY_FREE=1` `CHOK_DAILY_PRO=30` `ANALYSIS_DAILY_FREE=3` `ANALYSIS_DAILY_PRO=30` — 미설정 시 코드 기본값 동일

### 일반 대기

- [x] ~~stock_listings 마이그레이션 + cron 첫 트리거~~ — **완료 (2026-05-13)**. US 24,400건 수집, KS/KQ는 별도 우회.
- [x] ~~Phase 1 P0-6 KPI funnel 위젯~~ — **완료 (2026-05-13)**. /admin 성장 탭에 onboarding/tour/feedback funnel 위젯 + AI 만족도 표시.
- [x] ~~Phase 1 P0-7 Universe 3중 AND 자동 검증~~ — **완료 (2026-05-13)**. enrich-listings에서 자동 'eligible' 승급.
- [x] ~~Phase 1 P0-9 KRX 한국 종목 우회~~ — **완료 (2026-05-13)**. /api/search 자동 등록.
- [x] ~~Phase 2 P1-3 챕터 시즌제 강화~~ — **완료 (2026-05-13)**. D-7 카운트다운 + 회고 자연어 자동 생성.
- [x] ~~Phase B-1 broker 필드~~ — **완료 (2026-05-13)**. 한국 증권사 15개 + OCR 자동 추정 + BrokerSummaryCard.
- [x] ~~Phase B-2 필터·챕터 통합~~ — **완료 (2026-05-13)**. 클릭 필터 + brokerChampions 라인.
- [x] ~~Phase B-4 마케팅 카피~~ — **완료 (2026-05-13)**. /help + /landing 보강.
- [x] ~~Phase M-1·M-2·M-3 (다중 broker 통합 + 동일 티커 합산)~~ — **완료 (2026-05-13)**. mergeHoldings selector + MergedHoldingsCard + 통합 자산 헤더.
- [ ] **🟡 Phase M-4 세금 비서 (Phase 3, 진짜 moat)** — accountType 활성화 + ISA/IRP 한도 안내 + PRO 매도 순서 최적화. 베타 500명 + 세무 검토 + 변호사 자문 필수.
- [ ] **🟡 (후속) KRX/OpenDART 한국 신규 상장 자동 fetch cron** — admin 수동/search 자동 등록은 임시. 월 10건 이하라 운영 가능하나 완전 자동화는 후속.
- [ ] **🟡 enrich-listings cron 1주일 모니터링** — `SELECT count(*) FROM stock_listings WHERE market_cap IS NOT NULL;` 진행률 확인. 일별 40건이라 시총 큰 종목 25일 안 완료 예상.
- [ ] **🟡 코치마크 모바일 보텀시트 패턴** — 베타 사용자 피드백 보고 결정.
- [ ] **🟡 docs/UNIVERSE_INCLUSION_CRITERIA.md** 작성 — 법무 리스크 회피용 외부 문서 (코드는 이미 enrich-listings에 구현됨).
- [ ] **🟡 ai-analysis 신규 IPO 안내** — 6개월 이내 IPO 종목 분석 시 "데이터 부족" 안내. stock_listings 데이터 누적 후.
- [ ] **🔴 NEXT** 베타 1주일 후 `/admin` 성장 탭 funnel 데이터 확인 — D1/D7 retention + AI 만족도 + 온보딩 이탈률.
- [ ] **🔴** `/admin/chok-debug` 배포 후 PER 채움률 확인 → 50% 이하면 F 작업(/candle fallback) 검토.
- [ ] **🟡 멘토 6명 시연 영상 (5분)** — 외부 제작. NVDA 종목 6명 분석 비교. 마케팅 핵심 자산.
- [ ] **🟡 PRO 결제 페이지 UI 시안** — 토스페이먼츠 등록 전 UI만 먼저. 1일.
- [ ] **🟡 PRO 결제 인프라 (토스페이먼츠)** — 사용자 계정 등록 후. 베타 100명+ 시점.
- [ ] **🟡 Phase B-3 계좌 종류 + 세무 비서** — ISA/IRP/연금. 진짜 moat. 베타 500명 후.
- [ ] **🟡 Affiliate 계좌 개설 보상** — 증권사 1~3개 제휴.
- [ ] 매수 시뮬 P2 (회의 결과 보류분):
  - 호가 단위 정렬 (가격대별 1원/10원/50원)
  - stale price 배지 (휴장/시간외)
  - 모바일 키보드 가림 sticky 또는 scrollIntoView
  - 엣지 케이스 가드 강화 (`usdKrw=0`, 음수 입력)
- [ ] 포트폴리오 맵 (PortfolioTreemap) 색·비율 사용자 피드백 따라 미세조정.
- [ ] 베타 1개월 후 `ai_chok_recommendations` 백테스트 데이터로 추천 효과성 분석.

### 알림 Phase 5 (보류)

- [ ] 푸시 송신 실패 시 자동 이메일 retry (현재 두 채널 독립)
- [ ] 카카오 알림톡 / SMS (비용 발생 → 매출 단계 검토)
- [ ] GitHub Actions CI에 `npm run lint:alerts` 통합 (현재는 prebuild 로컬만)

## 차단됨

(외부 요인으로 막힌 항목 — 차단 사유 함께 기록)

## 트리거 대기 (조건 충족 시 자동 발동 — auto-memory에 박힘)

- **유료화/PRO/멤버십 단어 등장 시:**
  - 약관 제12조 "무료" 표현 갱신
  - PRO 설계 가드레일 재확인 (AI 촉 무료 유지 원칙)
  - 변호사 1시간 상담 (30~50만원)
  - 결제 인프라 (토스페이먼츠/포트원)
- **사용자 손실 클레임 / 금감원 시정조치:** 즉시 변호사
- **광고 매출 연 5천만+:** 회색 지대 진입, 변호사 검토
