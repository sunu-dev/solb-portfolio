# 2026-07-21 - JOOBI 영문 워드마크 50안

## 작업 요약

기존 `/brand-preview` 20안을 보존하고 현재 AI·핀테크·소비자 앱·패션·하드웨어 브랜드에서 관찰되는 시각 문법을 참고한 30안을 추가했다. 총 50개를 같은 비교 화면에서 번호로 검토할 수 있다.

## 결정사항

- 단순 폰트 변형이 아니라 카드 구조, 정렬, 기호, 여백, 패턴, 색, 제품 각인 방식까지 다르게 제안한다.
- 신규 21~50안은 Cursor, Perplexity, OpenAI, Anthropic, Notion, Figma, Canva, Coinbase, Robinhood, Wise, Monzo, Mercury, Brex, Plaid, Superhuman, Apple, Spotify, Discord, Slack, Nike, Aesop, Nothing, Teenage Engineering, Polestar, Shopify, Webflow, Airbnb, ElevenLabs, Luma, Arc의 현재 공식 사이트를 참고했다.
- 참고는 특정 로고 복제가 아니라 각 사이트의 브랜드 태도와 레이아웃 문법을 JOOBI에 맞게 재해석하는 용도다.
- 기존 자체 호스팅 폰트 20개를 재조합해 추가 네트워크·번들 비용 없이 방향 수를 늘렸다.
- 실제 서비스 워드마크는 아직 변경하지 않는다.

## 검증

- `label` 정의 50개 확인
- 전체 사전 린트, TypeScript, Next.js 16.2.1 프로덕션 빌드 통과
- 실행 중인 개발 서버 `http://localhost:3002/brand-preview`에서 50안 제목과 마지막 50번 콘셉트 응답 확인

## 미해결 TODO

- [ ] 50안 중 첫인상 기준으로 5개 이하 선택
- [ ] 선택안을 헤더·로그인·앱 아이콘 옆의 실제 크기로 비교
- [ ] 최종 선택 후 미사용 비교 자산 정리 및 선택 폰트 라이선스 보관

## 다음 세션 진입점

`http://localhost:3002/brand-preview`에서 먼저 번호만 보고 5개 이하를 고른다. 선택 이유는 예쁨보다 개인 주식비서에 어울리는 신뢰감, 친근함, 작은 화면 식별력 세 기준으로 기록한다.
