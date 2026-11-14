# 2026-11-14 - 주식사전 운영 배포

## 작업 요약
- 사용자 운영 배포 승인. 구현 8d3e511을 독립 detached worktree에서 배포.
- 기존 운영 5ebb887 / dpl_4ZYFso4sxE7JqzSR1RVZyX735Mf4 확인 후 차이 검토.
- vercel deploy --prod --skip-domain으로 빌드, READY 확인 후 promote 성공.
- 현재 joobi.kr: dpl_FVVbu5FibYfrxCiNcJCdeiGm9fKJ / 8d3e511.
- URL: https://solb-portfolio-3inz8pobp-sunudevelop-1252s-projects.vercel.app
- 이전 운영을 복구 후보로 보존. push/DB/환경변수/인증 설정 변경 없음.

## 검증
- 원격 빌드 성공. 원격 테스트2929통과20생략(256파일통과13생략).
- 기존 로컬 최종 검사2932통과17생략, 도구4/quality66/타입/공통lint/빌드 통과. 환경별 결과 구분.
- joobi.kr inspect: 새 ID 일치, READY, production.
- 공개 홈200, Pretendard/종이 재질200 및 로컬 SHA256 일치.
- 개발용 /brand-preview/dictionary-material은 운영404.
- 신규 배포 runtime error/fatal 16:23:04~16:38:04 KST 조회0건, 누락 구간 없음.
- 운영 로그인 후 사전 조작은 미검수. 실제 휴대폰/타 브라우저/OS 동작 줄이기 미검수.
- 실제 모델/운영 질문 호출 없음.

## 결정사항
- 검수한 정확한 커밋만 독립 경로에서 빌드. 배포 문서 변경은 배포 산출물과 분리.
- 원격 origin/main은 dcc031c, 다른 원격 브랜치 없음. 사용자의 다음 main push 전에 최신 운영 코드 포함 여부 확인 필요.
- 공개 응답 검증과 로그인 실사용 검증을 구분. 짧은 로그 구간을 장기 안정성으로 해석하지 않음.

## 미해결 TODO
- [ ] 운영 로그인 후 사전 넘김·저장·퀴즈 복귀 확인.
- [ ] 실제 휴대폰/다른 브라우저/OS reduced-motion 검수.

## 다음 세션 진입점
- HANDOFF.txt, sessionary/2026-11-14-dictionary-hinged-leaf.md.
- 배포 worktree /private/tmp/joobi-dictionary-release-20261114 유지.
- 배포/검사 종료. 기존 local3013 dev서버 유지, 다른 프로젝트3122 미조작.
- 배포 로그 /private/tmp/joobi-dictionary-production-deploy.log, remote-build.log, promote.log.
- 로컬 기록 커밋만 진행. 신규 영속 메모리 규칙 없음.
