# 2026-07-18 - SKHY ADR 누락 및 종목유형 정책 통합

## 작업 요약

- 2026-07-10 나스닥에 상장된 SK하이닉스 ADS `SKHY`가 주비 검색과 신규상장 관리에 나타나지 않는 원인을 조사했다.
- Finnhub 실제 검색 응답에서 `SKHY`가 `type: ADR`로 정상 제공되는 것을 확인했다.
- 검색 API는 `Common Stock`·`ETP`, 신규상장 동기화는 `Common Stock`·`ETP`·`ETF`만 각각 허용해 `ADR`을 두 경로에서 모두 제거하고 있었다.
- 공통 정책 `securityTypePolicy.ts`를 만들고 검색과 신규상장 동기화가 같은 허용목록을 사용하도록 통합했다.
- `ADR`을 허용하고, 지원하지 않는 공급자 유형을 정규화·집계해 동기화 응답의 `diagnostics.excludedTypes`와 서버 로그에서 관측할 수 있게 했다.
- SKHY 회귀 사례와 허용·차단·정규화·미지원 유형 집계 테스트를 추가했다.
- 실제 Finnhub 응답 재검증에서 `SKHY / ADR / accepted=true`를 확인했다.
- 전체 테스트 132건, TypeScript, 변경 파일 ESLint, prebuild 4종, Next.js 프로덕션 빌드가 통과했다.

## 결정사항

- 개별 신규 티커를 예외 하드코딩하지 않고 공급자 종목유형 정책을 단일 모듈에서 관리한다.
- 현재 안전하게 지원하는 Finnhub 유형은 `Common Stock`, `ADR`, `ETP`, `ETF`다.
- `Preferred Stock`, `Warrant`, `GDR` 등은 가격·통화·자산 분류 검증 전 자동 허용하지 않는다. 대신 제외 유형 집계로 출현을 관측한다.
- `000660.KS`와 `SKHY`는 같은 기업의 다른 거래상품이므로 하나로 합치지 않는다. 한국 보통주는 KRW, ADS는 USD 상품으로 유지한다.
- 운영 DB와 배포는 이번 작업에서 변경하지 않는다.

## 미해결 TODO

- [ ] 파운더 승인 후 프리뷰에 배포하고 `/api/search?q=SKHY`가 `SK HYNIX INC-ADR`을 반환하는지 확인.
- [ ] 프리뷰 또는 운영의 다음 `sync-listings` 실행 후 `stock_listings`에 `SKHY`, `exchange=US`, `status=watch`가 등록됐는지 확인.
- [ ] 관리자 신규상장 화면에 `diagnostics.excludedTypes`를 표시할지 운영 로그를 본 뒤 결정.
- [ ] 동일 기업의 KRX 보통주와 미국 ADS를 함께 보유할 때 경제적 중복 노출을 설명하는 기능은 별도 설계.

## 다음 세션 진입점

1. 로컬 또는 프리뷰에서 `SKHY` 검색 결과와 USD 시세 로딩을 확인한다.
2. `sync-listings` 실행 결과에서 SKHY 신규 감지와 제외 유형 진단값을 확인한다.
3. 기존 무료 베타 게이트인 화면 육안 확인과 규칙 알림 중립화를 이어간다.
