# 2026-10-17 - 앱 공통 UI 확장

## 작업 요약
- 사용자 “나머지도 진행하자”에 따라 이전 종목 상세 공통화를 설정·인증·온보딩·관리자·데이터 관리로 확대했다.
- AppUI에 버튼·입력·탭·제목·스위치를 역할별로 정의하고 기존 프리미티브/네이티브 컨트롤을 연결했다. 일반 펼치기는 ReadingUI, 복합 사건/지표는 명시된 예외를 사용한다.
- 검수에서 발견한 다크 모드 패널/초대 카드 대비, 관리자 모바일 헤더, 긴 온보딩 스크롤, CSV 복합 버튼, 날짜 입력 아이콘도 보완했다.
- 격리 작업장61파일 변경을 원본 해시 확인 후 통합. MorningBriefing은 차이 패치로 기존 시장 관찰 작업 보존. 원본 전용 MarketWatch2파일의 summary 역할/CSS만 맞춰 새 lint 규칙을 통과시켰으며 격리 배포 소스에 기능을 넣지 않았다.
- 원본verify1,522pass/2skip, 격리1,489pass/1skip, Next운영빌드 성공. ESLint0오류·기존9경고. Chrome320/390/1440×두테마37검사, 읽기7/연결탐색18검사 통과. 이후 사용자 요청으로 2026-10-17 운영배포 READY 완료. 세부 배포·운영검수는 `2026-10-17-app-ui-production.md` 참조.

## 결정사항
- 같은 동작은 같은 글자·높이·상태·초점을 사용한다. 색상과 글자 토큰만 만들고 로컬 컨트롤을 그대로 두지 않는다. 의미 있는 시장/경고색과 시각화는 보존한다.
- 일반 컨트롤48px, 아이콘44px, 버튼14px/550, 입력16px. 페이지/읽기섹션/그룹 제목24/20/16px로 역할 구분.
- `lint:ui`를 verify/prebuild에 추가해 일반 summary의 공통 역할과 로컬 스타일 금지를 검사한다. 복합 카드 예외는 명시한다.
- 상세 기준은 `docs/UI_SYSTEM.md`와 읽기/한국어 SSOT에 연결. 기존 공통 디자인 방향의 구현이므로 새 영속 사용자 규칙을 메모리에 중복 승급할 후보 없음.

## 미해결 TODO
- [ ] iPhone Safari 실기기·큰 글자 설정·실계정/실제 OAuth 확인. CDN Pretendard는 운영 Chrome에서 확인 완료.

## 다음 세션 진입점
- `artifacts/app-ui-system-20261016/REPORT.md`, `changed-files.json`, `original-only.json`, 검수JSON/PNG/log.
- 격리 `/private/tmp/joobi-art-release-20261015`, 최초 백업 `/private/tmp/joobi-app-ui-before-20261016`. baseline용 integrate 스크립트는 재실행하지 않는다.
- 운영 반영 배포 ID는 `dpl_HKkEEiDibtxkxCNfaoqSRx4fjk5G`. 로컬 마스킹 공개 키 문제를 피하기 위해 Vercel 원격 빌드 사용.
