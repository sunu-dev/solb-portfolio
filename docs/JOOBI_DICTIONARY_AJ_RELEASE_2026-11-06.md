# 2026-11-06 주식사전 A·J 구현 검수

## 변경
- 사용자 선택 A 링 수첩을 전체 사전, J 미니 수첩을 용어 설명에 적용했다.
- 전체(PC)·더보기(모바일)·기존 책 아이콘이 동일한 사전을 연다.
- 목록/단어 찾기/헷갈려요 분류, 뜻·예시·출처, 저장·개인 메모·선택 퀴즈를 기존 계정 저장과 연결했다.
- 모바일은 목록과 설명을 분리한다. 퀴즈와 저장 안내는 하단에 유지하고 본문만 스크롤한다.
- 공통 토큰/컴포넌트/상태는 [디자인 시스템](JOOBI_DICTIONARY_DESIGN_SYSTEM.md)에 기록했다.

## 선별 범위
- 정본 후보 `/private/tmp/joobi-dictionary-aj-20261106`.
- 직전 운영 정본 `/private/tmp/joobi-chat-speed-20261106` 대비 12개 파일만 변경. 루트의 다른 미완성 변경은 배포 대상에 포함하지 않았다.
- 목록/해시: `artifacts/dictionary-aj-implementation-20261106/files.json`, `source-hashes.json`.
- DB 스키마·AI 모델·프롬프트·호출 횟수·채팅 속도 변경 없음.

## 확인한 동작
- 실제 Chromium 브라우저: PC 전체 메뉴 / 모바일 더보기 → A 열기.
- 용어 검색 → 저장 → 헷갈려요 표시 → 메모 저장 → 새로고침 후 복원.
- 저장한 3개 용어의 퀴즈 → 완료 → 사전 복귀.
- A 설명 속 용어 → J → 저장 → A에서 해당 용어 보기. J 중복 없이 닫힘.
- 실제 SOXL 종목 설명에서 ETF → J 미니 수첩 → A의 ETF 선택까지 확인.
- Escape로 닫기, 책 아이콘 포커스 복원, PC1280·모바일390 가로 넘침 없음, 페이지 오류 없음.
- 다크 모드 직접 렌더 확인. 전역 다크 입력 배경 규칙이 수첩 검색창을 덮는 문제 수정.
- 별도 QA 계정에서 실제 DB 저장·메모 수정·새로고침 복원·삭제 확인. 실제 사용자 자료 변경 없음.

## 자동 확인
- 로컬 자동 검사: 206개 테스트 파일 통과, 9개 생략; 테스트 2,238개 통과, 13개 생략.
- UI/알림/한국어/다크 모드/투어 앵커 검사 통과.
- 후보 타입 검사와 변경 TSX/TS 파일 ESLint 통과.
- 기본 Turbopack 로컬 빌드는 후보의 외부 node_modules 심볼릭 링크를 허용하지 않아 실패. 같은 소스의 webpack 빌드는 통과. 운영 원격 빌드는 실제 설치한 의존성으로 별도 확인한다.
- 루트 타입 검사에는 기존 artifacts 안 TSX의 누락 속성 오류가 있음. 후보 검사와 구분한다.

## 제한과 후속
- 실제 iPhone Safari 키보드·터치 스크롤 재검수는 별도. 모바일 크기의 Chromium 결과로 실기 완료를 주장하지 않는다.
- 별칭과 카카오 연결 계정 이름 분리는 미구현 후속 작업.
- QA Auth 완전 삭제는 DB 오류로 실패해 해당 계정을 비활성화했다. 테스트 사전/동의/포트폴리오는 별도 삭제 처리. 비공개 영수증은 `/private/tmp/joobi-browser-qa/dictionary-receipt.json`. 실제 사용자 계정에 조치하지 않았다.
- 과거 채팅 답변의 정확도/지연 문제는 이번 사전 디자인 완료와 별개다.

## 배포
- 운영: https://joobi.kr
- 배포 ID: `dpl_4J1fTqVPjpYfFMgSDioqoytQz98i`, READY / production.
- 배포 URL: https://solb-portfolio-p6fjl3252-sunudevelop-1252s-projects.vercel.app
- 원격 기본 Turbopack 빌드 성공. 원격 테스트 2,235개 통과·16개 환경 조건 생략. 빌드 약 2분.
- 운영 도메인 전환 전 첫 페이지 HTTP200 확인. `vercel promote` 성공.
- 롤백 보존: `dpl_3hmAkLPXdmqwxkEYA86uxpR2YS9m`.
- Git 커밋 배포가 아니라 기존 운영 정본 대비 12개 선별 파일 업로드. 소스 해시로 추적.
- 운영 브라우저: HTTP200, PC전체/모바일더보기·저장·J→A 통과, 가로 넘침0·페이지 오류0. `artifacts/dictionary-aj-implementation-20261106/production-verification.json`.
- 배포 후 최근10분 오류 수준 서버 로그 조회 결과 없음. 전체 서비스 무오류를 보증하는 결과는 아니다. Drains/모니터링 설정은 이번 변경에서 조회하지 않았다.

### 후속 통합 배포
- 최신 운영 `dpl_4VidRgZjX53BsYS4sm8GaXETYnGd` / https://solb-portfolio-rejwpwfof-sunudevelop-1252s-projects.vercel.app.
- 사전 하단 정렬과 사용자의 추가 요청(물어보기·중복 구분선·펼친 답변 디자인)을 합쳐 최종16개 파일로 반영했다.
- 중간 수첩 정렬 배포 `dpl_H6vzH7m1pgFNbtR6EZ3uDqUJD3F7`은 운영 주소에 연결하지 않았다.
- 최종 원격 테스트2236통과16생략, 빌드성공, 도메인 전환 성공. 채팅 세부 검수는 JOOBI_CHAT_EXPANDED_AUDIT_2026-11-06.md 참조.
