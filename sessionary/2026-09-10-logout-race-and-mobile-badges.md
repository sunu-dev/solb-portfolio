# 2026-09-10 - 로그아웃 조회 경합과 모바일 배지

## 작업 요약
- 사용자: 명시적 로그아웃 후에도 종목이 보임. 모바일 Hero 배지 글자가 여러 줄로 내려감.
- usePortfolioSync의 정리 이벤트가 activeUserIdRef를 무효화하지 않는 경로 발견.
- 실제 hook effect를 실행하는 모의 테스트에서 정리 후 지연 조회가 setStocksFromDB를 호출하는 실패 재현.
- 정리 이벤트에서 activeUserIdRef=null 처리. useAuth 명시적 로그아웃은 원격 응답 전부터 정리/리셋.
- Dashboard 배지 nowrap/shrink 방지 + 배지 단위 wrap + 통화 버튼 공간 확보.
- 로컬 verify 870 passed, 1 skipped. 운영 배포 결과는 아래에 추가.
- 운영 배포 dpl_2x8dN5oLva7FiBVQUvDtdgpjXtJL READY, solb-portfolio.vercel.app alias 완료.
- 원격 빌드 868 passed, 3 skipped (SQL 소스 검사 등), 타입 검사/빌드 성공.

## 결정사항
- 서버 포트폴리오는 삭제하지 않음. 현재 확인된 클라이언트 응답 경합을 차단.
- 초기 비로그인 상태의 출처 불명 로컬 데이터를 무조건 지우는 변경은 하지 않음.
- 배지 문구는 유지하고 줄바꿈 단위를 바꿈. 모바일 실기기 검증과 코드 테스트를 구분.

## 미해결 TODO
- [ ] iPhone에서 새 코드 로드 후 로그인/동기화 완료/명시적 로그아웃/새로고침 E2E.
- [ ] iPhone에서 상태·출석·투자유형 배지가 모두 있는 Hero 확인.
- [ ] 초대코드 후 첫 종목 저장 및 재접속 복원 E2E 완료 여부 확인.
- [ ] 운영 공개 전 API/DB 초대 우회 차단 및 기존 LAUNCH_AUDIT 미완료 항목 확인.

## 다음 세션 진입점
- docs/LAUNCH_AUDIT_2026-09-08.md와 이 기록 참고. 자동 테스트만으로 출시 GO 선언 금지.
- 가비아 또는 호스팅케이알에서 joobi.kr 등록 후 도메인 연결 예정. 결제 완료 확인 없음.
- 영속 규칙 승급 후보: 비동기 응답 무효화는 React 재렌더 전에 동기식 정리 경계에서 수행.
