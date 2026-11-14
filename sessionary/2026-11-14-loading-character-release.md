# 2026-11-14 - 로딩 캐릭터·사전 아이콘 운영 배포

## 작업 요약
- 사용자 배포 승인. 시작09421b7/작업 트리 깨끗함 확인.
- 현재 운영8d3e511의 ID를 재확인 후 정확한09421b7 독립 worktree 준비.
- prod/skip-domain 원격 빌드 후 READY 확인, promote 성공.
- 운영: https://joobi.kr / dpl_HJtNLe8vUJV3hUbjhRKedRpbarge / 09421b7.
- 배포 URL: https://solb-portfolio-mpkqkjqk3-sunudevelop-1252s-projects.vercel.app
- 복구 후보: 8d3e511 / dpl_FVVbu5FibYfrxCiNcJCdeiGm9fKJ.

## 검증
- 원격2930통과20생략(256파일통과13생략), 원격빌드 약4분 성공.
- 이전 로컬2933통과17생략/도구4/quality66/타입·lint·빌드 통과와 구분.
- joobi.kr inspect: 새 ID 일치, READY, production.
- 공개 홈200, 새싹 이미지200 및 로컬 SHA256 일치.
- /brand-preview/character-motion 운영404.
- 신규 배포 runtime error/fatal21:01:31~21:11:31 KST 조회0건, excludedIntervals 없음.
- 운영 로그인 후 실제 동작/모바일/OS reduced-motion 미검수. 운영 질문 발송 없음.

## 결정사항
- 검수한 커밋만 독립 배포 후 도메인 연결. 기존 운영은 복구 후보로 보존.
- push/DB/인증·계정 설정/환경변수 변경 없음. 새 배포는 로딩 시각 표현·아이콘 변경.
- 단기 서버 로그와 HTTP 검증은 실기기 애니메이션 검수를 대신하지 않음.

## 미해결 TODO
- [ ] 운영 로그인 후 로딩/오류 표정·사전 아이콘 실검수.
- [ ] 전체 동작 프레임/실제 휴대폰/OS reduced-motion 확인.

## 다음 세션 진입점
- HANDOFF.txt, sessionary/2026-11-14-loading-character-and-dictionary-icon.md.
- /private/tmp/joobi-motion-release-20261114 유지. 기존 localhost3013 유지.
- 배포/검사 프로세스 종료. 로컬 문서 커밋만. 신규 메모리 승급 없음.
- 로그 /private/tmp/joobi-motion-{deploy,remote-build,promote}.log.
