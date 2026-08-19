# 2026-07-21 - JOOBI 확정 락업 폰트 30안

## 작업 요약

사용자와 조율한 14번 기반 락업 알고리즘을 고정하고, `JOO BI`에 서로 다른 실제 폰트 30종을 적용한 비교 화면을 `/brand-preview/lockup-30`에 구현했다.

## 결정사항

- 고정 요소: 왼쪽 아이콘, 한 줄 `JOO BI`, 아래 한 줄 `나만의 주식 비서`, `JOO↔주식`·`BI↔비서` 대응, 영문 24px·나만의 10px·주식/비서 15px.
- 기존 55안은 보존하고 확정 락업 30안은 별도 경로에서 비교한다.
- 핵심 비교 변수는 `JOO BI` 폰트다. 기존 20종에 Onest, Inter Tight, Figtree, Epilogue, Red Hat Display, League Spartan, Space Mono, IBM Plex Mono, Bodoni Moda, Yeseva One을 추가했다.
- 30종 모두 미리보기용 영문 글리프 파일을 자체 호스팅해 브라우저의 대체 폰트로 보이는 문제를 막았다.
- 앱의 실제 헤더 워드마크는 아직 변경하지 않는다.

## 검증

- 전체 사전 린트, TypeScript, Next.js 16.2.1 프로덕션 빌드 통과
- `/brand-preview/lockup-30` 정적 경로 생성 확인
- 실행 중인 로컬 서버에서 HTTP 응답과 30종 폰트 데이터 렌더링 확인

## 미해결 TODO

- [ ] 30종 폰트 중 3개 이하 1차 후보 선택
- [ ] 후보를 실제 헤더와 로그인 화면 크기로 비교
- [ ] 최종안의 라이트·다크·작은 모바일 크기 조정

## 다음 세션 진입점

`http://localhost:3002/brand-preview/lockup-30`에서 30종 폰트를 보고 번호 3개 이하를 고른다.
