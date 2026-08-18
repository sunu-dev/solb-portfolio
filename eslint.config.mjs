import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * 모듈 스코프 Supabase 클라이언트 생성 금지 (2026-08-18 전수 감사 후속).
 *
 * 두 가지 실패 모드를 막는다.
 *
 * 1) **`!` 단언형** — `createClient(url!, serviceKey!)`
 *    Next가 빌드 중 page data를 수집하며 라우트 모듈을 import하므로, 키가 없으면
 *    `Error: supabaseKey is required`로 **빌드 전체가 실패**한다.
 *    (서비스키 없는 프리뷰 환경은 빌드조차 불가했다.)
 *    이건 CI의 '런타임 비밀 없이 빌드' 잡이 잡아준다.
 *
 * 2) **가드형** — `url && key ? createClient(url, key) : null`
 *    빌드는 통과하므로 CI가 못 잡는다. 대신 키가 없으면 모듈 로드 시점에 `null`이
 *    **영구 확정**되어, 이후 모든 요청에서 조용한 no-op이 된다.
 *    실패 신호가 어디에도 남지 않는 이 패턴은 이미 두 번 사고를 냈다
 *    (2026-05-20 `ai_chok_cache`, 2026-08-18 `chokDataEnricher` L2 캐시 영구 무력).
 *    감지할 게이트가 없어서 이 룰이 필요하다.
 *
 * 해법: `src/lib/supabaseServer.ts`의 `getServiceClient()`/`requireServiceClient()`를
 * **요청 시점에** 호출한다. 라우트에서는 `const db = () => requireServiceClient();`처럼
 * 지연 참조로 두고 `db().from(...)`으로 쓴다.
 *
 * 예외는 두 파일뿐 — 팩토리 자신과 브라우저 싱글턴.
 */
const NO_MODULE_SCOPE_CLIENT = [
  {
    // const x = createClient(...)  /  export const x = createClient(...)
    selector:
      "Program > :matches(VariableDeclaration, ExportNamedDeclaration > VariableDeclaration) > VariableDeclarator > CallExpression[callee.name='createClient']",
    message:
      "모듈 스코프에서 Supabase 클라이언트를 만들지 마세요. 키가 없으면 빌드가 실패하거나 null이 영구 확정됩니다. @/lib/supabaseServer 의 getServiceClient()/requireServiceClient()를 요청 시점에 호출하세요.",
  },
  {
    // const x = url && key ? createClient(...) : null   ← 가드형(빌드는 통과, 조용히 죽음)
    selector:
      "Program > :matches(VariableDeclaration, ExportNamedDeclaration > VariableDeclaration) > VariableDeclarator > :matches(ConditionalExpression, LogicalExpression) CallExpression[callee.name='createClient']",
    message:
      "가드형(`url && key ? createClient(...) : null`)도 모듈 스코프에서는 금지입니다. 빌드는 통과하지만 키가 없으면 null이 영구 확정돼 조용한 no-op이 됩니다. @/lib/supabaseServer 의 getServiceClient()를 요청 시점에 호출하세요.",
  },
  {
    // const db = requireServiceClient();  ← `() =>` 다섯 글자 누락 = 빌드 타임 throw 부활
    selector:
      "Program > :matches(VariableDeclaration, ExportNamedDeclaration > VariableDeclaration) > VariableDeclarator > CallExpression[callee.name=/^require(Service|Auth)Client$/]",
    message:
      "requireServiceClient()/requireAuthClient()를 모듈 스코프에서 즉시 호출하면 빌드 타임 throw가 되살아납니다. `const db = () => requireServiceClient();` 처럼 지연 참조로 두세요.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...NO_MODULE_SCOPE_CLIENT],
    },
  },
  {
    // 팩토리 자신 — 여기가 유일한 생성 지점이다.
    // 브라우저 싱글턴 — NEXT_PUBLIC_* 만 쓰며 클라이언트 번들에서 즉시 필요하다.
    //   (다만 무가드라 이 두 값이 없으면 빌드가 throw한다 — CI가 placeholder를 주는 이유)
    files: ["src/lib/supabaseServer.ts", "src/lib/supabase.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    /**
     * 도입 시점 baseline (2026-08-18) — 기존 14건.
     *
     * 이 파일들은 전환에 **함수 단위 수정**이 필요하다. 모듈 상수를 지연 함수로 바꾸면
     * `if (!supabase)` 가드가 항상 false가 되고, `supabase()`를 두 번 부르면 TypeScript가
     * 두 번째 호출을 non-null로 좁히지 못한다. 즉 각 함수 안에서
     * `const db = getServiceClient(); if (!db) return ...;` 형태로 지역 변수를 둬야 하며,
     * 11개 파일 약 30곳이 대상이다. 그 sweep은 별건으로 분리한다.
     *
     * 여기서는 **경고로 계속 보이게** 두되 빌드는 막지 않는다.
     * 이 목록 밖에서 새로 생기는 위반은 위 설정에 따라 error로 CI에서 차단된다.
     * (lint:korean 격식 어휘가 66건 baseline → sweep → strict를 밟은 것과 같은 경로.)
     *
     * ⚠️ 이 목록은 **줄어들기만 해야 한다.** 항목을 추가하려는 상황이면 그건
     * 새 위반을 baseline으로 숨기는 것이므로, 코드를 고치는 쪽이 맞다.
     */
    files: [
      "src/lib/rateLimiter.ts",
      "src/lib/circuitBreaker.ts",
      "src/lib/serverLogger.ts",
      "src/lib/userTier.ts",
      "src/lib/aiProvider.ts",
      "src/app/api/ai-analysis/route.ts",
      "src/app/api/ai-chok/route.ts",
      "src/app/api/portfolio/ocr/route.ts",
      "src/app/api/me/entitlements/route.ts",
      "src/app/api/pro-demand/config/route.ts",
      "src/app/api/pro-demand/event/route.ts",
    ],
    rules: {
      "no-restricted-syntax": ["warn", ...NO_MODULE_SCOPE_CLIENT],
    },
  },
]);

export default eslintConfig;
