# 한국어 UI/UX 시스템 SSOT

> **작성일**: 2026-05-29
> **배경**: 사용자 지적 — "이런 어절에 대해서는 기본적인 UI/UX 알고리즘 골격이 갖춰져 있어야 하지 않나?". 산발적으로 누적된 한국어 처리 코드를 통합 SSOT로 정리.
> **관련**: [project_design_system.md](../) (디자인 토큰), [koreanJosa.ts](../src/utils/koreanJosa.ts), [alertCompliance.ts](../src/utils/alertCompliance.ts)

## 1. 목적

주비는 **한국어 우선 핀테크 앱**(20~30대 초보 학습자). 한국어 텍스트가 깨지거나(어절 분리), 격식이 어색하거나(번역체), 단위가 통일되지 않으면 페르소나가 즉시 이탈. 이 문서는 한국어 텍스트의 모든 처리 룰을 단일 진실 원천으로 정의.

## 2. 현재 SSOT 인벤토리

| SSOT | 위치 | 커버 범위 | 추가일 |
|---|---|---|---|
| 줄바꿈 (어절 보존) | `globals.css` body | `word-break: keep-all` + `overflow-wrap: break-word` + monospace reset | 2026-05-29 |
| 조사 처리 | `src/utils/koreanJosa.ts` | 이/가, 은/는, 을/를, 과/와, 으로/로 (hasJongseong 기준) | 2026-05-19 |
| 종목명 매핑 | `STOCK_KR` (`src/config/constants.ts`) | 한국 30종 + 미국 매핑 | — |
| 손익 컬러 (한국 컨벤션) | 디자인 시스템 SSOT (메모리) | 빨강 #DC2626 ↑ / 파랑 #2563EB ↓ | — |
| 금지 어휘 | `src/utils/alertCompliance.ts:FORBIDDEN_PHRASES` | 자본시장법 §6 회피 (매매 권유·맞춤 추천·단일종목 레버리지·인기/같이/함께) | 2026-05-15~28 |
| 타이포그래피 | `globals.css` font-family | Pretendard + Apple SD Gothic + Noto Sans KR fallback | — |
| 환각 통계·확률 금지 | 메모리 [feedback_hallucinated_stats] | 검증 안 된 통계·확률 노출 차단 | 2026-05-20 |
| 숫자·통화 포맷 | `src/utils/koreanNumber.ts` | 만/억/조 단위, KRW/USD 포맷, 손익 부호 | 2026-05-29 |
| 상대 시간 | `src/utils/koreanDate.ts` | "방금", "N분 전", "N시간 전", "어제", "N일 전" | 2026-05-29 |
| 카피 톤 매핑 | `src/utils/koreanCopy.ts` | 격식("있습니다") → 토스 톤("있어요") 매핑 + 면책 예외 | 2026-05-29 |
| 빌드 시 검증 | `scripts/lint-korean.mjs` (prebuild) | "이(가)" 노출·격식 어휘·산발 `<br />` 검출 | 2026-05-29 |

## 3. 룰 카테고리

### 3.1 줄바꿈 룰

- **전역 기본값**: `word-break: keep-all; overflow-wrap: break-word;` (globals.css body)
- **이유**: CJK 브라우저 기본값은 음절 단위 분리 → "있/습니다" 깨짐. keep-all은 어절 보존.
- **예외**: `code, pre, kbd, samp, .font-mono`는 `word-break: normal; overflow-wrap: anywhere;` (영문·티커·종목코드 가독성)
- **`<br />` 사용 룰** (2026-05-29 baseline 1차 sweep 후 보강):

| 카테고리 | 정책 | 예시 |
|---|---|---|
| 약관·개인정보 단락 구분 | ✅ 유지 | `terms`·`privacy` 본문, 연락처 |
| tagline·로고·헤더 강조 | ✅ 유지 | "내 주식,\n쉽게 읽어주는\n주식 비서" (LoginModal) |
| EmptyState 두 줄 시각 분리 | ✅ 유지 | "관심 종목을 추가하면\n실시간 가격..." (PortfolioSection) |
| 에러 안내 + 해결 안내 | ✅ 유지 | "데이터를 불러올 수 없어요\n잠시 후 다시 시도해주세요" |
| 운영 가이드 불릿 (`•` 사이) | ✅ 유지 | admin 페이지, ListingsPanel 가이드 |
| 통계·리스트 줄 분리 | ✅ 유지 | OCR done 화면, 증권사 리스트 |
| 강조 fragment 끝 | ✅ 유지 | InvestorTypeQuiz 카드 |
| 분석 결과 시각 분리 | ✅ 유지 | AnalysisPanel 결과 사이 |
| 온보딩·랜딩 슬로건 | ✅ 유지 | OnboardingFlow, landing/page |
| **두 문장 안내 카피** | ❌ 제거 | "현재 베타 테스터만...<br />초대 코드를 입력..." → 한 단락 자연 위임 |
| **인라인 `wordBreak: 'keep-all'` 중복** | ❌ 제거 | 글로벌 적용 후 인라인 중복 |

  - 의도 라벨 권장 (V2): 의도된 `<br />` 옆에 `{/* keep-br: tagline */}` 같은 라벨로 PR 리뷰·회귀 방지
  - 검증: V2 ESLint plugin에서 br 검출 룰 통합 예정. 현재는 PR 리뷰 시 카테고리 확인
  - 2026-05-29 baseline: 40+ → 31 (9건 자연 위임 1차 sweep), 31건은 시각 의도로 유지

### 3.2 조사 룰

- **SSOT**: `src/utils/koreanJosa.ts`
- **금지**: 동적 텍스트에 "이(가)", "은(는)", "을(를)" 같은 괄호 표기 노출. 분쟁 위험·가독성 0.
- **사용**: `iGa(name)`, `eunNeun(name)`, `eulReul(name)`, `gwaWa(name)`, `euroRo(name)` 호출
- **예시**: `${name}${iGa(name)} 추가됐어요.` → "삼성전자가 추가됐어요."

### 3.3 카피 톤 룰

- **기본 톤**: 토스/카카오뱅크풍 **구어체 친근형** ("~이에요", "~있어요", "~할게요")
- **격식 유지 예외**: ① 약관·개인정보처리방침 (법적 문서) ② Disclaimer 컴포넌트 (정식 면책) ③ 자본시장법 §6 회피 카피 (분쟁 증거)
- **매핑**: `src/utils/koreanCopy.ts:TOSS_TONE_MAP`
  - "있습니다" → "있어요"
  - "제공됩니다" → "제공돼요"
  - "필요합니다" → "필요해요"
  - "확인하세요" → "확인해주세요"
- **반의 표현**: "~하지 마세요" 자제, "~하지 않아도 돼요"·"~할 필요 없어요"로 부드럽게

### 3.4 숫자·통화 포맷 룰

- **SSOT**: `src/utils/koreanNumber.ts` — **금액·비율·부호·손익색 전부 이 한 파일**

> ⚠️ 2026-08-18 정정. 이전 판은 `koreanNumber.ts`를 SSOT로 선언하면서 만/억/조 표기를 규정하고
> `formatKRW.ts`를 "좁은 카드·차트 예외"로 적었다. 실제로는 **정반대**였다 —
> `koreanNumber.ts`는 import 0건이었고, 예외로 적힌 쪽이 유일한 구현(15곳)이었으며
> 그 위에 컴포넌트 로컬 래퍼 12개와 raw `toLocaleString` 82곳이 얹혀 있었다.
> 문서가 코드와 반대로 진술하던 상태라 두 모듈을 하나로 합치고, **실제 배포된 표기를 정답으로** 삼았다.

### 경로 분리 — 훑어보는 화면 vs 검증하는 화면 (2026-08-18 결정)

같은 금액이라도 문맥에 따라 표기를 달리한다. 토스도 잔액은 `276,000원`, 요약 카드는 만/억을 쓴다.

| 경로 | 함수 | 표기 | 쓰는 곳 |
|---|---|---|---|
| **서술·요약** (훑어봄) | `formatDisplayAmount()` → `formatKrwUnits()` | `27만 6,000원` | 주비의 이야기 · 월간 챕터/Wrapped · 모닝브리핑 · 자산 추이 차트 · 어제의 당신 |
| **검증** (숫자를 확인) | `formatKrw()` | `₩276,000` | 보유 테이블 · 평단/매입원금 · 편집 모달 · 매수 시뮬 · 알림 detail · 트리맵 |

채택 근거: `₩123,456,789`에서 자릿수를 세어 "1억 2천만원대"를 파악하는 인지 부하가 실재한다.
1억 미만은 만/억 표기도 **완전 정확**하고(`5만 3,900원` = 53,900), 1억 이상은 만 단위 반올림이다.
현행 10억 축약(`₩12억`)이 3,456만원을 버리는 것보다 오히려 정확하다.

⚠️ 만/억 표기는 "원"으로 끝나므로 **조사가 바뀐다**(`…원이` / `…원가` ✗).
문장에 붙일 때는 `koreanJosa`의 `withIGa()` 등을 반드시 경유할 것.

- **한국 통화 — 검증 경로**: `formatKrw(276000)` → `₩276,000` / `formatKrw(1.5e9)` → `₩15억`
  (10억 미만 풀숫자+콤마, 10억 이상 억 축약)
- **한국 통화 — 서술 경로**: `formatKrwUnits(276000)` → `27만 6,000원`
- **미국 통화 (USD)**: `formatUsd(1234.5)` → `$1,234.50` (자릿수 인자 가변)
- **표시 통화 변환**: `formatDisplayAmount(krw, currency, usdKrw)` —
  "원화 금액을 현재 표시 통화로" 렌더. 통합 전 6개 컴포넌트에 바이트 단위로 동일 복제돼 있었다.
- **환율 폴백**: `resolveUsdKrw(macroData)` / `DEFAULT_USD_KRW`.
  ⚠️ 환율 미확인과 "1,400원"이 구분되지 않는 알려진 결함이 있다. 이제 한 곳이라 수정도 한 곳.
- **퍼센트**: 소수점 2자리 + 부호 — `formatPct(3.21)` → "+3.21%"
- **손익 부호**: 양수 "+", 음수 "−" (en-dash 가독성), 0 "" (부호 없음)
- **손익 색**: `pnlColor(v)` — 디자인 토큰(`var(--color-gain/loss)`) 반환. 인라인 hex 금지(다크모드 allowlist 무효)
- **강제**: `lint:korean` 룰3(currency-format, soft) — 컴포넌트에서 통화 raw `toLocaleString` 검출.
  잔량 sweep 후 strict 격상 예정. 계약은 `src/__tests__/koreanNumber.test.ts`가 박제.

### 3.5 날짜·상대 시간 룰

- **SSOT**: `src/utils/koreanDate.ts`

> ⚠️ 2026-08-18 실태 — `koreanDate.ts`는 **아직 채택되지 않았다**(import 0건).
> 실제 날짜 표기 11곳은 카드마다 필요한 옵션이 달라
> (`{month:'short',day:'numeric'}` / `{year,month:'long',day}` / `{month:'long'}` …)
> `toLocaleDateString('ko-KR', …)`를 직접 쓴다. 이 모듈의 `formatAbsoluteKo`·`formatLongKo`·
> `formatTimeKo`는 고정 포맷이라 그 자리를 대신하지 못한다.
>
> 다만 **상대 시간(`formatRelativeKo`)은 대체제가 없다** — 현재 앱에 "방금 · N분 전" 표기가 없다.
> 뉴스 갱신 배지 등에 도입할 때 이 함수를 쓴다(TODO 등재).
> 금액(§3.4)처럼 강제 lint를 걸지 않은 이유도 이것이다: 날짜는 공용 규칙이 아직 하나로 좁혀지지 않았다.
- **상대 시간** (1시간 이내 작성·갱신):
  - 60초 이내 → "방금"
  - 60초~1시간 → "N분 전"
  - 1시간~24시간 → "N시간 전"
  - 어제 (24~48시간) → "어제"
  - 2~7일 → "N일 전"
  - 그 이상 → 절대 날짜 "YYYY-MM-DD"
- **절대 날짜**: 한국어 형식 "2026년 5월 29일" 또는 ISO "2026-05-29" — 화면별 일관 유지

### 3.6 마침표·공백 룰

- **마침표**: 카피 끝 마침표 통일 — UI 카드 1줄 카피는 마침표 생략(토스 패턴), 본문은 마침표
- **한·영 사이 공백**: 한글과 영문/숫자 사이 1칸 공백 (예: "AAPL 종가는 $234.56")
- **괄호**: 한국어 안 영문 약어는 괄호 — "투자자문업(§6)" 형식

### 3.7 손익 컬러 룰

- **한국 컨벤션**: 빨강 ↑ (#DC2626) / 파랑 ↓ (#2563EB)
- **이유**: 한국 주식 사용자 멘탈모델. 미국식(녹↑/적↓) 절대 금지.
- **0 변동**: 회색 (#8B95A1)

### 3.8 금지 어휘 (FORBIDDEN_PHRASES)

- **SSOT**: `src/utils/alertCompliance.ts:FORBIDDEN_PHRASES`
- **카테고리**:
  - 매매 권유: "지금 사세요", "매수 추천", "사야 한다" 등
  - 수익 보장: "확실한 수익", "100% 보장"
  - 개인 맞춤 추천 (유사투자자문업 시그널): "당신에게 추천", "회원님께 맞춤"
  - 단일종목 레버리지 권유: "레버리지 추천", "곱버스 진입", "2배 수익"
  - 군중 추종 시그널: "인기 종목", "같이 사는", "함께 매수"
- **위반 시**: prebuild `lint:alerts` 실패, AI 응답은 `sanitizeAiOutput()` 자동 교체

## 4. 유틸 매핑 표

| 의도 | 함수 | 위치 |
|---|---|---|
| 조사 결합 | `iGa(name)` 등 | `koreanJosa.ts` |
| 만/억 KRW 포맷 | `formatKrw(n)` | `koreanNumber.ts` |
| USD 포맷 | `formatUsd(n)` | `koreanNumber.ts` |
| 퍼센트 부호 | `formatPct(p)` | `koreanNumber.ts` |
| 상대 시간 | `formatRelativeKo(d)` | `koreanDate.ts` |
| 격식 → 토스 톤 | `toTossTone(text)` | `koreanCopy.ts` |
| 금지 어휘 검사 | `validateAlertMessage()` | `alertCompliance.ts` |
| AI 응답 sanitize | `sanitizeAiOutput()` | `alertCompliance.ts` |

## 5. 빌드 시 검증 (lint:korean)

- **위치**: `scripts/lint-korean.mjs`
- **prebuild 통합**: `package.json`의 `prebuild`가 `lint:alerts && lint:korean` 동시 실행
- **검출 룰**:
  1. `이\(가\)` · `은\(는\)` · `을\(를\)` · `과\(와\)` 노출 — koreanJosa 미사용 시그널
  2. 격식 종결 어휘 (`있습니다`·`됩니다`·`합니다`) 검출 — 약관/Disclaimer 폴더 제외
  3. 한국어 사이 `<br />` 검출 — 의도 라벨 주석 `{/* keep-br: tagline */}`로 화이트리스트
- **종료 코드**: 위반 시 1 → CI 차단
- **alertCompliance.ts·koreanJosa.ts·koreanCopy.ts와 동기 유지** (양쪽 변경 시 함께)

## 6. 패널 운영 — 시스템 부재 신호 인지 룰

> 2026-05-29 추가 — 5인 디자인 패널이 keep-all + `<br />` sweep만 짚고 본질(SSOT 부재)을 못 봄. 사용자 지적 후 반영.

패널 회의 운영 시 항상 다음 질문 추가:
1. "이게 매번 패널이 발견할 일인가, 한 번 시스템화하면 끝날 일인가?" (단발성 fix vs SSOT 격상)
2. "비슷한 사례가 다른 화면에 N개 있는가?" (grep으로 인벤토리)
3. "빌드 시 검증으로 자동화 가능한가?" (lint 룰)
4. "메모리 승급 가치 있는 영속 사실인가?" (자성)

→ 메모리 [feedback_panel_audit_methodology] 보강.

## 7. V1.2 후속

- [ ] **`<br />` 28개 sweep** — 의도된 줄바꿈만 남기고 제거 (`OcrImportModal`·`SettingsPanel`·`PortfolioSection` 등)
- [ ] **`formatKrw`·`formatPct` 모든 컴포넌트 통합** — 현재 산발 (Dashboard·MergedHoldingsCard·MorningBriefing 등)
- [ ] **`formatRelativeKo` 적용** — "newsCacheTimes" "방금 갱신" 배지 등
- [ ] **`toTossTone()` 자동 변환** — analysisPrompt 결과·멘토 카드 일괄 적용 (단 면책·법무 영역 예외)
- [ ] **디자인 토큰화** — `--text-korean-wrap`, `--text-korean-body`, `--text-korean-caption` (V1.2 토큰 시스템 확장)
- [ ] **ESLint 커스텀 룰 격상** — 현재 prebuild 스크립트 → ESLint plugin으로 IDE 인라인 경고

## 8. 변경 이력

- **2026-05-29**: 문서 신설. globals.css keep-all, koreanNumber·koreanDate·koreanCopy 유틸 신설, lint:korean 스크립트 신설, 패널 시스템 부재 신호 룰 추가.
