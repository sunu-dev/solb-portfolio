# 2026-11-09 - 질문 의도·사건 날짜·사용량 조회 후속과 브라우저 검수 인계

## 작업 요약
- 별도 후보/private/tmp/joobi-answer-context-20261109에서 중립질문에도 하락전제를 정정하던 프롬프트를 수정. 현재질문의 명시적방향만 사용, 가정/미래질문/직전질문과구분.
- 질문전제조작/모호한상대선거일 검사, 중간선거→대선변경을 기존1회재작성에연결. 동일원본자료·예산·35초시작상한·재검증·최종성공시1회차감 유지. 무조건검사통과완료아님.
- 실제로컬API에서 daily_usage_unavailable(조회3003ms)재현. 사용량쌍조회한번재시도/총4500ms상한,권한·스키마·잘못된횟수실패유지/쓰기재시도없음.
- 최종verify2422통과13생략/타입·제품린트. 이전전체검사기존카탈로그5초timeout개별재실행통과;새한도에맞춰deadline테스트수정후전체통과.
- 실제최종2요청200/result200,26.930/19.514초. QA비활성화·동의/사용량정리확인. 비용원장쓰기timeout이중간검수에서2회있었으므로비용전부영구기록확인했다고하지않음.
- DB현재건강정상/락0/유휴13/OOM카운터0. 약23시간구간시스템372IOPS/7.24MB/s vs데이터2.6IOPS/0.303MB/s. 원인확정불가,실제I/O예산/공급자내부로그필요. 새재시작/증설없음.
- 아이폰연결기록정정: 사용자는연결한기기없다고확인. 기기목록paired표시를실연결로해석하지말것. CUA브라우저host접속불가. 실기검수미진행.

## 결정사항
- 사용자가ClaudeCode로실제초보자흐름·상세궁금증·챗봇품질·전체기능단위브라우저검수를진행하도록프롬프트요청. 코드수정/배포와검수를분리하여충돌방지.
- 후보미배포/루트동기화아직없음. 운영은bi8lnwonb/F4pjjoV7Zt3zydY9gQFj2FQgSiUg그대로. root전체배포금지.
- localhost3056 Webpack개발서버를인계검수용으로유지(ownedexec26511). 심볼릭링크때문에Turbopack불가,운영설정변경없음.
- 새영구메모리규칙승급후보없음. 검수사실로기록.

## 미해결 TODO
- [ ] ClaudeCode브라우저초보사용자검수결과대조. 실제Kakao인증·iPhone은미검수.
- [ ] 최종변경8파일ESLint/원격빌드·후보응답확인후선별배포·root동기화. candidate-manifest.json참조.
- [ ] 최초답변19~27초및DB근본원인·비용기록타임아웃해결. 무조건재시작/임의증설금지.

## 다음 세션 진입점
artifacts/runtime-quality-20261109/candidate-manifest.json. 후보/private/tmp/joobi-answer-context-20261109. 최종실제응답artifacts/assistant-goal-20261107/candidate-context-final-20261109.json. /private/tmp/joobi-context-verified.log. DB읽기증거동일artifact폴더. 브라우저전담검수결과받고후속수정.

## Claude Code 브라우저 검수 실행
- 사용자 요청으로 Claude Code Chrome 통합을 실제 실행. 전용 탭 생성 후 joobi.kr 접속·스크린샷·MU 검색 동작 확인. 아직 검수 완료 아님.
- 세션 6600b886-94b0-4e16-88e4-a8ee700caecd, 실행 34110. 원본 로그 /private/tmp/joobi-claude-browser-audit-20261109/audit-stream.jsonl. 검수 지시 artifacts/runtime-quality-20261109/claude-browser-audit/audit-prompt.txt.
- 읽기/Chrome 도구만 허용, 코드·배포·DB 변경 금지. 실제 아이폰 미검수. localhost3056 HTTP200 확인.

## Claude 브라우저 검수 결과 수신
- 2회 실제 Chrome 검수 완료. 전체 기능 검수 완료는 아님. 운영 4종목·실제 질문2회·사전검색/예시/출처·SPY3단계·메뉴/설정읽기·좁은창 확인. 사용자 데이터 변경/추가 배포 없음.
- 운영 계정확인 실패→재연결실패→재진입회복 관찰. 원인 미확정. 챗봇 질문적합성/설명·문구 개선 필요.
- Claude 오판 보정: 주말 미국종가를 시세장애로 판정 금지, 다음개장22:30 제안 적용금지, 원문 일부만 본 뒤 주가주장 허위단정 금지, 실제폭406px/320·390 미검증, Supabase 미시도.
- artifacts/runtime-quality-20261109/claude-browser-audit/REVIEWED-RESULT.txt를 우선 읽기. round-1/2는 원본, 정정사항과 함께 읽기. 쓰기기능/퀴즈/실기/Kakao/후보로그인답변/지연정밀측정 잔여.
