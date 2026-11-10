# 2026-09-10 - 첫 접속 포트폴리오 계정 경계

## 작업 요약
- 사용자: 오늘 첫 Safari 접속에서 로그인 버튼·게스트 배너와 이전 개인 보유 잔액이 함께 노출됨.
- 이전 로그아웃 이벤트 경합 수정은 초기 세션 null 경로를 처리하지 못했음.
- Home을 인증/스토리지 확인 경계와 HomeContent로 분리. 확인 완료 전에는 보유 화면·시세 요청·클라우드 동기화 hook을 마운트하지 않음.
- persist에 portfolioOwnerId 추가. 같은 계정만 로컬 기록 유지. legacy 소유자 불명·다른 계정·비로그인은 복구본 검증 후 분리.
- 복구본에는 영속 state 및 사용자 저장 키/outbox 포함. 원본 reset 전에 저장 후 읽기 검증. quota/차단 시 안내 화면으로 fail-closed.
- OAuth 진행 중 solb_consent_pending은 초기 경계 정리에서 보존. 일반 로그아웃 정리 정책은 유지.
- resetPortfolio가 최근 조회 종목/분석 화면/현재 섹션도 초기화하도록 보강.
- 로컬 verify: 880 passed, 1 skipped. 변경 파일 ESLint 오류 0, 기존 page effect 경고 2.
- 실제 격리 Chrome, 모바일 390×844: 가짜 legacy PRIVACYTEST 보유 삽입 후 첫 방문·reload 시 화면 노출 0, 종목 전송 요청 0, pageerror 0. 복구본 1개 + 활성 holdings 빈 배열 확인.
- 같은 브라우저에서 복구본 쓰기 quota 오류 주입: 안내 화면 표시, 원본 유지, 노출/요청/pageerror 0.
- 테스트 스크립트 `/tmp/solb-first-visit.mjs`, 스크린샷 `/tmp/solb-first-visit-guest.png`, `/tmp/solb-first-visit-blocked.png` (임시 파일).

## 결정사항
- 출처 불명 로컬 기록을 다음 로그인 계정에 자동 귀속하면 다른 계정 DB를 오염시킬 수 있어 자동 이전 금지.
- 복구본 키 `solb_portfolio_recovery_v1:`는 clearUserStorage 대상에서 제외. 자동 복원 UI는 이번 범위에 없음.
- 서버 포트폴리오 삭제/DB 마이그레이션 없음. 기존 dirty worktree 보존, 커밋/푸시 없음.
- 기존 Supabase 인증 유지. 스킬의 다른 인증 제공자 권고로 범위를 확대하지 않음.

## 미해결 TODO
- [ ] 사용자 실제 iPhone Safari에서 새 배포 접속 확인. Chromium 모바일 크기 테스트와 실기기 검증은 구분.
- [ ] 복구본의 수동 확인/귀속·복원 UX는 별도 작업. 임의 계정 자동 복원 금지.
- [ ] 초대코드 후 첫 저장·재접속 등 전체 운영 GO 감사는 별도 미완료.

## 다음 세션 진입점
- `src/lib/portfolioIdentity.ts`, `src/app/page.tsx` 상단, `src/__tests__/portfolioIdentity.test.ts` 참고.
- 초기 세션 없음과 명시적 로그아웃은 다른 경로다. 하나의 테스트로 둘을 검증했다고 선언하지 말 것.

## 운영 결과
- 최종 배포 `dpl_FWCrm2nEPB99pgh1wRhqRpf1DiSh` READY. `https://solb-portfolio.vercel.app` alias 반영.
- immutable: `https://solb-portfolio-cgj04vuo1-sunudevelop-1252s-projects.vercel.app`.
- 원격 878 passed, 3 skipped, 타입 검사·Next 빌드 성공.
- 운영 URL에서 동일 격리 Chrome 모바일 시나리오 재실행: 정상 보존 후 게스트 표시/reload 및 quota 실패 원본 유지 모두 통과. 개인 종목 화면 노출·요청·pageerror 각각 0.
- 최종 배포 error 로그 조회: No logs found. 전체 서비스 오류 없음 또는 전체 가입 E2E 완료를 의미하지 않음.
- 메모리 승급 후보: 계정 확인 전 개인 데이터 복원/동기화 금지, 소유자 불명 기록은 보존 후 격리. 사용자 승인 전 영구 메모리 수정 없음.
