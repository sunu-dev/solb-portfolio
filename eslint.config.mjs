import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * 모듈 스코프 Supabase 클라이언트 생성 금지 (2026-08-18 전수 감사 후속).
 *
 * **전 파일 error.** 도입 시 baseline 14건이 있었으나 같은 날 전부 정리해 예외가 없다
 * (기존 위반을 warn으로 유예하던 블록은 sweep 완료와 함께 제거).
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
      ":matches(Program > VariableDeclaration, Program > ExportNamedDeclaration > VariableDeclaration) > VariableDeclarator > CallExpression[callee.name='createClient']",
    message:
      "모듈 스코프에서 Supabase 클라이언트를 만들지 마세요. 키가 없으면 빌드가 실패하거나 null이 영구 확정됩니다. @/lib/supabaseServer 의 getServiceClient()/requireServiceClient()를 요청 시점에 호출하세요.",
  },
  {
    // const x = url && key ? createClient(...) : null   ← 가드형(빌드는 통과, 조용히 죽음)
    selector:
      ":matches(Program > VariableDeclaration, Program > ExportNamedDeclaration > VariableDeclaration) > VariableDeclarator > :matches(ConditionalExpression, LogicalExpression) CallExpression[callee.name='createClient']",
    message:
      "가드형(`url && key ? createClient(...) : null`)도 모듈 스코프에서는 금지입니다. 빌드는 통과하지만 키가 없으면 null이 영구 확정돼 조용한 no-op이 됩니다. @/lib/supabaseServer 의 getServiceClient()를 요청 시점에 호출하세요.",
  },
  {
    // const db = requireServiceClient();  ← `() =>` 다섯 글자 누락 = 빌드 타임 throw 부활
    selector:
      ":matches(Program > VariableDeclaration, Program > ExportNamedDeclaration > VariableDeclaration) > VariableDeclarator > CallExpression[callee.name=/^require(Service|Auth)Client$/]",
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
    // ⚠️ baseline (2026-08-19) — eslint-plugin-react-hooks 7.0.1→7.1.1 드리프트로
    // 신규 4룰이 error로 켜지며 기존 코드 24건이 걸렸다(전부 이번 드리프트 이전 코드).
    // rule-rollout-baseline 룰대로 warn으로 유예한다.
    // **warn 수는 줄어들기만 해야 한다** — sweep 후 이 블록을 제거해 error로 격상할 것
    // (TODO.md 'react-hooks 신규 4룰 sweep' 항목). 실측 24건:
    // set-state-in-effect 14 · purity 4 · refs 4 · immutability 2.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
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
]);

export default eslintConfig;
