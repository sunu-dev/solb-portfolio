# 2026-10-23 - 가입 설정 API 장애 후속 진단

## 작업 요약
- 직전 운영과 새 운영 모두 `/api/config`가 약 90초 후 500을 반환하던 현상을 재현했다. 기존 운영 함수 로그의 Supabase 응답은 Cloudflare 522 `Connection timed out` HTML이었다.
- 같은 Supabase 프로젝트를 로컬에서 읽기 전용으로 조회하니 `app_config`는 504 `Gateway Timeout`, `stock_listings`도 10초 안에 응답하지 않았다. 설정 테이블 한정 오류가 아닌 데이터 API 범위의 연결 문제로 판단했다. Supabase 상태 페이지에는 전날 `API Gateway Request Issues`가 모니터링 중으로 남아 있었으나, 이 프로젝트 장애와의 직접 인과는 확인되지 않았다.
- Supabase 프로젝트 관리 화면을 열어 상태를 확인하려 했지만 로그인 화면으로 이동해 프로젝트 내부 지표에는 접근하지 못했다.
- 공개 GET에 Supabase 쿼리 8초 제한, 실패 시 503·`no-store`·`Retry-After: 30`, 오류 본문을 그대로 찍지 않는 로그를 적용했다. 로그인 초대 안내 fetch에는 9초 제한과 해제 시 정리를 추가해 무기한 로딩을 막았다. 실패해도 열린 가입 상태를 지어내지 않는다.
- 공개 키 필터와 상위 서비스 실패 처리를 검증하는 테스트 2개를 추가했다. 격리본 `/private/tmp/joobi-login-design-20261023`에서 TypeScript, 전체 1705 tests + 1 skipped, UI/알림/한국어/다크/투어 검사, Next 빌드를 통과했다.
- 미리보기 `dpl_BVe1ta2M4hp1uARrS9sL5KdJg4s3`에서 API HEAD 503·9.27초를 확인했다. 운영 `dpl_6f7UiyPGErz58NE2AaQpTyWcskd3` READY, https://joobi.kr 연결. 운영 API HEAD 503·9.17초를 확인했고 Chrome 로그인 창에서 실패 안내로 전환되는 것을 보았다. 새 함수 로그는 HTML 전체 대신 상태/코드만 기록한다.

## 결정사항
- Supabase 원본 서버의 522/504는 앱 코드 수정이나 재배포로 복구할 수 없다. 서비스가 살아날 때까지 로그인 안내를 유한하게 끝내고 초대 조건을 추측하지 않는다.
- 미리보기는 Vercel 인증 보호로 브라우저 접근이 막혔다. CLI `vercel curl`로 미리보기 API를 검증하고 공개 운영 도메인에서 실제 로그인 UI를 검증했다. 보호 설정은 변경하지 않았다.
- root의 다른 대량 변경은 배포하지 않고 직전 운영 기준 격리본에 이번 변경 파일만 추가했다.

## 미해결 TODO
- [ ] Supabase 프로젝트의 데이터 API/DB 상태와 리소스·연결 수를 관리 콘솔 또는 공급자 지원으로 확인하고, 복구 후 `/api/config` 200 및 신규/기존 로그인 흐름을 다시 검증한다.
- [ ] 실제 Kakao OAuth 정상 연결·취소, 신규 가입과 재방문자 동의 과정을 사용자 참여로 검수한다.

## 다음 세션 진입점
- 운영: `dpl_6f7UiyPGErz58NE2AaQpTyWcskd3`, 이전: `dpl_A3qvCp35MiMRenTFdV8Rhqd53Vay`.
- 변경 파일: `src/app/api/config/route.ts`, `src/components/auth/LoginModal.tsx`, `src/__tests__/configRoute.test.ts`.
- Supabase 상태 확인 후 공개 `GET /api/config`의 `{ config: { service_mode, invite_required } }` 응답을 먼저 확인한다. 정상 200이면 로그인 창의 초대 안내와 실제 OAuth 후 가입 분기도 이어서 확인한다.
