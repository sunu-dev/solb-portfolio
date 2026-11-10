# 2026-09-10 - 시세 성공 오판 경고 수정

## 작업 요약
- 게스트/빈 보유 화면에서 시세 정상 수신에도 전량 실패 경고가 지속됨.
- 지수는 store의 value 형태로 저장하지만 판정은 c만 읽던 결함. 반대로 과거 c 캐시는 새 실패를 숨김.
- useStockData가 이번 응답의 유효 가격 종목 집합으로 전체 성공/일부 실패/전체 실패를 판정하도록 변경.
- 전체 성공에서만 마지막 갱신 시각 변경. 성공 응답은 기존 경고 해제.
- 회귀 테스트 4개 추가. 로컬 verify 884 passed, 1 skipped.
- 운영 배포 dpl_EuuZFBZRic3mQJeWEUoCxkkMbCPd READY, solb-portfolio.vercel.app alias 완료.
- 로컬 및 운영에서 격리 Chrome 모바일 크기로 실제 지수 응답 시 경고 미노출 확인. 실패 응답을 테스트 브라우저에만 주입하면 경고 노출 확인.
- 운영 error 로그 조회 No logs found. 테스트 스크립트 /tmp/solb-quote-warning.mjs.

## 결정사항
- 배너를 숨기는 우회 대신 실제 요청 결과로 판정. 환율만 성공한 것을 주식 시세 성공으로 간주하지 않음.
- 개인화 Hero 인사 변경은 제안 단계이며 이번 수정에 포함하지 않음.

## 미해결 TODO
- [ ] 전체 가입·초대·첫 저장·재접속 운영 감사는 기존 TODO 유지.
- [ ] 개인화 Hero 인사는 별도 승인/구현 필요.

## 다음 세션 진입점
- src/hooks/useStockData.ts fetchAllQuotes, src/__tests__/quoteReception.test.ts.
- 이번 작업은 기존 데이터 판정 버그 수정이며 별도 영구 메모리 승급 없음.
