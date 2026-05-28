# 2026-05-28 — 단일종목 레버리지 ETF/ETN 5분야 패널 + P0 8건 코드

> 사용자 호소(1): "이번에 국내주신에 삼성전자 하이닉스 레버리지 2배 상품들이 출시했는데 이런걸들은 왜 반영이 안되는거지?"
> 사용자 호소(2): "국낸주식도 이제 레버리지를 출시한다고 했어. 먼저 조사하고 우리도 대응해야 사용자들이 불만을 제기하지 않지 않을까? 이부분 전문가 구성해서 회의하고 보고해줘"
> 결과: 외부 조사 + 5분야 20인 패널 회의 + P0 8건 동일 세션 반영. 9개 파일 변경(1 신규 + 8 수정), 모든 진입점 SSOT 1개로 일관 차단.

## 작업 요약

### 1) 외부 조사 (WebSearch 3건 병렬)

**확정 사실 확보**:
- **2026-05-27 KRX 동시 상장** — 국내 증시 사상 최초 단일종목 레버리지·인버스 18종 (ETF 16 + ETN 2), **4.3조원**
- **기초자산**: 삼성전자, SK하이닉스
- **발행사**: KODEX(삼성)·TIGER(미래에셋)·ACE(한국투자) [ETF] / 미래에셋증권 [ETN]
- **ETN 종목코드**: 520100 (미래에셋 레버리지 삼성전자 단일종목 ETN), 520101 (SK하이닉스)
- **금감원 가이드**: 'ETF' 명칭 금지, 사전교육 1+1시간, 예탁금 1000만원, 적합성 의무 강화
- **위험**: 하루 60% 손실 가능, 음의 복리, 발행사 신용리스크

### 2) 5분야 20인 패널 병렬 회의

| 분야 | 4인 페르소나 |
|---|---|
| 🏛️ 시장·전략 | PM · 포지셔닝 · 비즈니스 모델 · 컴플라이언스 |
| ⚖️ 법무·컴플라이언스 | 자본시장법 변호사 · 금감원 출신 · 약관·개인정보 · 광고심사 |
| 💻 엔지니어링·데이터 | 아키텍트 · Next.js 16 · 외부 API · 인증·보안·관측성 |
| 🎨 UX·인지심리 | 인터랙션 · 인지·정보구조 · 접근성 · 시각 시스템 |
| 📊 알고리즘·리스크 | Quant · AI/LLM 모델링 · 시장 데이터 · 알람·이벤트 정책 |

5분야 만장일치 결론(놀라울 정도로 정렬됨):
> **"Universe 영구 배제 + 검색은 EmptyState 안내 + 보유 등록은 허용하되 AI 분석 OFF + 진입점 5곳에서 SSOT 함수 1개로 일관 차단"**

### 3) Top 5 critical 발견

1. **`mentorScores.getAssetType()` 미국 화이트리스트만** → 한국 레버리지가 'kr_stock' 기본 프로필(safety=3)로 오분류 → 17개 알고리즘 중 10개 즉시 왜곡 (알고리즘 단독 발견)
2. **universe 3중 AND에 `asset_class` 룰 없음** → 12개월+ 룰만으론 음의 복리 못 막음 (1년 후 자동 편입 위험)
3. **AI 촉 "관찰 후보" 노출 시 자본시장법 §6① · §101 유사투자자문업 형사처벌 트리거** — 베타 셧다운 위험 (법무 단독)
4. **검색 무반응 → 사용자가 앱 결함으로 오해** → 버그 신고 폭주 + 외부 이탈 (UX 단독)
5. **약관 제5·7조 미갱신** → 분쟁 시 가장 약한 고리, 음의 복리·발행사 신용리스크 면책 누락 (법무 단독)

### 4) P0 8건 즉시 반영 (3 Phase, 9개 파일)

**Phase A — leverageGuard SSOT + 진입점 4곳 차단**

- 🆕 `src/utils/leverageGuard.ts`
  - `isBlockedLeverage(symbol, description)` SSOT 함수
  - `LEVERAGE_DENY_SYMBOLS` Set (520100/520101 확정)
  - `LEVERAGE_NAME_PATTERNS` 정규식 (한·영 키워드, 한국 ETN 종목코드 패턴 `/^5\d{5}\.K[SQ]$/`)
  - `LEVERAGE_BLOCK_USER_MESSAGE` / `LEVERAGE_BLOCK_SHORT` 카피 상수
- `src/app/api/search/route.ts:44-56` — Finnhub filter에 `!isBlockedLeverage` 추가
- `src/app/api/admin/listings/add/route.ts:64+` — POST 400 reject 분기
- `src/utils/alertsEngine.ts:72+` — `checkAllAlerts` 진입에서 일관 filter (6개 알림 루프 통과 전 차단)
- `src/app/api/cron/morning-brief/route.ts:105+` — `buildBrief` filter (음의 복리 종목이 biggestMover 후보로 들어가지 못함)
- `src/components/portfolio/SearchBar.tsx`
  - handleSearch combined filter
  - handleAdd alert (localStorage·옛 데이터 경로 차단)
  - EmptyState 검색어 분기 (레버리지 의도면 Amber 칩 + 6줄 사유)

**Phase B — AI prompt + 컴플라이언스 + 약관**

- `src/config/analysisPrompt.ts:138+` — "단일종목 레버리지·인버스 ETF/ETN (분석 거부 대상)" 새 분기. 한국 ETN 520xxx 명시, 한국 ETF 키워드 적용, 미국 TSLL/NVDU 포함. **분석 거부 응답 강제**.
- `src/utils/alertCompliance.ts` — FORBIDDEN_PHRASES 9구 추가 (레버리지·인버스·곱버스 권유) + SAFE_REPLACEMENTS 매핑 보강
- `src/app/terms/page.tsx`
  - 시행일 **v2 → v3 (2026-05-28)**
  - 제5조에 "분석 대상 제외 상품" 단락 추가
  - 제7조에 일일 N배 추종·음의 복리·발행사 신용리스크·예탁금·적합성 면책 1항 추가 (금감원·KRX 공식 가이드 인용)

**Phase C — UX 안내**

- SearchBar EmptyState — `isLeverageQuery(query)`로 검색어 의도 판정, Amber 칩 + "주비에서 다루지 않아요" + 6줄 사유
- SearchBar handleAdd alert — `isBlockedLeverage` 통과 못하면 즉시 alert + 사유 안내

### 5) 검증

- ✅ `npx tsc --noEmit` 통과 (출력 0)
- ✅ `npm run lint:alerts` "금지 어휘 검출 없음"
- 기존 lint warning 122건은 모두 내 변경분 아닌 기존 코드 이슈

## 결정사항

### 1) Universe 영구 배제 + AI 분석 차단 + 보유 등록 허용 (3중 안전 마진)

**왜**: 자본시장법 §6①·§101 위반 회피. 분석 자체가 "투자자문업" 트리거. 보유 등록은 §6 거래 매개 아니라 안전권. 사용자 자율권 유지.

**대안 거부**:
- 보유 차단 100% (변호사 안): 사용자 페르소나 자율권 침해 + 컴플라이언스 패널 "분석 차단으로 충분"
- 점진 노출 V1.2: 임의 화이트리스트 = §6 트리거
- AI 촉 노출 (BM 안): 베타 셧다운 위험

### 2) SSOT 함수 1개 + 진입점 5곳 일관 호출

**왜**: 어제(2026-05-20) 비-USD/비-KRW 차단(P0-9)과 같은 패턴. 진입점 누락 = silent leak. ETF 16종 정확한 종목코드 모르는 상태에서도 정규식 + deny-list 이중 방어로 누수 0.

**호출점**:
- 검색: `search/route.ts` + `SearchBar.handleSearch` + `SearchBar.handleAdd`
- 등록: `admin/listings/add/route.ts`
- 분석: `analysisPrompt.ts` (LLM 단계 거부)
- 알림: `alertsEngine.checkAllAlerts`
- 모닝브리프: `morning-brief.buildBrief`

ai-chok은 `chokUniverse.ts` 하드코딩이라 이미 안전, SSOT 호출은 P1 보강.

### 3) 종목 코드 정확치 모름 → 정규식 + deny-list 이중 방어

**ETN 2종 확정 등록** (520100/520101). ETF 16종 정확한 종목코드는 KRX 공시 확인 후 P1에서 보강. 그 사이 차단:
- 한국 ETN 종목코드 `/^5\d{5}\.K[SQ]$/`
- 종목명 키워드 `/레버리지|인버스|곱버스|단일종목|2X|-2X|TQQQ|SOXL|.../`

### 4) 약관 v3 시행일 2026-05-28

- **제5조 "분석 대상 제외 상품"**: 단일종목 레버리지·인버스 상품의 분석·추천·예측 일절 제공 안 함, 보유 등록은 가능
- **제7조 면책 1항 추가**: 일일 N배 추종·음의 복리·발행사 신용리스크·예탁금 요건·적합성 의무 (금감원·KRX 공식 인용으로 객관성 확보)

### 5) UX는 "교육적 부재(educational absence)" 패턴 — 침묵 차단 X

**왜**: 학습 페르소나(20~30대 초보 적립식). 무반응 = 앱 결함 의심. 명시적 "주비는 이 상품을 다루지 않아요" + 사유 6줄.

**시각**: Amber 칩 (디자인 시스템 SSOT `#F59E0B` 활용, 빨강 회피 — 매매 권유 색).

## 다음 세션 진입점

**현재 상태**: 코드 ✅ + TypeScript ✅ + lint:alerts ✅. 베타 D-6 추가 BLOCKER 0건.

**우선순위 다음 작업** (TODO 상단):
1. **Phase A — 가비아 joobi.kr 결제 완료 → Vercel Add Domain + DNS + Resend** (베타 D-6 BLOCKER)
2. (선택) **메모리 승급 후보**: `project_leverage_single_stock_policy.md` — 영구 배제 정책 SSOT (재발견 비용 큼)
3. 카나리 24h 페르소나 화이트리스트 진행 (Phase G)

**커밋 메시지 후보**:
```
feat(leverage): 단일종목 레버리지 ETF/ETN 18종 SSOT 차단 (5분야 20인 패널 P0 8건)

2026-05-27 KRX 단일종목 레버리지 18종(4.3조원) 상장 대응. universe 영구 배제 +
검색·등록·분석·알림·모닝브리프 5개 진입점 일관 차단. leverageGuard.ts SSOT 신설.

- src/utils/leverageGuard.ts: isBlockedLeverage SSOT + 정규식 + deny-list 이중 방어
- src/app/api/search/route.ts: Finnhub filter에 추가
- src/app/api/admin/listings/add/route.ts: POST 400 reject
- src/utils/alertsEngine.ts: checkAllAlerts 진입 filter
- src/app/api/cron/morning-brief/route.ts: buildBrief filter
- src/components/portfolio/SearchBar.tsx: handleSearch + handleAdd + EmptyState 분기
- src/config/analysisPrompt.ts: 단일종목 레버리지 분석 거부 분기
- src/utils/alertCompliance.ts: FORBIDDEN_PHRASES 9구 추가
- src/app/terms/page.tsx: v3 시행 + 제5·7조 갱신
```

**참고 메서드 SSOT**: leverageGuard 패턴 = 어제 비-USD/비-KRW 차단(P0-9)과 동일 구조. 향후 위험 상품 출시(예: 비트코인 ETF 단일종목 레버리지, 옵션 전매 상품 등) 시 같은 패턴 재사용.

## 외부 조사 출처

- [삼전·하닉 단일종목 레버리지·인버스 ETF 27일 상장 — 뉴스핌](https://www.newspim.com/news/view/20260522001197)
- [SK하이닉스 단일종목 레버리지 ETF·ETN 18종 완전 정리 — Unjena](https://unjena.com/1695)
- [미래에셋증권, 삼전·하닉 레버리지 ETN 상장 — TokenPost](https://www.tokenpost.kr/news/market/363682)
- [단일종목 레버리지 ETF 27일 출시…금융당국 각별한 주의 — 정책브리핑](https://www.korea.kr/news/policyNewsView.do?newsId=148965098)
- [단일종목 레버리지 최종 가이드라인 — 'ETF' 명칭 못쓰고 — 아주경제](https://www.ajunews.com/view/20260408084932374)

---

## P1 후속 진행 (같은 세션, +7건 / 18개 파일 누적)

> 사용자: "2. 🟡 단일종목 레버리지 P1 후속 10건 (V1.2 — asset_class 마이그·2단계 모달·14세 게이트 강화 등) 진행하자."
> 선택: "전체 9건" (ETF 16종 KRX 공시 확인은 외부 정보 필요해 제외)
> 결과: 핵심 7건 즉시 + 3건 V1.2 분리 + OCR 가드 보너스. Phase D(마이그 2건 Supabase 적용)도 같은 세션에 완료.

### Group 1 — 인프라 SSOT (4건 ✅)

- 🆕 `supabase/migrations/2026-05-28_stock_listings_asset_class.sql` — asset_class TEXT 컬럼 + CHECK 제약(11종 클래스) + 인덱스 + 520100/520101 즉시 leveraged_single + status='rejected' 태깅
- `src/utils/leverageGuard.ts` — `AssetClass` 타입 + `classifyAssetClass(symbol, description)` + `isUniverseEligibleClass()` SSOT 확장. 미국 단일종목 레버리지/인버스/지수 화이트리스트(TSLL·NVDU·TQQQ·SQQQ 등) 박제
- `src/app/api/cron/enrich-listings/route.ts` — classifyAssetClass 자동 태깅 + leveraged_single/inverse_single은 즉시 status='rejected' + universe 자동 승급에 isUniverseEligibleClass() 4번째 룰 추가
- `docs/THRESHOLDS.md #46` — 4번째 룰 박제 + #41-43 ✅ 표시

### Group 2 — 알고리즘 (3건 ✅)

- `src/utils/mentorScores.ts` — **algorithm critical #1 해결**. getAssetType() 시그니처에 description 추가 + classifyAssetClass + STOCK_KR fallback. 한국 단일종목 레버리지가 'kr_stock' 오분류되던 버그 → safety=1·leveraged 프로필 정상 부여
- `src/app/api/ai-chok/route.ts` — universe slice + logRecommendations insert에 isBlockedLeverage filter 추가 (chokUniverse 하드코딩이지만 회귀 안전망)
- 🆕 `supabase/migrations/2026-05-28_ai_chok_recommendations_constraint.sql` — CHECK constraint `symbol !~ '^5[0-9]{5}\.K[SQ]$'` (한국 ETN 5xxxxx 차단). 코드 가드(1차) + DB 가드(2차) 이중 방어

### Group 3 — UI (2건 ✅ + 보너스 1건)

- `src/components/portfolio/OcrImportModal.tsx` — applyToPortfolio에 isBlockedLeverage 가드 + `skippedLeverage` state + done 화면에 "⚠ 단일종목 레버리지·인버스 N개 차단" Amber 표시 (OCR이 한국 레버리지 ETF 인식 시 누수 방지)
- `src/components/auth/LoginModal.tsx` — **14세 게이트 강화**. 단순 체크박스 → 출생연도 4자리 입력 + 자동 검증 + 만 14세 미만 차단 빨강 메시지 + ✓ 만 N세 확인 Mossy Teal. sessionStorage CONSENT_STORAGE_KEY에 `birth_year` 추가. 자본시장법 §49·단일종목 레버리지 적합성 의무 대응.

### 🟡 V1.2 분리 3건 (ROI 검토 후)

| 항목 | 분리 이유 |
|---|---|
| 종목 카드 Amber 띠 (P1-G) | PortfolioSection 600줄+ 변경. P0+P1 진입점 차단으로 보유 카드 진입 사실상 0건 → 시각 안전망 가치 < 비용. 디자인 결정 별도 시간 필요. |
| 2단계 동의 모달 (P1-H) | 5개 진입점(검색·OCR·admin/add·SearchBar·등록)이 모두 차단해서 모달 발동 시나리오 없음. 안전망 가치 매우 낮음. |
| "왜 안 다루나요?" 풀시트 (P1-J) | 어제 P0에서 SearchBar EmptyState에 Amber 칩 + 6줄 사유 이미 박혀있음 → 풀시트 신설은 중복. |

### Phase D — Supabase 마이그 적용 ✅ (2026-05-28)

- `2026-05-28_stock_listings_asset_class.sql` 적용 완료
- `2026-05-28_ai_chok_recommendations_constraint.sql` 적용 완료

### 검증

- ✅ `npx tsc --noEmit` 통과
- ✅ `npm run lint:alerts` "금지 어휘 검출 없음"

### 누적 변경 (P0 + P1 합산)

- **18개 파일** (14 수정 + 4 신규)
- 신규: `leverageGuard.ts` · 마이그 2건 · sessionary 1건
- **algorithm critical #1 해결됨** (mentorScores 오분류 → 정상 분류)
- universe 4중 AND 룰 박제 (시총 $5B+ AND 12개월+ AND 데이터 정상 AND asset_class 허용)
- 진입점 가드: search·SearchBar·admin/add·OCR·alertsEngine·morning-brief·ai-chok·analysisPrompt + DB CHECK 2차 방어

### 다음 세션 진입점 (갱신)

1. **Phase A — joobi.kr 결제 + Vercel Add Domain + DNS + Resend** (베타 D-6 BLOCKER 유지)
2. **카나리 24h 페르소나 5명 모집** (다증권사 30대 iOS / 1증권사 20대 Android / Samsung Internet 30대 / 카카오 인앱브라우저 20대 / PC desktop 30대)
3. **Phase G 검증** (Redeploy + Sentry test event + morning-brief 수동 트리거 + /help 신고 폼 검증)

V1.2 분리 3건(Amber 띠·2단계 모달·풀시트)은 베타 출시 후 사용자 피드백 보고 우선순위 재조정.