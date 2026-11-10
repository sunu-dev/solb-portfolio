# 2026-10-01 - main과 운영 배포 기준 동기화

## 작업 요약
- 사용자 승인으로 todo-final을 push하고 PR #43을 main에 merge.
- PR: https://github.com/sunu-dev/solb-portfolio/pull/43
- main / todo-final / origin/main / origin/todo-final 모두 `3fd5105f4738fc43dcb78bd857eebd7889c39236`로 일치.
- 현재 작업 브랜치 main. 미커밋 문서와 작업 기록은 보존.
- 없는 옛 main 작업 폴더 등록을 정리하고 로컬 main을 원격 최신 커밋으로 전진.
- Vercel Git 연결의 운영 브랜치 main, 자동 배포 활성화 확인.
- 새 운영 배포 `dpl_JCAkbab1bDuaKacXPZeVWA8nbxMG` READY. source=git, githubCommitRef=main, githubCommitSha=3fd5105 확인.

## 결정사항
- 기존 운영 앱 소스를 재현하면서 SQL 원본과 잠금 파일의 CI 누락만 보완.
- c0a4a41: 운영 관련 SQL 원본 4개 보존. DB 실행/변경 없음.
- 9eba06f, 4cec10d: npm 11/Mac 및 npm 10/GitHub CI에서 요구하는 선택 의존성 잠금 항목 7개 추가. 기존 잠금 기록/버전은 유지.
- main 병합 전 CI 실패는 설치 시 누락된 선택 의존성 문제였으며 앱 변경/검사 우회 없이 해결.
- 별도 명령 범위에 저장된 sunu-dev 인증 사용. 기본 GitHub 계정 설정은 변경하지 않음.
- 건강 점수 전체 개편·반려된 원형/좌표 맵·브랜드 시안은 포함하지 않음.

## 검증
- 기존 운영 소스 517개 중 package-lock.json 제외 516개 SHA1 일치.
- 깨끗한 의존성 설치, 타입·정적 검사 및 ESLint 오류 0 (기존 경고 유지).
- 테스트 1,039 passed / 1 skipped, Next.js 16.2.1 Turbopack 운영 빌드 성공.
- 로컬 제한 네트워크의 Google Fonts 다운로드 실패는 네트워크 허용 환경에서 재실행하여 해결.
- PR GitHub CI(타입·게이트·테스트, 프로덕션 빌드) 모두 통과. Vercel preview 성공.
- main GitHub CI 성공: https://github.com/sunu-dev/solb-portfolio/actions/runs/36856196887
- 새 운영 / 및 /api/economic-events HTTP 200. 주비 제목, 경제 일정 63개 확인.
- 미국 노동통계국 일정은 기존과 같이 마지막 검증 목록 사용 경고가 있음.
- 최근 운영 오류 로그 조회 결과 0건. 실제 iPhone Safari 및 로그인 계정 전체 흐름은 기존 후속 확인 범위.

## 미해결 TODO
- [ ] 남아 있는 문서·세셔너리·AGENTS 수정의 커밋 정리.
- [ ] SQL 원본의 운영 DB 적용 상태 대조 (이번 작업은 원본 커밋만 수행).
- 기존 실제 iPhone Safari 확인 등 TODO 유지.

## 다음 세션 진입점
- main `3fd5105`가 운영 기준이며 todo-final도 동일 커밋.
- 현재 운영은 Git main으로 자동 배포된 위 배포. 임시 운영 복원 폴더가 없어도 저장소에서 재현 가능.
- 미커밋 제품 소스/반려 시안은 없고 문서·기록만 남음.
- 영구 메모리 승급 후보 없음: 기존 main 운영 연결을 정합성 있게 복구한 실행 기록으로 보관.

## 후속 - 남은 브랜치 조사
- GitHub 최신 브랜치 14개(main 포함), 전체 PR 43개 확인. 열린 PR 0개.
- main 이외 13개 중 11개는 모든 커밋이 main의 조상이며 미병합 커밋 0개. 로컬/원격 삭제 후보로 분류.
- 후보: chore/sessionary-2026-08-20, feat/ai-cost-ledger, feat/boj-api-v1, feat/macro-edu-tips, feat/macro-indicators, feat/macro-japan, review-jp, todo-boj, todo-final, todo-jp, wrapup.
- feat/macro-edu-tips의 로컬 ahead 1은 이미 main에 포함된 PR #35 병합 커밋이며 미반영 기능이 아님.
- tax-v1-slice(2026-06-03), tax-v1-canary(2026-06-04)는 각각 고유 2커밋, PR 없음, main 미반영. 로컬/원격 SHA 동일.
- slice는 증권사별 실현손익 입력·합산 추정 UI/store/helper/test의 초기형. canary는 이후 main 기반 재통합에 다크모드·음수입력·인앱 저장 안전성·이용 의향 측정 추가.
- 기존 6월 기록상 지인 검증 결과를 기다리는 실험. canary는 현재 main보다 148커밋 뒤, slice는 176커밋 뒤. 현재 앱에 그대로 병합하는 안은 권하지 않음.
- 브랜치 조사만 수행했고 삭제/병합/배포하지 않음. 11개 완료 브랜치는 삭제 가능, tax 2개는 보관 판단 후 별도 정리.
