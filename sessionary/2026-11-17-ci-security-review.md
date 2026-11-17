# 2026-11-17 - CI 오류 수정과 기술 보안 검토

## 작업 요약
- 최신 GitHub CI 44016686499 (6355927, 11/17 13:22 KST) verify 실패/build skipped. 최근8회 실패 확인. 어제 알림의 3파일10건은 현재 전체 범위를 대표하지 않음.
- 동일 npx eslint . 재현: 141errors/52warnings. require 금지140건과 module 지역변수명1건.
- scripts/**/*.cjs에만 no-require-imports off. 앱 TS 규칙 error 유지 확인. replay-market-flow-engine.cjs의 지역변수 module을 loadedModule로 변경.
- 전체eslint 0errors/52warnings, 도구테스트4통과, 스크립트구문검사 통과. 인증/한도/저장경계136통과3생략.
- 사용자 보안검토 요청: lockfile npm audit 전체/운영, 공식GHSA, 운영GET헤더·401, 인증/키접근 코드 표본 확인. 패키지 변경·키조회·DB조회·공격 재현·유료모델호출 없음.

## 의존성 결과
- 전체 중간15개 패키지 항목, 높음/치명적0. 운영 omit=dev는 중간6개. 3개 고유 advisory가 의존관계로 중복 전파됨. 안전성 보증이나 독립취약점15건이라는 의미 아님.
- next16.4.3: GHSA-mfr8-8qww-v76h 영향버전. 수정16.4.5, 최신동일라인16.4.6 확인. use cache와 unstable_cache 중첩/root param 경쟁조건. src/next.config에서 use cache·cacheComponents·Edge런타임 설정 없음. unstable_cache만 사용하므로 이 조건의 직접노출 증거 없음.
- Next16.4.5 공식릴리스는 관련7개 보안수정을 포함. npm audit에 잡힌1건만으로 범위를 제한하지 않음. self-hosted/Edge/cache 관련 추가조건은 현재Vercel/Node배포와 구분. Docker이전 시 재평가.
- glob13.0.6: GHSA-3g3m-2fjr-6pw4 (AbortSignal 후 파일순회 계속). 수정14.0.2.
- minimatch: GHSA-g3hv-75wg-m249 (외부glob패턴 증폭DoS). 수정11.0.1. Sentry빌드도구/ESLint/shadcn 하위경로. src에서 직접glob/minimatch 사용 발견안됨. 상위패키지 호환업데이트 검증 필요.
- npm audit fix --force가 제시하는 shadcn1.0.0 전환은 적용하지 않음. 무조건0건 만들기 위한 다운그레이드 금지.
- 실제lock: react/react-dom19.2.4,Sentry10.78.0,SupabaseJS2.118.0,Anthropic0.91.1,GoogleGenAI1.52.0,Resend6.35.0.
- React GHSA-xqc2-xf4c-x3h3는 react-server-dom 계열 대상. react19.2.4 숫자만으로 앱RCE를 단정하지 않음. 해당패키지 별도설치없고 Next내장본 사용. Next16.4.1의 10월보안수정 공식릴리스도 대조. 이번audit에서 React 직접항목 없음.

## 운영 설정과 제한
- joobi.kr 홈200. AI분석GET/관리자usageGET 비로그인401. AI응답 private,no-store. 이 두 요청만으로 전API 접근통제를 검증한 것은 아님.
- HSTS max-age63072000, X-Frame-Options SAMEORIGIN, nosniff 확인.
- CSP script-src unsafe-inline/unsafe-eval 운영허용. XSS 방어 보강 대상. unsafe-eval 개발만 허용 검토; nonce전환은 정적렌더링/CDN캐시 영향이 있어 별도설계.
- 인증은 서버 getUser(token), cron secret미설정시차단 코드 확인. 개인사전/알림테이블 RLS 마이그레이션 존재. 운영DB의 실제정책/권한/MFA/백업상태는 이번에 조회하지 않음.
- LLM/서비스키 NEXT_PUBLIC 참조 발견안됨. Finnhub의 legacy NEXT_PUBLIC fallback은 서버호출경로에 존재. 운영환경값이나 실제클라이언트번들 노출까지 증명한 것은 아님.
- 침해사고/유출 여부 조사와 다른 검토. 모든라우트·전체Git이력 비밀검사·클라우드계정/DB·컨테이너이미지는 미검증.

## 결정사항
- CI차단 원인은 CommonJS와 맞지 않는규칙 적용이므로 파일유형별 최소예외로 수정. 보안규칙 전역끄기나 전체스크립트 lint제외 없음.
- 보안요청은 검토 범위. 의존성/운영CSP는 이번에 변경하지 않음. Next16.4.6+일치eslint-config-next 패치부터 별도검증 권장.
- 이전 린트통과는 변경파일범위였다. 전체CI와 혼동하지 않도록 앞으로 전체eslint결과 구분.

## 미해결 TODO
- [ ] Next16.4.6/eslint-config-next 동일버전 패치 및 lock/전체검사/빌드 검증.
- [ ] Sentry/glob/minimatch/개발도구 호환패치 검토.
- [ ] CSP강화와 실제브라우저/OAuth/공유기능 검수.
- [ ] 사용자push 후 GitHub verify/build 성공 및 Vercel배포 확인.
- [ ] 운영 RLS/MFA/최소권한/복구·백업 추가읽기점검.

## 다음 세션 진입점
- HANDOFF.txt, eslint.config.mjs, scripts/replay-market-flow-engine.cjs, next.config.ts, package-lock.json.
- /private/tmp/joobi-ci-{remote-failed,eslint,eslint-fixed,eslint-final}.log, joobi-security-npm-{audit,production}.json.
- 원격main 마지막조회6355927. 로컬뉴스d66fd8e/문서db95c25 이후CI수정. push/배포 없음.

## 공식 근거
- https://github.com/sunu-dev/solb-portfolio/actions/runs/44016686499
- https://github.com/vercel/next.js/releases/tag/v16.4.5
- https://github.com/vercel/next.js/releases/tag/v16.4.6
- https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h
- https://github.com/advisories/GHSA-3g3m-2fjr-6pw4
- https://github.com/advisories/GHSA-g3hv-75wg-m249
- https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3
- https://github.com/vercel/next.js/releases/tag/v16.4.1
- https://nextjs.org/docs/app/guides/content-security-policy

## 사용자 승인 후 보안패치
- Next/eslint-config-next16.4.3→16.4.6. Sentry10을 유지하며 bundler-plugins의 glob14.0.2, 취약범위 minimatch만11.0.1 override. 영향없는 minimatch3 유지.
- 운영 CSP unsafe-eval 제거, 개발모드만 유지. frame-ancestors self 추가. unsafe-inline 제거는 nonce/동적렌더 설계가 필요하므로 이번 범위에서 유지.
- 프롬프트 금지예시의 격식체를 같은 의미의 지시로 변경: 전체 한국어게이트 실패 해소.
- npm install이 선택의존성 일부를 누락하여 npm ci dry-run 실패. 임시 디렉터리에서 lock-only 복구 후 실제 npm ci --ignore-scripts 성공. 기본 npm캐시 권한충돌은 별도 임시캐시 사용으로 해소.
- 최종 npm audit 전체0건. 알려진 패키지 취약점 기준이며 서비스 전체 안전을 보증하지 않음.
- 클린설치 후 verify:2984통과22생략/도구4통과/타입 및 모든 제품게이트 통과. 전체ESLint0오류52기존경고.
- 기본 next build(Turbopack) 성공. 제한환경에서는 진척없어 중단한 뒤 권한 있는 실행에서 성공. webpack 대체로 숨기지 않음.
- Sentry globFiles와 shadcn ts-morph 실제파일탐색 호환성 확인. 전체 Sentry업로드/CLI생성 기능은 미실행.
- 로컬 production 홈200, unsafe-eval 없음/frame-ancestors self 헤더확인. 사전열기/주식분할설명/질문창열기 통과. eval CSP오류없음. Vercel통계스크립트는 로컬404/MIME오류(플랫폼전용), 기존preload경고1.
- 원격CI/운영배포/로그인후대화 검증 미실행. 유료모델호출0, 운영계정/DB/키 변경없음. push는 사용자가 직접 진행.
- 로그 /private/tmp/joobi-security-{verify,eslint,build,ci-install}.log 및 audit-after.json. 임시 npm캐시/lockfix는 /private/tmp 아래.

## 남은 후속
- 사용자push 후 원격CI/운영READY와 실제CSP검증.
- 실제DB RLS/MFA 검토, 상위의존성이 패치를 지원하면 overrides 제거.
