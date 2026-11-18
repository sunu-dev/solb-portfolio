# 2026-11-18 - 개인 대화 기록 저장과 조회

## 작업 요약
- 사용자: 오늘 질문한 내용을 확인할 수 없다는 제보 후 계정 저장·날짜별 조회·삭제 개선 승인.
- 기존 메모리 전용 대화를 유지하면서 로그인 계정에 완료된 질문·답변의 읽기용 스냅샷과 출처 링크 저장.
- 이전 대화 화면에 오늘/어제/날짜 그룹,50개씩 더보기,개별/전체 삭제. 새로고침 시 종목·시장·기간별 최근20개 복원.
- 저장·조회 실패를 빈기록/성공으로 표시하지 않음. 동일UUID 재시도,AI 재호출 없음. 늦은복원과 새질문 병합,로그아웃 이후 결과 무시.
- 저장은 최대1000개. 초안/실패·중단질문/게스트 대화 영구저장 없음. 전체 기록을 AI에 보내지 않고 최근3개+작성시각만 사용.
- 저장내용은 원문기사/qualityReceipt/모델메타 제외. 삭제시질문·답변·대상 제거,삭제UUID묘비만 탈퇴까지유지해 지연재시도복원 차단.
- RLS본인조회,인증전용RPC는 auth.uid와 expected owner를 둘다확인. 계정변경이 세션확인과RPC사이에 생겨도 타계정저장/전체삭제 차단.
- 개인정보방침v5/시행일2026-11-18,질문창안내 및 제품원칙갱신. 기존검수사례30일보관과 개인기록을 구분.

## 검증
- npm run verify:3029통과23생략,별도도구4통과. 타입/UI·한국어·다크모드·투어 게이트 통과.
- 변경파일ESLint오류·경고0,git diff --check통과. npx next build --webpack통과.
- 신규13개검사:늦은복원병합/초안보존/복원기록재저장금지/저장실패재시도/로그아웃대기요청/삭제실패·성공/삭제중복원/타탭삭제후재시도/페이지조회·조회실패/출처·페이로드검증/KST날짜/계정경계.
- 격리Docker PostgreSQL17:최종migration적용 및 supabase/tests/joobi_conversation_history.sql 실행통과. 타계정읽기·쓰기·삭제차단,세션전환시owner거부,익명권한/직접업데이트차단,멱등성,삭제내용제거/재저장거부/탈퇴cascade.
- PostgreSQL은합성auth스키마와두합성계정. 실제운영Supabase검수가아님. 임시컨테이너삭제완료.
- 로컬브라우저 합성auth/API390px/1280px:이전답변복원,새질문응답저장,새로고침후복원,오늘/어제조회,단일삭제,전체삭제확인. 모바일/PC캡처열어확인.
- /private/tmp/joobi-history-mobile.png,joobi-history-desktop.png,joobi-history-{verify,build,lint}.log.
- 유료AI호출0/운영DB쓰기0/실제계정데이터사용0. 로컬서버종료.

## 결정사항
- 새서비스나로컬평문보관을추가하지않고기존Supabase사용. 기록읽기/삭제/재저장에AI이용횟수없음.
- 화면비우기는현재대화초안만초기화;계정기록삭제는이전대화에서명시확인. 삭제실패시기록유지.
- 이미사라진과거메모리대화복구불가. 기능적용후완료된대화부터저장.
- 사전아이콘글자제거/홍보자료/관리자모바일검수의기존미커밋변경보존. 커밋·push·운영배포없음.

## 미해결 TODO
- [ ] 운영반영지시후DB마이그레이션을앱보다먼저적용하고운영계정으로새로고침·로그인재접속·삭제검수.
- [ ] 삭제UUID묘비는계정탈퇴시제거. 장기저장량은실사용에따라관찰.

## 다음 세션 진입점
- supabase/migrations/20261118000100_joobi_conversation_history.sql
- src/lib/conversationHistory{,Cloud,Store}.ts 및 src/components/learning/ConversationHistory.tsx
- JoobiConversationProvider.tsx,AskJoobi.tsx,src/config/legalVersions.ts.

## 운영반영 진행
- 사용자 완료후운영반영 승인. 원격mainc9ff6b4,로컬e61d4b8(문서1개앞섬) 확인.
- 운영DB에 migration20261118000100 단독적용 및 이력applied등록. RLS켜짐,anon SELECT/함수실행불가,authenticated 직접UPDATE불가/저장RPC실행가능 확인.
- 기존테이블데이터변경없음. 앱배포진행.
