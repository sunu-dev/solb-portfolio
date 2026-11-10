# 2026-11-10 - 실제 대화 QA 계정 준비와 Chrome 인계

## 작업 요약
- 사용자 '계정은 아무거나 하자' 승인에 따라 기존 전용 QA 영수증으로 계정 일치 확인. 비활성, 동의/포트폴리오/사전0, 오늘분석0 확인.
- QA만 활성화, 동의와 MU 관심종목 준비. 오늘0회여서 사용량삭제0, 비용원장/개인계정 변경0.
- Claude Chrome 별도 운영 origin(프로젝트 production alias) 접근 성공, 기존 joobi.kr 로그인은 건드리지 않음.
- QA 로그인용 loopback 1회 링크로 이동 시 자동검토가 Credential Exploration 사유로 거절. 같은 동작을 다른 도구로 우회하지 않음. CUA는 별도 연결상태 확인 도구가 unavailable이었으며 인증 이동 수행 없음.
- 사용자에게 링크를 Chrome에서 직접 열기 async요청. 아직 응답대기, 실제AI전송0, 대화품질/사전왕복 미검수.

## 결정사항
- 어떤 계정이든 승인받았지만 실제 사용자 전체 사용량을 초기화하지 않고 전용QA만 사용한다.
- 직접 로그인 인계가 필요하다. 비밀 토큰/계정정보/링크 nonce는 보고서와 세셔너리에 기록하지 않는다.
- 1회 링크 서버20분 제한, 미정리 QA는 watchdog 실행시점부터30분후 자동정리/비활성화하도록 예약. 다음 턴 진행 전 활성 여부·인계 여부 확인 필수.
- 새 영구메모 승급 후보 없음.

## 미해결 TODO
- [ ] 사용자 로그인 인계 후 Claude 실제3턴, 원문기사대조, 사전 저장/이해제외/복원/복귀 검수.
- [ ] 종료 시 QA데이터정리·비활성화 확인. 비용/사용량원장은 보존.

## 다음 세션 진입점
- artifacts/chat-qa-live-20261110/setup-status.json
- Claude session fe57c920-c9f0-4d54-a3fe-86dda41c43b5, 전용탭178417676. 운영 dpl_DUTtMdxZbhK4ur9ApiaN9RT7xz1y.
- 비공개 상태 /private/tmp/joobi-qa-live-state-20261110.json, 인증값 출력금지. 명령 node /private/tmp/joobi-browser-qa/live-qa-account.cjs inspect 또는 cleanup. activation state가 있으면 임의 재활성화하지 말고 먼저 정리 상태 확인.
- 원본 Claude 로그 /private/tmp/joobi-qa-live-review.jsonl 및 prompt. 공개 파일로 통째 복사금지.
- 로컬 entry server session48075, watchdog session32205. watchdog 결과 /private/tmp/joobi-qa-live-timeout-cleanup.log. 이미 정리된 상태면 watcher는 동작하지 않음.

## 사용자 진행 요청 후 추가 확인
- 이전 1회 entry는 전달됐으나 Chrome inventory에는 새 QA탭없음. 기존 QA탭 일반URL 재이동 후에도 채팅 하단 “로그인 후 질문할 수 있어요”로 게스트확인. 원인(다른브라우저/리다이렉트실패 등) 미확정, 실제AI전송0.
- 자동인증이동 재시도 없음. 사용자 직접 조작용 localhost 안내페이지와 명시적 POST “테스트 시작” 버튼 준비. GET/HEAD는 인증하지 않음. 자동검토 거절된 이동을 도구로 실행하지 않음.
- 이전 watchdog32205 종료, 이전 entry서버48075 종료확인. 새 manual server session38573이 30분후 페이지종료+QA정리를 수행. 직접 정리시 live-qa-account.cjs cleanup, state.cleanedAt 있으면 타이머중복정리안함.
- Claude 후속로그 /private/tmp/joobi-qa-live-after-handoff.jsonl. 의도치않은 Notion도구호출1회 거절(변경없음)은 도구오류이며 제품결함이 아님.

## 사용자 버튼 클릭 후 점검 및 안내페이지 수정
- Claude Chrome extension not connected 2회. 공식 /chrome 메뉴 Reconnect extension 실행 후 연결·QA탭조회/스크린샷 복구 확인. 기존사용자탭/인증이동조작 없음.
- QA탭은 여전히 게스트, AI전송0.
- 원인 조사에서 관리자가 만든 로컬 안내페이지 자체 오류 재현: Referrer-Policy:no-referrer로 POST Origin이 null, 엄격한 origin검사에서거절. form-action self도 외부리다이렉트대상 허용누락. 실제인증값없는3080→3081 모의폼으로 재현후same-origin정책·명시목적지허용으로 POSTOrigin정상/리다이렉트성공확인. 운영주비버그가아닌검수보조페이지버그.
- 구서버38573 중단, 수정서버52110 시작. 새30분타이머에QA정리포함. GET/HEAD인증안함, 사용자의POST에서만QA세션갱신후이동. 자동검토거절된브라우저인증이동을다른도구로우회하지않음.
- 사용자에게페이지새로고침후테스트시작1회재클릭 async요청대기. `artifacts/chat-qa-live-20261110/manual-handoff-fix.json`. 아직 실제대화검수미완료.


## 실제 검수 완료 범위와 발견 결함
- Claude Chrome 게스트 사전 저장/메모/이해표시/숨김/복습복원/퀴즈/삭제 실제클릭 통과. 채팅 MU선택/기간/초안/고지왕복/닫기·재열기/Escape 통과. 실제브라우저 AI전송0, 570폭만확인. 390/320요청반영안됨. 화면깨짐 미재현.
- 운영API 별도실제3턴 성공(Sonnet5.5):22.697/7.275/6.355초. Q3 자연어재설명에서 Q2추가매수맥락을 잃고Q1시장설명으로복귀. regex가버튼정확문구만인식하는원인확인.
- 후속요청공통분류/최근의도연결/직전답만재설명/재조회생략 수정. 새종목/명시적새질문은제외. 4파일선별후보 `/private/tmp/joobi-followup-20261110`, baseline dpl_DUTtMdxZbhK4ur9ApiaN9RT7xz1y.
- 실모델재검수1:투자금=손실금 혼동불합격. 2:전액손실부정오해문구불합격. 프롬프트보완후3:맥락과투자금/손실관계표본통과(3.443초). 자동구조검사는첫잘못된예시도통과하므로전체사실성검증으로간주금지.
- 전체2457통과13생략/타입/린트/webpack빌드통과,최종문구관련32재통과. 원격배포진행결과아래기록.
- 원발행사 MotleyFool 11/9 기사확인:시장반등/선거뒤건설우려/메모리주문가능성/필자의견 대조. Yahoo429와구분.
- QAcleanup 성공:비활성화/동의·포트폴리오·사전0/analysisRequests3,비용원장보존. localhost서버52110종료. 재개시state.cleanedAt확인필수.
- 새영구메모승급후보없음. 기존 초보자원칙·미검수구분규칙적용. 실제Chrome로그인대화/아이폰/깨짐재현/첫응답지연잔여.

## 운영 반영
- dpl_6dXQvQjjyr2vvyip7LEJFRicb7fa READY/joobi.kr alias. 배포직전기준 DUT 일치확인. 4파일manifest해시확인.
- 최종원격2454통과16생략/빌드통과, 홈200/미인증AI401. 기존주사용자로그인·데이터무변경.
- 로그인Chrome실제대화 미검수는유지. 최종모델표본이전체서비스품질완료를의미하지않음.
- 최신CLI 오류로그조회 성공:09:17:28~09:22:28 UTC5분0건/누락구간없음. npx는구버전58실행및샌드박스캐시권한실패→65.12.1고정경로승인후조회성공.
