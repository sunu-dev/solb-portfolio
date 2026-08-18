# 2026-08-18 (후속) - 감사 후속: 공통 가드·표시 SSOT·CI

> 같은 날 전수 감사 기록은 `2026-08-18-full-feature-audit-and-p0-fixes.md`.
> 이 파일은 그 감사의 **교차 절단면 해소** 작업이다(주제가 달라 분리).

## 작업 요약

감사가 지목한 교차 절단면을 순서대로 닫았다. 커밋 11개.

### 1. API 공통 가드 계층 (`7d11393`, `2b57425`)

49개 라우트에 middleware도 래퍼도 없어 인증·레이트리밋·에러형식·관측이 손으로 복제되던 것을
`src/lib/apiRoute.ts`의 `defineRoute({ name, auth, rateLimit, handler })` 한 곳으로 모았다.

- `auth` 5모드(public/user/admin/cron/optional). **기본값을 두지 않고 명시 필수** — 빼먹어서 무방비가 되는 실수를 막는다.
- 관리자 신원을 `src/lib/adminAuth.ts` SSOT로. 리터럴이 있던 **15개 파일 → 1곳**.
  클라이언트 3곳이 들고 있던 목록은 `useIsAdmin()`(→`/api/me/admin`)로 교체 —
  **빌드 산출물의 파운더 이메일·UUID 노출이 2~3청크 → 0**.
- 미인증 라우트 4개(`search`·`quotes`·`event-candles`·`feedback/report`)에 레이트리밋.
- cron 8개를 `auth: 'cron'`으로 이관. `check-alerts`만 QStash 서명 분기 때문에 자체 인증 유지.

### 2. 표시 SSOT 통합 (`a0a1b66`, `6cade92`, `4c65749`, `f220da3`)

문서가 SSOT라 부른 `koreanNumber.ts`는 **import 0건**이고, 실사용은 규칙이 다른
`formatKRW.ts`(15곳) + 로컬 래퍼 12개 + raw `toLocaleString` 82곳이었다.

- `formatKRW.ts` 삭제, `koreanNumber.ts` 단일 모듈(임포터 0 → 14+)
- `formatDisplayAmount()` — **바이트 단위로 동일하던 6곳** 복제 제거
- `resolveUsdKrw()` — `|| 1400` 폴백 **21곳 → 1곳**
- `pnlColor()` — `#DC2626` 리터럴(실제 서비스 색과 **달랐음**) → 디자인 토큰
- 통화 raw 포맷 20건 sweep 후 `lint:korean` 룰3 hard 격상
- USD 자릿수 **3종 → 2종**(개별 2자리 고정 / 합계 정수)

### 3. CI·게이트 (`90f1167`)

`.github`이 아예 없었고 테스트 352개가 **어떤 게이트에도 배선되지 않았다**.

- `prebuild`에 `npm test` 편입 + `.github/workflows/ci.yml`(verify → build 2잡)
- `npm run typecheck` / `npm run verify` 통합 스크립트

### 4. 빌드를 런타임 비밀에서 분리 (`283ef13`, `7c2b0b9`, `f04af57`)

모듈 스코프 `createClient(url!, serviceKey!)` 때문에 **서비스키 없이는 빌드조차 불가**했다.

- 무가드 12곳 + 가드형 14곳(11파일) 전부 요청 시점 지연 생성으로
- eslint `no-restricted-syntax` 3선택자로 재발 차단(**전 파일 error**, 예외 2곳)
- CI build 잡이 **런타임 비밀 없이** 통과 = 회귀 감지 장치

### 5. 잔여 (`4afc4b5`)

- `formatRelativeKo` 도입 — 뉴스 갱신 배지 신설, 시장 주목종목 조회 시각
- `<FxStaleNotice />` 공용화 — 대시보드·모닝브리핑·자산추이

## 결정사항

- **감사기 주장은 반드시 직접 재검증한다.** Codex 즉시조치 8건 중 7건 확정 / 1건 기각(사용자 본인이 설정한 손절 임계 도달 보고를 §6으로 과대평가). 적대적 검증관의 '높음' 판정 1건도 "이 diff 밖 파일 + 기존 동작"이라 별건·중간으로 강등했다.
- **기존 위반이 있는 룰은 baseline으로 시작하고 같은 세션에 sweep한다.** `lint:korean` 격식 어휘가 66건 baseline → sweep → strict를 밟은 전례를 따랐다. baseline 목록에는 "**줄어들기만 해야 한다**"를 명시했다.
- **표시 통합은 실제 배포된 표기를 정답으로 삼았다.** 두 포맷터가 거의 모든 값에서 다른 문자열을 내므로(`₩276,000` vs `27만 6,000원`) 화면을 바꾸는 건 리팩터가 아니라 제품 결정이다. 구조만 합치고 만/억 채택은 별도 판단으로 올렸다.
- **만/억은 전면이 아니라 경로별로 채택했다.** 훑어보는 화면(이야기·회고·브리핑·차트)은 만/억, 검증하는 화면(보유테이블·평단·편집모달·알림)은 콤마. 토스도 잔액은 `276,000원`, 요약 카드는 만/억을 쓴다.
- **USD는 가변 자릿수 관례를 없앴다.** `$480`·`$1,234.5`·`$178.25`가 섞이면 tabular-nums 세로 정렬이 어긋난다. 자릿수가 고정이어야 숫자가 줄을 맞는다.
- **환율 미확인은 숫자를 감추지 않고 밝힌다.** 화면이 비면 더 불안하고, 임시 기준임을 알면 달러 표시로 전환해 정확한 값을 볼 수 있다. 노출은 3조건(미확인+USD보유+원화표시)이 모두 참일 때만.
- **PII는 방침을 코드에 맞췄다(365일).** `NOTIFICATION_POLICY.md §4.4`가 이미 '1년 보관'이라 처리방침 쪽이 outlier였다.

## 메모리 승급 (완료)

아래는 메모리로 이동됨 — 영속 룰은 메모리를 SSOT로 보고, 여기서는 발견 경위만 남긴다.

- **신규** `project_api_guard_ssot.md` — 라우트는 `defineRoute`로 감싼다(인증 자체 구현 금지) ·
  관리자 신원은 `adminAuth` 한 곳 · 모듈 스코프 Supabase 클라이언트 금지(eslint error) ·
  빌드는 런타임 비밀에 의존하지 않는다 · 설정 오류를 인증 오류로 내보내지 않는다.
- **신규** `feedback_rule_rollout_baseline.md` — 기존 위반이 있는 룰은 baseline으로 신규만 차단하고
  가능하면 같은 세션에 sweep 후 격상. **룰 자체를 음성 프로브로 검증**(이번에 선택자 결함을 그렇게 발견).
- **보강** `project_korean_ui_system.md` — 표시 포맷 SSOT 절 신설(koreanNumber 단일 모듈,
  서술=만/억·검증=콤마, USD 2종, 환율 미확인 고지, 날짜는 공용 규칙 없음).
- **현행화** `project_solb_status.md` — 2026-06-04 기준이던 것을 코드 실측·게이트 구조·감사 결과·
  파운더 대기 4건으로 갱신.

## 검증

- `npm run verify` exit 0 — typecheck · lint 4종 · eslint · **테스트 352 통과**(세션 시작 236)
- eslint **0 error** (baseline 제거 후에도)
- `npx next build`를 **런타임 비밀 없이** 실행해 통과
- 미커밋 0

## 이번 세션이 만든 회귀와 그 발견 경로

자체 수정이 만든 결함을 검증 장치가 잡은 사례 — 다음 세션이 같은 함정을 피하도록 남긴다.

1. **`push/subscribe` 401 위장** — 지연 전환으로 `supabase()`가 던질 수 있게 됐는데
   '토큰 무효'를 삼키려던 빈 catch가 설정 오류까지 삼켰다. → 적대적 검증 2렌즈가 독립 발견.
2. **eslint 선택자가 `export const`를 놓침** — `Program >`를 `:matches()` 바깥에 두면
   부모가 `ExportNamedDeclaration`인 경우가 빠진다. → 음성 프로브로 발견(첫 프로브에 export 케이스를 안 넣었던 게 원인).
3. **팩토리 메모이제이션이 테스트를 깨뜨림** — 첫 mock 클라이언트가 고정돼 이후 케이스가 stale을 받았다.
   판정관이 별건으로 지적한 'null 영구 캐시'와 같은 뿌리. → cron 테스트 2건 실패로 발견.
4. **`\bsupabase\b`가 `@supabase/supabase-js` import에 매칭** — 스크립트가 모듈 스코프에 선언을 삽입했다. → diff 육안 검토로 발견.

## 미해결 TODO

### 파운더 액션 (P0)
- [ ] **Finnhub API 키 회전** — 코드는 고쳤지만 기존 키는 공개 배포됐으므로 유출 간주
- [ ] 마이그 `20260818000100_invite_codes_rls_hardening.sql` 운영 적용 (적용 전 `pg_policies`로 `codes_select` 존재 확인)
- [ ] 비로그인 실시간 WebSocket 미제공 트레이드오프 승인

### 육안 검증
- [ ] 만/억 표기 6화면 모바일 좁은 폭 (1억 미만에서 +1~2자 → 줄바꿈 회귀 여부)
- [ ] USD `.00` 변화 (RightSidebar 목표가·RecordCenter·OCR)
- [ ] 뉴스 갱신 배지·시장 주목종목 상대 시간

### 코드
- [ ] `push_subscriptions` anon 클라이언트 데이터 접근 (RLS 정합 별건)
- [ ] `lint:tour-anchors` 고아 앵커 `ai-chok` 1건
- [ ] eslint 28 warning (`useStockData` 미사용 4 + exhaustive-deps 3, `<img>` 6)

## 다음 세션 진입점

파운더 액션 3건을 먼저 처리한다. 특히 **Finnhub 키 회전**은 유출 간주 상태라 최우선.
그다음 육안 검증 3건으로 이번 세션의 표기 변경(만/억·USD `.00`·상대 시간)을 확정한다.

코드 작업이 필요하면 감사 리포트의 D등급 기능군이 남아 있다 —
세무 v1(38F) · 오류관측(53D) · 초대코드(55D). 감사 산출물은 세션 스크래치패드에 있고,
워크플로 스크립트 `joobi-full-feature-audit-wf_1d124d24-301.js`로 재실행 가능하다.
