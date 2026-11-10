# 2026-11-06 - 주식사전 A·J 구현과 운영 반영

## 작업 요약
- 사용자가 추천 조합 A 링 수첩 전체 화면 + J 빼꼼 미니 수첩에 “그렇게 진행하자”로 승인했다.
- 기존 계정별 사전·검증된 용어·퀴즈 로직 위에 A/J 실제 컴포넌트와 공통 디자인 토큰을 구현했다.
- 전체(PC)/더보기(모바일), 기존 책 아이콘이 동일한 native dialog 사전을 연다. J에서 A의 해당 단어로 이어진다.
- 모바일은 목록/설명을 전환하고 하단 저장 안내·퀴즈 버튼은 고정했다. 읽는 영역만 스크롤. 캐릭터 설정을 존중하며 기본 새싹 사용.
- 문서: docs/JOOBI_DICTIONARY_DESIGN_SYSTEM.md / docs/JOOBI_DICTIONARY_AJ_RELEASE_2026-11-06.md.
- 관련 구현 12개 파일만 직전 운영 정본 위에 선별했다. 루트의 다른 변경은 배포하지 않았다.

## 결정사항
- 아날로그 장식은 실제 설명과 버튼을 가리지 않게 배치. 손글씨는 제목/단어 이름에만, 본문과 입력은 16px 시스템 글꼴.
- 공통 토큰/버튼/저장 상태를 A/J에서 공유해 화면마다 다시 디자인하지 않는다. AI 호출·DB 스키마·채팅 모델을 추가/변경하지 않았다.
- 빈 화면은 짧은 저장 안내와 읽을 수 있는 기본 용어 제공. 0문제 버튼은 숨긴다.
- 게스트는 브라우저, 로그인은 계정 저장. 미확인 직접 추가 단어는 퀴즈에서 제외. 기존 원칙 유지.

## 검증과 배포
- Chromium PC1280/모바일390/다크 직접 렌더 확인. 검색→저장→헷갈려요→메모→새로고침 복원→퀴즈3문제 완료.
- SOXL 설명 ETF 용어→J→A 해당 용어 선택 확인. Escape/포커스 복원 확인.
- 별도 QA 로그인 계정의 실제 클라우드 저장·메모·복원·삭제 확인. 실제 사용자 자료 변경 없음.
- 후보 타입/변경 파일 ESLint/UI·다크 등 검사 통과. 로컬2238통과13생략, 원격2235통과16생략.
- 로컬 기본 Turbopack은 외부 node_modules 링크 때문에 실패, webpack 성공. 원격 실제 설치에서는 기본 Turbopack 빌드 성공.
- 운영 dpl_4J1fTqVPjpYfFMgSDioqoytQz98i / https://solb-portfolio-p6fjl3252-sunudevelop-1252s-projects.vercel.app / joobi.kr.
- 정본 /private/tmp/joobi-dictionary-aj-20261106. 이전 dpl_3hmAkLPXdmqwxkEYA86uxpR2YS9m 롤백 보존.
- 운영 브라우저 HTTP200, PC전체/모바일더보기·저장·J→A 통과, 가로 넘침 없음, 페이지 오류 없음. 최근10분 오류 수준 로그 조회 결과 없음.
- 증거 artifacts/dictionary-aj-implementation-20261106: files/hash, cloud/browser/production-verification, 화면 PNG.
- 별도 QA Auth 완전 삭제 DB 오류. 실제 테스트 데이터 3테이블0건 확인 후 QA 계정 비활성화. 비공개 영수증 /private/tmp/joobi-browser-qa/dictionary-receipt.json. TODO 추적.

## 미해결 TODO
- [ ] 실제 iPhone Safari 키보드 열린 상태의 메모·스크롤·닫기 재확인. Chromium 크기 검수와 구분.
- [ ] 별칭을 일반 화면에, 카카오 이름은 내정보에만 표시하는 후속.
- [ ] QA Auth 완전 삭제 DB 오류 해결. 비활성화 계정의 개인 식별 정보를 문서에 쓰지 않는다.
- [ ] 기존 챗봇 시황 응답 속도 문제는 이번 사전 작업과 별개로 남음.

## 다음 세션 진입점
- 새 시안을 다시 선택받지 말 것. A+J는 사용자 선택과 운영 반영 완료.
- 사전 변경은 디자인 시스템과 실제 운영 캡처를 기준으로 이어간다.
- 전체 루트 배포 금지. 현 운영 정본에서 필요한 파일만 선별한다.
- 결정은 디자인 시스템 문서에 기록. auto-memory 중복 승급은 하지 않음.
