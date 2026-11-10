# 2026-09-10 - 국내장 배지와 코로나 비교 구간

## 작업 요약
- Hero의 미국장 전용 배지 옆에 KRX 정규장 배지 추가. useNow 공유 시계 사용, 한국시간 명시 계산, 09:00~15:30(종가 동시호가 포함), 주말·등록 휴장일 구분.
- 정규장 이외 NXT/시간외 거래를 포함하지 않음을 명시. 2026 범위 밖은 일정 확인 필요.
- 코로나 이름을 '코로나 초기 충격·반등'으로 변경. 02/20~06/08 기간 유지, 기준일 02/19 및 종료 기준을 설명.
- 기존 6/8 선정 이유는 코드에 기록 없음. S&P Global 자료상 6/8은 S&P 500의 2019년 말 수준 회복일이므로 비교 종료 기준을 이 기준으로 명시적으로 정리. 2월 고점 회복 또는 감염병 종료가 아님.
- 기존 설명의 '5개월 회복', '회복 115일', 이후 1년 수익 등 혼재된 요약 제거. 종목별 계산/기준가격은 변경하지 않음.
- 이벤트 상태를 '비교 구간 종료', 날짜를 '비교 기간'으로 명시. 코로나 상세에 출처 링크 추가.
- 한국 휴장 목록의 잘못된 1월 설 날짜→2/16~18, 누락 3/2·10/5 대체일·5/1·6/3·7/17 추가.
- verify 895 passed, 1 skipped. TSX ESLint 오류 0, 기존 Dashboard memo 경고 1.
- 격리 Chrome 모바일390×844 로컬: 국장 진행·미장 개장 배지 동시 표시, 가로 넘침 없음, 비교→코로나 설명/출처 확인, pageerror 0.

## 결정사항
- 단순 '코로나' 사건명과 비교용 주가 관찰 기간을 분리한다. 과거 결과를 코로나 전체 기간으로 해석하지 않도록 함.
- 배지 정규장 범위를 명시하고 기존 미장 계산은 유지. 특별 개장시간·미장 조기종료 등 연간 캘린더 확장은 별도 감사 필요.

## 근거
- KRX 정규장: https://regulation.krx.co.kr/contents/RGL/03/03010100/RGL03010100T1.jsp
- 코로나 6/8 비교 기준: https://www.spglobal.com/en/research-insights/market-insights/daily-update-june-19-2020
- 우주항공청 2026 월력요항: https://www.kasa.go.kr/prog/bbsArticle/BBSMSTR_000000000010/view.do?bbsId=BBSMSTR_000000000010&nttId=B000000001860Pe2zT3
- 제헌절 재지정: https://www.mpm.go.kr/mpm/comm/newsPress/newsPressRelease/?boardId=bbs_0000000000000029&category=&cntId=4205&mode=view&pageIdx=2

## 미해결 TODO
- 운영 배포 dpl_J6tT4VDcwBggn4WUiosvQbWm4YY1 READY, solb-portfolio.vercel.app alias 완료. 원격 893 passed, 3 skipped 및 타입/빌드 성공.
- 운영 모바일 크기 브라우저: 국장 진행·미장 개장 배지, 코로나 비교 기간/설명/출처, 선택 탭 전환 후 대비 모두 통과. 가로 넘침/pageerror 0. error 로그 조회 No logs found.
- [ ] 국내 특별 개장시간과 미장 휴장일·조기종료·다음 개장 카운트다운 전체 감사.

## 다음 세션 진입점
- src/utils/krMarketLabel.ts, Dashboard.tsx, constants.ts 코로나 preset, EventsSection.tsx.
- 기존 메모리 승급 질문은 아직 미응답. 영구 메모리 수정 없음.
