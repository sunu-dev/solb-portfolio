# 종목 검색

## 데이터
- 한국투자증권 공식 공개 마스터: https://github.com/koreainvestment/open-trading-api/tree/main/stocks_info
- 코스피/코스닥: `kospi_code.mst.zip`, `kosdaq_code.mst.zip`. 6자리 코드(영숫자 포함), CP949 이름을 바이트 오프셋으로 해석.
- 미국 NAS/NYSE/AMEX: `nasmst.cod.zip`, `nysmst.cod.zip`, `amsmst.cod.zip`. 한글명·영문명 함께 저장. 주식과 USD ETP만 포함. 미국 클래스 점은 Yahoo의 하이픈으로 변환.
- 국내 보통주·우선주·외국주·리츠·ETF·ETN 포함. ELW/신주인수권/지수·타 통화는 제외. KONEX/OTC는 이번 검색 범위에 포함하지 않는다. 공식 자료의 한글명이 영문인 경우 임의 번역하지 않는다.

## 갱신과 장애
- `stockCatalog.ts`: 시장별 Next Data Cache 24시간 재검증. 기존 Cache Components 미사용 설정을 유지하므로 `unstable_cache` 사용.
- 매일 KST 07:30 `/api/cron/sync-search-catalog`로 캐시 워밍. CRON_SECRET 인증, 결과에 source별 실제 기준일·fallback 표시.
- 다운로드·파싱 실패 또는 기준 스냅샷 대비 20% 이상 급감하면 해당 소스만 fallback. 최신 목록 전체를 빈 값으로 대체하지 않는다.
- `npm run search:catalog`: 공식 자료를 새로 내려받아 `public/stock-catalog.json`을 갱신. 배포 초기/외부 장애용 실제 스냅샷이며 배포 당시 날짜를 보존한다.
- 초기 스냅샷 2026-09-19 KST: 국내 3,925, 미국 12,357, 총 16,282개. 상장 변동에 따라 달라진다.

## 검색 경로
- 브라우저는 정적 스냅샷과 `/api/search/catalog`를 병렬 로드. 최신 응답 이후 늦은 정적 응답은 무시.
- 색인은 한 번만 생성하고 메모리에서 검색. 한글/영문/별칭/코드/초성은 같은 정규화·순위 규칙 사용.
- 정확한 코드 → 정확한 이름·별칭 → 이름 접두 → 심볼 접두 → 부분 이름 → 초성. 화면 최대 20개.
- 목록에 없는 영문 검색만 200ms debounce로 서버 보완. 취소/요청 순서 검사로 오래된 응답 차단.
- 로딩/연결 실패/결과 없음 구분. 레버리지 위험 표시·등록 가드 유지.
- `/api/search`, `/api/kr-quote` POST도 같은 공식 목록과 검색 함수를 사용.
- 검색 목록과 추천 universe/`stock_listings` 동기화는 별도 시스템이다. 이 변경은 검색 전체 목록을 추천 후보로 일괄 등록하지 않는다.

## 검증
- `stockSearchIndex`, `stockMasterParser`, `stockSearchClient`, `stockCatalog`, `krStockSearch` 테스트.
- 실컴포넌트의 로컬 임시 페이지에서 격리 Chromium 모바일 320/375/390/430px 검증. 실제 iPhone Safari 검증과는 다르다.
