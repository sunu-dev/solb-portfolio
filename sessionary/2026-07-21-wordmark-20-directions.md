# 2026-07-21 - JOOBI 영문 워드마크 20안

## 작업 요약

기존 영문 JOOBI 6안은 보존하고 전혀 다른 14개 방향을 추가해 `/brand-preview`를 총 20개 브랜드 방향 보드로 확장했다. 데스크톱에서는 5×4 카드로 한 화면에 비교하고, 좁은 화면에서는 4열·2열·1열로 반응한다.

## 결정사항

- 폰트만 바꾸지 않고 대소문자, 줄바꿈, 이름 분리, 배경, 패턴, 색, 태그라인과 브랜드 태도까지 다르게 제안한다.
- 기존 6안은 Product system, Soft intelligence, Editorial finance, Bold utility, Global consumer, Creative tech다.
- 신규 14안은 Neo craft, Art poster, Future wide, Friendly modern, Premium serif, Quiet luxury, Retro future, Calm clarity, Market terminal, Classic finance, App first, Alt geometry, Condensed signal, Stencil identity다.
- 비교용 영문 글자 서브셋 20개만 자체 호스팅하며 합계는 약 144KB다.
- 실제 서비스 워드마크는 아직 변경하지 않는다.

## 검증

- 전체 사전 린트, TypeScript, Next.js 16.2.1 프로덕션 빌드 통과
- `/brand-preview` 정적 HTML에서 20개 콘셉트 모두 출력 확인
- 대표 신규 폰트 Unbounded·Black Ops One HTTP 200 확인
- 자동 브라우저 화면 캡처는 브라우저 런타임의 kernel assets 오류로 수행하지 못했다.

## 미해결 TODO

- [ ] 20안 중 3개 이하 쇼트리스트 선택
- [ ] 선택안을 실제 헤더·랜딩·로그인 크기로 비교
- [ ] 최종 선택 후 미사용 19개 폰트 제거 및 선택 폰트 라이선스 보관

## 다음 세션 진입점

`http://localhost:3000/brand-preview`에서 1~20번을 확인한다. 먼저 브랜드 태도 기준으로 3개 이하를 고르고, 그다음 실제 서비스 크기에서 최종 비교한다.
