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
- **`<br />` 사용 룰**:
  - ❌ **금지**: 자연 줄바꿈으로 충분한 한국어 문장 사이에 강제 `<br />` (예: 면책 카피, EmptyState)
  - ✅ **허용**: tagline·로고·헤더처럼 **의도된 시각적 줄바꿈** (예: "내 주식,\n쉽게 읽어주는\n주식 비서")
  - ✅ **허용**: 표·리스트의 셀 내 명시적 줄 분리
  - 검증: `lint:korean`이 한국어 사이 `<br />`을 grep 검출 (의도 라벨 주석으로 화이트리스트)

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

- **SSOT**: `src/utils/koreanNumber.ts`
- **한국 통화 (KRW)**: 만/억/조 단위 한국어 표기 — `formatKrw(123456789)` → "1억 2,345만원"
- **미국 통화 (USD)**: "$1,234.56" 표기 (콤마 + 소수점 2자리)
- **퍼센트**: 소수점 2자리 + 부호 — `formatPct(3.21)` → "+3.21%"
- **손익 부호**: 양수 "+", 음수 "−" (en-dash 가독성), 0 "" (부호 없음)
- **단위 변환**: USD → KRW은 별도 환율 컨텍스트, formatter는 통화 인자 받기

### 3.5 날짜·상대 시간 룰

- **SSOT**: `src/utils/koreanDate.ts`
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
