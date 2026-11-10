# 2026-09-19 - 전체 종목 한글 검색

## 작업 요약
- SFA반도체 누락을 계기로 수동 종목별 추가에서 공식 종목 마스터 기반으로 변경.
- 한국투자증권 코스피·코스닥·NASDAQ·NYSE·AMEX 공개 파일 파싱, 실제 스냅샷 총 16,282개 확보(국내 3,925 / 미국 12,357).
- 한글명·영문명·코드·별칭·초성을 동일 색인에서 검색. 정확한 매칭 우선, 알파벳 A/C 동시 노출.
- 브라우저 목록 1회 로드 후 즉시 검색, 늦은 응답/정적 목록 덮어쓰기 차단. 미등록 영문만 원격 보완.
- 시장별 24시간 Data Cache 및 일일 인증 cron 추가. 원본 실패/급격한 목록 축소 시 기존 스냅샷 보존, source별 날짜·fallback 반환.
- 검색 로딩/연결 실패/결과 없음 분리. 긴 종목명 가로 넘침 수정.
- 로컬 실컴포넌트 임시 페이지(검증 후 제거)에서 SFA/알파벳/초성/하나마이크론/블룸/코드 검색 확인. Chromium 320/375/390/430px 가로 넘침 및 pageerror 없음.
- 로컬 verify 947 passed, 1 skipped. 변경 파일 ESLint·타입 검사 통과.
- 운영 배포 `dpl_3tZnU3nqr2PwhW93YMEyss3XsbHg` READY, joobi.kr alias 완료. 원격 944 passed/4 skipped 및 빌드 통과.
- 운영 `/api/search/catalog` 16,282개, 5개 source 모두 fallback=false(2026-09-19 갱신). `/api/search?q=알파벳` A/C 우선 반환, 국내 POST 초성 `ㅅㅅㅈㅈ` 삼성전자·상신전자·삼성전자우 정상 반환.

## 결정사항
- 목록은 공식 공개 데이터로 확보하고, 직접 번역한 가짜 한글명이나 추천 universe를 전체 검색 목록으로 사용하지 않는다.
- 기존 Cache Components 미사용 설정을 바꾸지 않고 Next Data Cache로 매일 갱신. 외부 장애가 검색 전체 장애로 이어지지 않도록 배포 스냅샷 제공.
- 검색 데이터와 추천/stock_listings 동기화는 별도. KRX 추천 universe 전체 수집은 이번 범위가 아니다.
- 구현·출처·운영 방법: docs/STOCK_SEARCH.md.

## 미해결 TODO
- 실제 iPhone Safari 검증은 아직 하지 않음(Chromium 모바일 크기 검증 완료).
- KONEX/OTC는 현재 범위 밖. 공급 자료에 한글명이 없는 미국 상품은 영문명으로 검색 가능.

## 다음 세션 진입점
- stockSearchIndex.ts, stockSearchClient.ts, stockCatalog.ts, stockMasterParser.ts.
- 목록 자체: /api/search/catalog의 sources 날짜/fallback 점검.
- 필요 시 npm run search:catalog로 배포용 스냅샷 갱신.
