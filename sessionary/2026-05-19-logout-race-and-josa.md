# 2026-05-19 — 로그아웃 잔존 race 3계층 + 한국어 조사 유틸

> 사용자 호소 2건이 한 흐름에서 발견:
> 1. "로그아웃했는데 로그인했을 때의 내용이 남아있는 케이스" (정정: 다른 계정 아닌 본인 이전 데이터)
> 2. "HIDDEN PICKS / 숨은 종목 • 성장 투자자**이** 자주 보는" — 한국어 조사 잘못

## 작업 요약

### Phase 1 — 로그아웃 잔존 (1차 진단: 3계층 결함)

병렬 탐색 결과 3가지 결함이 복합 작용:

| # | 결함 | 영향 |
|---|---|---|
| ① | `InviteGate.tsx:156`이 `supabase.auth.signOut()` 직접 호출 — `clearUserStorage` + `resetPortfolio` 우회 | invite 화면에서 "다른 계정으로 로그인" 시 store/storage 잔존 |
| ② | `resetPortfolio`가 `investorType` / `investorTypeSetAt` / `dailySnapshots` / `customEvents` 4필드 누락 | 다음 사용자에게 이전 사용자의 투자 유형·스냅샷 노출 가능 |
| ③ | `clearUserStorage`의 `USER_STORAGE_KEYS`가 12개+ 키 누락 (alert_*, chapter_*, tour_*, invite_cache, candle_*) | 알림 학습·챕터 진행·투어 상태가 다음 사용자에게 전이 |

**적용**:
- `InviteGate` → `useAuth().signOut()` 경유로 변경
- `resetPortfolio`에 4필드 추가 (`DEFAULT_INVESTOR_TYPE` import 활용)
- `userStorage.ts`에 누락 8개 키 추가 + `USER_STORAGE_KEY_PREFIXES` 신설 (`solb_chapter_keyword_*` 매칭) + `candle_*` 동적 키 정리 + `sessionStorage.solb_consent_pending`

### Phase 2 — 한국어 조사 유틸 (long-term fix)

탐색 에이전트가 받침 계산을 잘못해서("투자자는 받침 있음") 직접 재계산:
- `자` (0xC790) → `(0xC790 - 0xAC00) % 28 = 0` → **받침 없음**
- 모든 투자자 유형 nameKr이 받침 없음 → `이` 고정은 모든 케이스에서 잘못됨

**신규 유틸**: `src/utils/koreanJosa.ts`
- `hasJongseong(word)` — 종성 유무 판단 (한글 음절 범위 검사 + 영문/숫자는 보수적 false)
- `iGa` / `eunNeun` / `eulReul` / `gwaWa` — 받침 유무 분기
- `euroRo` — ㄹ 받침 예외 처리 ('ㄹ' 받침은 '로', 그 외 받침 있으면 '으로')
- `withIGa` / `withEunNeun` / `withEulReul` — 단어+조사 합성 헬퍼

**적용 위치 5곳**:
| 파일 | 변경 |
|---|---|
| `CohortReference.tsx:146` | `{meta.nameKr}이` → `{meta.nameKr}{iGa(meta.nameKr)}` |
| `technical.ts:226` | `${pattern.name}이(가)` → 동적 조사 (사용자 노출 desc 메시지) |
| `alertsEngine.ts:141, 150` | 급등/급락 알림의 `${name}이(가)` → 동적 조사 |
| `SearchBar.tsx:133` | confirm 메시지의 `${sym}은(는)` → `eunNeun(sym)` |

### Phase 3 — 로그아웃 race 3계층 (사용자 정정 후 재진단)

사용자 정정: **"다른 계정 정보 아니고 본인 이전 정보가 잔존"** + "로그아웃 후 새로고침 안 한 상태"

→ Phase 1 fix만으로는 race 케이스 못 막음. 추가 정밀 분석:

| # | 원인 | 코드 위치 |
|---|---|---|
| **A** | `useAuth.signOut`의 `await supabase.auth.signOut()`이 throw하면 후속 5줄(clearUserStorage, resetPortfolio, setUser 등) 전부 skip | `useAuth.ts:96` — try-catch 없음 |
| **B** | `onAuthStateChange`에 계정 전환(`prevId && newId && prevId !== newId`)만 처리, 로그아웃(`prevId && !newId`) 분기 누락 | `useAuth.ts:33` — 다른 탭/토큰 만료 케이스 정리 안 됨 |
| **C** | `usePortfolioSync` stocks-effect의 race — `resetPortfolio()`로 stocks=[]가 되는 순간 user.id가 아직 truthy라 빈 stocks를 이전 user.id DB에 저장 가능 | `usePortfolioSync.ts:51-69` |

**적용**:
- **A**: `signOut`에 try-catch + `window.location.href = '/'` redirect (race 완전 회피)
- **B**: `onAuthStateChange`에 `if (prevId && !newId) { clearUserStorage; resetPortfolio; }` 분기 추가
- **C**: `syncUserIdRef` 신설 — user.id 전환 직후 첫 effect는 baseline만 갱신하고 save 보류. 로그아웃 시 pending 디바운스 timer도 취소

## 결정사항

### 왜 redirect 방식?
- React state + Zustand store + localStorage + 디바운스 timer + 인터벌 — 정리 누락 가능 surface가 너무 많음
- 베타 D-7 시점에 "기능 fix"보다 "사고 차단"이 우선
- redirect 한 번 짧은 깜빡임 < 사용자 데이터 누출/혼선
- D+30 이후 SSR/RSC 마이그레이션 시 깔끔한 reset 흐름으로 재설계 가능

### 한국어 조사 처리 SSOT
- 새 동적 텍스트 만들 때 `이(가)` `은(는)` 같은 명시 텍스트 노출 금지 — `@/utils/koreanJosa` 반드시 사용
- 영문/숫자 단어는 보수적 false(받침 없음) 처리 — 일관성 우선. 향후 영문 발음 룰 추가 가능

### 탐색 에이전트 결과의 신뢰도 trade-off
- 첫 탐색에서 "투자자는 받침 있다"는 받침 계산 오류 발생 → 직접 재계산 필요했음
- 교훈: 한글 받침 같은 단순 계산은 에이전트에게 위임하지 말고 내가 직접 계산하는 게 더 빠름

## 미해결 TODO (TODO.md로 흡수)

- [ ] **실기기 검증**: 정상/InviteGate/다른 탭 로그아웃 3시나리오 종목 잔존 0건 확인
- [ ] **BETA_SMOKE_CHECKLIST.md**에 로그아웃 잔존 시나리오 3종 + "투자자가 자주 보는" 표시 확인 추가
- [ ] **(P1)** 한국어 조사 유틸 적용 범위 확대 — `analysisPrompt.ts`, 멘토 분석 결과 텍스트 등 동적 텍스트 전수 검사
- [ ] **(P2)** 영문 발음 받침 룰 추가 (`hasJongseongForEng` — 'l', 'm', 'n', 'ng' 끝나는 영문 받침 처리)

## 다음 세션 진입점

베타 BLOCKER #1 (joobi.kr 도메인 + Resend·Sentry env 4개) 진행 가능.
사용자가 가비아 결제 완료하면 트리거 단어("등록했어", "결제 완료", "Phase A 진행" 등) 사용.
