# 2026-05-29 — 한국어 UI/UX 시스템 SSOT 격상 (5인 패널 + 자성)

> 사용자 호소 (1차): "여기를 보면 습니다만 밑으로 내려가는데 이게 맞아??? 이부분 디자인관련 전문가 5인 구성해서 회의하고 결과보고해줘"
> 사용자 호소 (2차 핵심): "이런 어절에 대해서는 기본적인 ui/ux 의 알고리즘 골력이 갖워 있어야 하지 않나?"
> 결과: 5인 디자인 패널 + 자성 → 한국어 UI/UX 시스템 SSOT 격상 (문서 1 + 유틸 3 + lint 1 + 메모리 2). 산발적 룰을 단일 골격으로 통합.

## 작업 요약

### 1) 사용자 호소 1차 + 5인 디자인 패널 회의

스크린샷: LoginModal 면책 영역 "있" + 줄바꿈 + "습니다" 어절 깨짐.

**5인 디자인 패널 페르소나**:
1. 타이포그래피·한국어 디자이너
2. UI/UX 디자이너 (정보 위계)
3. 접근성·인지 디자이너
4. CSS·반응형 엔지니어
5. UX writer·카피라이터

**만장일치 결론**: `word-break: keep-all` 부재 + 불필요 `<br />` 강제 줄바꿈 합작. 글로벌 1줄 + `<br />` 제거 + 카피 simplify.

**P0 4건 즉시 반영** (당시 직전 단계):
- `globals.css` body에 `word-break: keep-all` + `overflow-wrap: break-word` + monospace reset
- `LoginModal.tsx` 면책 영역 `<br />` 2개 제거 + 카피 simplify (35자 → 19자)

### 2) 사용자 호소 2차 — 자성 발동

> "이런 어절에 대해서는 기본적인 ui/ux 의 알고리즘 골력이 갖워 있어야 하지 않나?"

5인 디자인 패널이 keep-all + br sweep만 짚고 **본질(SSOT 부재)을 못 봄**. 매번 패널 회의로 발견하는 건 시스템 부재 신호. **한국어 UI/UX 시스템 SSOT 격상**.

### 3) 산발적 한국어 SSOT 인벤토리

| SSOT | 위치 | 추가일 |
|---|---|---|
| 줄바꿈 (어절 보존) | `globals.css` body keep-all | 2026-05-29 |
| 조사 처리 | `koreanJosa.ts` | 2026-05-19 |
| 종목명 매핑 | `STOCK_KR` | — |
| 손익 컬러 | 메모리 + 산발 | — |
| 금지 어휘 | `alertCompliance.FORBIDDEN_PHRASES` | 2026-05-15~28 |
| 환각 통계 금지 | 메모리 | 2026-05-20 |
| **숫자·통화 포맷** | 없음 → **`koreanNumber.ts` 신설** | 2026-05-29 |
| **상대 시간** | 없음 → **`koreanDate.ts` 신설** | 2026-05-29 |
| **카피 톤 매핑** | 없음 → **`koreanCopy.ts` 신설** | 2026-05-29 |
| **빌드 시 검증** | 없음 → **`lint-korean.mjs` 신설** | 2026-05-29 |
| **통합 문서** | 없음 → **`docs/KOREAN_UI_SYSTEM.md` 신설** | 2026-05-29 |

### 4) Phase A — 문서 SSOT 신설 (`docs/KOREAN_UI_SYSTEM.md`)

- 8개 룰 카테고리: 줄바꿈·조사·카피톤·숫자/통화·날짜/시간·마침표/공백·손익컬러·금지어휘
- 유틸 매핑 표 (의도 → 함수 → 위치)
- lint:korean 검출 룰 (조사 괄호·격식 어휘)
- **패널 운영 — 시스템 부재 신호 인지 룰** (모더레이터 자성 4개 질문)
- V1.2 후속 7건

### 5) Phase B — 유틸 3개 신설

- `src/utils/koreanNumber.ts`: `formatKrw`(만/억/조), `formatUsd`, `formatPct`, `formatSigned`, `pnlColor`(빨강↑/파랑↓)
- `src/utils/koreanDate.ts`: `formatRelativeKo`(방금/N분 전/어제), `formatAbsoluteKo`, `formatLongKo`, `formatTimeKo`
- `src/utils/koreanCopy.ts`: `toTossTone()` 매핑 + `detectFormalTone()` (격식 → 토스 톤, 약관 예외)

### 6) Phase C — lint:korean 스크립트 + prebuild 통합

- `scripts/lint-korean.mjs` (lint-alerts.mjs 패턴 그대로)
- **검출 룰**: ① 조사 괄호 "이(가)·은(는)·을(를)·과(와)·으로(로)" ② 격식 종결 어휘 (16종, 약관·Disclaimer 예외)
- **모드 분리**: strict (CI 차단) / soft (시각화만 통과)
- **package.json**: `lint:korean` + `lint:korean:soft` + `prebuild`가 soft 모드 사용
- **첫 실행 결과**: **66건 위반 검출** — 사용자 지적이 정확. 격식 어휘가 앱 전체에 산발. V1.2 sweep TODO.

### 7) Phase D — 메모리 승급

- 🆕 `memory/project_korean_ui_system.md` — 한국어 UI/UX 시스템 SSOT 영구 박제
- `memory/feedback_panel_audit_methodology.md` 보강 — "시스템 부재 신호 인지 룰" 4가지 자성 질문 추가
- `MEMORY.md` 인덱스 2건 갱신

### 8) 누적 변경 파일

- 🆕 `docs/KOREAN_UI_SYSTEM.md`
- 🆕 `src/utils/koreanNumber.ts`
- 🆕 `src/utils/koreanDate.ts`
- 🆕 `src/utils/koreanCopy.ts`
- 🆕 `scripts/lint-korean.mjs`
- `src/app/globals.css` (body keep-all + monospace reset)
- `src/components/auth/LoginModal.tsx` (br 제거 + 카피 simplify)
- `package.json` (lint:korean + lint:korean:soft + prebuild 통합)

### 9) 검증

- ✅ `npx tsc --noEmit` 통과
- ✅ `npm run lint:alerts` 통과
- ⚠️ `npm run lint:korean` 66건 위반 검출 (V1.2 sweep 대상, soft 모드로 prebuild 통과)
- ✅ `npm run prebuild` 통과

## 결정사항

### 1) 5인 디자인 패널 한계 인정 + 자성

**왜**: 패널은 자기 분야 깊이 검증에 강하지만, **시스템 부재 자체를 보는 메타 시점**은 모더레이터 책임. 사용자 지적 후에야 격상.

**박제**: `feedback_panel_audit_methodology` 보강 — 4가지 자성 질문(매번 발견 vs 시스템화 / 다른 화면 N개 / lint 자동화 / 메모리 가치) 박힘. 2개 이상 YES면 단발성 fix가 아닌 시스템 격상.

### 2) lint:korean을 soft 모드로 prebuild 통합

**왜**: strict로 즉시 통합하면 66건 위반 = 빌드 깨짐 = 베타 D-6 BLOCKER. V1.2 sweep 후 strict 격상.

**대안 거부**:
- prebuild 미통합: lint 자동화 효과 0
- 화이트리스트 66건 ignore: 점진 처리 미루기 + 망각 위험
- 66건 즉시 fix: 베타 D-6 일정 영향 (큰 작업)

→ **soft 모드 통합 + V1.2 sweep TODO 명시**가 균형.

### 3) 카피 톤 매핑 — 약관·Disclaimer·법무 예외

**왜**: "있습니다" 격식 톤은 면책 강도 + 법적 효력에 영향. 약관·Disclaimer·법무 영역은 격식 유지가 분쟁 시 방어. lint:korean도 이 경로 예외.

### 4) 한국 손익 컬러는 메모리 + 디자인 시스템 SSOT에 있지만 코드 SSOT도 추가

**왜**: `pnlColor()` 함수가 빨강↑/파랑↓ 컨벤션을 코드 진입점에서 강제. 컴포넌트마다 hex code 직접 박는 안티패턴 차단.

### 5) `<br />` 사용 룰 — 자연 줄바꿈 우선, 의도 줄바꿈만 허용

**왜**: 앱 전체 `<br />` 28개. 면책 카피 같은 자연 줄바꿈은 keep-all에 위임이 옳음. tagline·로고처럼 **의도된 시각 줄바꿈**만 `<br />` 유지. V1.2 sweep.

## 미해결 TODO

### V1.2 sweep (P1)
- [ ] **격식 종결 어휘 66건 sweep** — lint:korean baseline 위반, koreanCopy.toTossTone 적용 또는 직접 구어체 변환. 완료 후 lint:korean strict 격상.
- [ ] **`<br />` 28개 sweep** — `OcrImportModal`·`SettingsPanel`·`PortfolioSection`·`ThrowbackCard`·`InviteGate` 등. 의도된 줄바꿈만 남기고 제거.
- [ ] **`formatKrw`·`formatPct` 컴포넌트 통합** — Dashboard·MergedHoldingsCard·MorningBriefing 등 산발 포맷 통합
- [ ] **`formatRelativeKo` 적용** — newsCacheTimes "방금 갱신" 배지 등
- [ ] **디자인 토큰화** — `--text-korean-wrap`, `--text-korean-body` (V1.2 토큰 시스템 확장)
- [ ] **ESLint 커스텀 룰 격상** — 현재 prebuild 스크립트 → ESLint plugin (IDE 인라인 경고)

### 그 외 (V2)
- [ ] 영문 단어 발음 받침 룰 (l/m/n/ng 끝나는 영문 처리)
- [ ] AI 응답 자동 toTossTone 적용 (analysisPrompt 결과·멘토 카드, 면책 영역 제외)

## 다음 세션 진입점

**현재 상태**: 한국어 UI 시스템 SSOT 격상 ✅. 베타 D-6 추가 BLOCKER 0건. lint:korean soft 모드라 빌드 통과.

**우선순위 다음 작업** (변동 없음):
1. 🔴 **Phase A — joobi.kr 결제 + Vercel Add Domain + DNS + Resend** (베타 D-6 BLOCKER)
2. 🔴 **카나리 24h 페르소나 5명 모집** (사용자 직접)
3. 🔴 **Phase G 검증** (Redeploy + Sentry test + morning-brief 수동 + /help 신고 폼)

**V1.2 진입 시**:
- `lint:korean` strict 격상 가능 시점 = 격식 어휘 66건 sweep 완료 + `<br />` 28개 정리
- AI 응답 자동 toTossTone 통합 가능

**참고 메서드 SSOT**:
- **시스템 부재 신호 인지** = 패널 모더레이터의 메타 책임. 다음 패널 운영 시 자성 4개 질문 발동 의무.
- **soft 모드 lint 도입 패턴** = 즉시 strict 도입 시 BLOCKER 위험 → soft 모드 통합 + baseline 박제 + 점진 sweep + strict 격상. lint:korean이 다음 lint 도입의 표준 패턴.
