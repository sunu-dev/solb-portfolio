# 2026-05-29 — 단일종목 레버리지 '중간 옵션' 구현 (변호사 GO → 방향성 분리)

> 흐름: 사용자가 변호사 의견서(중간 옵션)를 제시 → "정식 GO로 간주, 코드 구현 시작" → Phase 1~5 구현 → tsc·prebuild·앱 실검증 통과.
> 결과: 단일종목 레버리지 정책이 **'영구 차단' → '중간 옵션'**으로 전환. 코드 10파일 변경. **⚠️ 약관 v4 변호사 정식 검토 전 배포 금지.**

## 핵심 전환 — 기준이 '종목' → 'AI 출력 방향'

변호사 의견서 결론: §6 자문업 위험의 출처는 '개인화'가 아니라 **'AI 출력이 가리키는 방향'**.
- ✅ 허용: 보유 중인 레버리지의 **사후 위험 해설** (현황·변동성·구조·음의 복리·발행사 신용)
- 🔴 차단: **신규 매매 유인** — 촉·universe 편입·신규 매수 시사·매수 유인 알림

→ 옵션 C(완전 동일 취급) 폐기. **중간 옵션**: ① 보유분 위험 해설 허용 ② 신규 발굴·추천 차단 유지.

## 작업 요약 (Phase 1~5)

- **Phase 1 토대** (`leverageGuard.ts`): `isBlockedLeverage` → `isSingleStockLeverage`(분류 전용)로 명명, 정책은 호출부 의도로 결정. `isBlockedLeverage`는 deprecated 별칭 유지(하위호환). 방향성 카피 추가(`LEVERAGE_NEW_BUY_BLOCK_MESSAGE`·`LEVERAGE_HOLDING_RISK_NOTE`·`LEVERAGE_SEARCH_LABEL`).
- **Phase 2 약관 v4** (`legalVersions.ts` v3→v4, `terms/page.tsx`): 제2조(매매없음·직접입력·관리중심 정체성), 제5조(분석 대상 제외 → '취급 범위 제한': 신규 추천 제외 + 보유분 사후 위험 해설 + 성인·위험 게이트), 제7조 8항(신규 추천 X / 보유분 위험 해설만, 매매 판단 아님).
- **Phase 3 검색·게이트**: `LeverageRiskGate.tsx` 신설(만 19세+ 자가확인 + 위험 이해 동의 → 통과 시 등록). `SearchBar` — 검색 노출 허용·앰버 '고위험' 칩·레버리지 맨 아래 정렬·handleAdd→게이트→doAdd 분리. `kr-quote` — 한국 ETN 2종(520100/520101) 검색 노출 전용 추가. `search/route.ts` — 표시 필터 해제하되 **universe 자동등록(koreanNewRows)에선 레버리지 계속 차단**.
- **Phase 4 AI 분석** (`analysisPrompt.ts`): "분석 거부" → **"보유 위험 해설 모드"**. 첫 문장 고정("신규 추천 아님, 매매 권유 아님"), 허용=구조·위험 해설만, **금지=매수/매도 시사·목표가·매수 매력도 점수**.
- **Phase 5 알림·브리프**: `alertsEngine` — 레버리지 보유분 알림 포함하되 **위험 고지(urgent/risk)만, 기회·축하 억제**(함수 말미 directional 필터). `morning-brief` — 손익 합계엔 포함(정확한 보유 현황), **'오늘의 주목 종목(biggestMover)'엔 제외**(매일 유인 방지).

## 결정사항 (왜)

1. **정식 GO 간주** — 파운더 결정 권한. 단 의견서 §5대로 약관 v4 병행 + 배포 전 변호사 정식 검토 선행 조건.
2. **분류 vs 정책 분리** — `isSingleStockLeverage`는 '레버리지인가'만, 차단/허용은 진입점 의도로. 같은 종목이 '보유 해설' 표면이면 통과, '신규 유인' 표면이면 차단.
3. **게이트 A** (자가확인 19세+ + 위험 동의 모달) — 기존 birthYear 활용, 베타 적정. 정식 본인인증은 변호사 요구 시 v2.
4. **칩 색상** — 우선주/ETF/혼합은 중립 회색(정보), 레버리지는 앰버(위험 맥락). 의도적 구분.
5. **검색 노출 ETN 2종만** — 코드 확정분만(404 방지). 16종 ETF는 KRX CSV(V1.2).

## 검증
- `npx tsc --noEmit` 0 · `npm run prebuild`(lint:alerts + lint:korean) 통과.
- lint:alerts false-positive("매수 추천이 아니라" substring) → "추천 목적이 아니라"로 수정.
- 앱 실검증: "삼성전자" → 보통주·우선주·레버리지ETN(맨 아래), "레버리지" → ETN 2종.

## 미해결 TODO

### 🔴 배포 게이트
- [ ] **약관 v4 변호사 정식 검토** — 검토 전 production 배포 금지 (의견서 §5). 질문지 `docs/LEGAL_CONSULTATION_LEVERAGE.md`.

### 🟡 follow-up (이번 턴 의도적 미포함)
- [ ] **OCR 게이트 임포트** — `OcrImportModal`은 아직 레버리지 skip(안전하나 검색과 비대칭). 배치 위험 동의 후속.
- [ ] **mentorScores radar** — 레버리지 safety=1·income=1(위험 신호)이나 '매수 매력도' radar 노출 적정성 재검토.
- [ ] **한국 레버리지 16종 코드** — 현재 ETN 2종만. KRX 마스터 CSV(V1.2).
- [ ] **게이트 동의 DB 로깅** — 현재 행동 시점 게이트만. `user_consents`에 `leverage_risk` 추가(CHECK 마이그) → 분쟁 증거.

### 🔵 적대적 검증 workflow (완료) — 3라운드 loop-until-clean (must-fix 10→5→2→reachable 0)
**1차 감사** (28에이전트): 확정 누수 15건(must 10·should 5) + 비평 8 → **빠른 GO 구현이 불완전했음 적발**.
**Tier 1 근본수정**: `isSingleStockLeverage` symbol-aware(US 화이트리스트+bare코드 정규화) + `classifyAssetClass` deny-list 통합 → 9/9 검증.
**Tier 2 표면수정**(병렬 6파일): check-alerts·ai-analysis(3중방어)·AnalysisPanel·Timeline·Cohort·MarketMovers.
**2차 재감사** (23에이전트): Tier2 불완전 적발 → 보강:
- ✅ AnalysisPanel 레이더만 가렸던 것 → 차트요약(959)·차트분석블록(1192) 전체 `!isLev` 게이트
- ✅ enforceLeverageReport에 scenarios 삭제 + indicators 신호 중립화 추가 (서버 단일 지점)
- ✅ admin PATCH 레버리지 승급 차단 가드 (should-fix)
- ✅ SearchBar EmptyState OCR 거짓 약속 카피 제거 (should-fix)
- ✅ StockItem.name 영속화 → 보유-표면 가드(alertsEngine·check-alerts·morning-brief·AnalysisPanel) name 연결

**3차 재감사** (24에이전트, 9건): must-fix 2 = AI 리포트 자유텍스트(keyAdvice·currentStatus·quote·historicalNote) 누수 + 16종 name-의존(latent) → 보강:
- ✅ **enforceLeverageReport가 자유텍스트를 정적 위험 해설로 대체** (currentStatus·keyAdvice 고정, quote·historicalNote·newsAnalysis 삭제, conclusion desc 고정). LLM이 OVERRIDE 어겨도 사용자엔 위험 해설만 — 결정론적 백스톱. (chok-leak-1 must + sanitize·historicalNote should 동시 폐쇄)
- ✅ **BuySimulator(추가매수 시뮬·물타기) isLev 게이트** (비평 발견, reachable)
- ✅ 변호사 GO 문구 정합 (leverageGuard ↔ legalVersions: 구현=사용자GO / 배포=변호사검토후)

### 🟡 잔존 — latent + long-tail (reachable must-fix는 3라운드로 전부 폐쇄)
- [ ] **16종 한국 레버리지 ETF (latent)** — 코드 미확정이라 name-키워드로만 탐지. kr-quote 카탈로그·OCR로 현재 등록 불가라 도달 0. **KRX CSV 코드를 deny-list에 추가하면 닫힘** (등록 가능해지기 전 선행 필수). check-alerts·OCR·SearchBar 게이트의 name-의존은 이 클래스 한정.
- [ ] **long-tail 표면** (비평) — 월간 회고 champion 칭송+공유, priorityScore AI촉 주입 등 보유분 파생 표면. 저빈도·저severity. 추가 라운드 시 isLev 게이트.
- [ ] **OCR 게이트 임포트** — 현재 레버리지 skip(안전, 중간옵션과 비대칭). 배치 위험 동의 후속.
- [ ] **sanitize 룰 기반 방향 동사 스캐너** (should) — 정적 대체로 AI 리포트는 닫혔으나, 알림 등 다른 경로 방어 강화용.
- [ ] **근본원인: `StockItem`에 종목명 필드 부재** → 보유-표면 leverageGuard가 symbol-only로 퇴화. 한국 레버리지 ETF 16종(코드 미확정, 이름 키워드로만 탐지)이 alertsEngine·check-alerts·morning-brief에서 미탐지. **단, 16종은 kr-quote 카탈로그·OCR 어디로도 현재 등록 불가라 latent.** `StockItem.name` 영속화로 닫힘(JSON blob sync라 저위험) — **표시 버그(리로드 시 이름이 심볼로 보임)도 동시 해결** + 매수일 기능 토대.
- [ ] **OCR 게이트 임포트** — 현재 레버리지 skip(안전하나 중간옵션과 비대칭). 배치 위험 동의 후속.
- [ ] **16종 ETF 코드(KRX CSV) 추가 전, name 영속화 선행 필수** (등록 가능해지면 16종 탐지 의존)

## 다음 세션 진입점

**현재 상태**: 중간 옵션 코드 구현 완료(미커밋 가능성). 약관 v4 DRAFT(배포 전 변호사 검토 필요). 메모리 정정 완료. 차단→방향성 전환 완료.

**우선순위**:
1. 🔴 변호사 정식 검토 → 약관 v4 확정 → 배포 게이트 해제
2. 🟡 follow-up (OCR 게이트 / mentorScores / DB 동의 로깅 / 16종 코드)

**참고**:
- 정책 메모리 [[leverage-single-stock-policy]]는 '중간 옵션'으로 정정됨.
- 방향성 판별: `isSingleStockLeverage`(분류) + 호출부 의도. 신규 발굴=차단, 보유 해설=허용.
- 직전 세션: `2026-05-29-search-coverage-and-consent.md`(P0 인지 갭) · `2026-05-29-leverage-policy-review.md`(9인 패널·옵션 C 경위).
