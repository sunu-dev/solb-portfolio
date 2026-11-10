# 2026-11-04 - 대화형 비서 24개 공식 사례 조사

## 작업 요약
- 사용자가 유명 챗봇 최소20곳 조사 및 좋은 점 참조를 요청. ChatGPT, Claude, Gemini, Perplexity, Copilot, Notebook, Notion, Slack, Canva, Sidekick, Fin, Zendesk, Amazon, Booking, Duolingo, Khanmigo, Snapchat, Spotify, Erica, Eno, Cleo, Public, Robinhood, 카나나 등24개 공식 자료 조사.
- 자료 원장 `artifacts/chatbot-benchmark-20261104/services.json`: 서비스별 확인한 방식·주비 적용 제안·한계·출처·자료 시점 분리.
- 분야별 필터가 있는 자립형 비교 보고서 `artifacts/chatbot-benchmark-20261104/report.html`. 24개 고유 항목 및 HTTPS 출처 확인. 브라우저 조작 시험을 했다고 표시하지 않았다.
- 구 Rufus의 Alexa for Shopping 통합, 구 NotebookLM의 Gemini Notebook 명칭, 카나나 베타와 Space 발표 상태 구분. 과거 베타 자료는 UX 사례로 표시한다.

## 결정사항
- 조사 결과는 구현 권고이며 이번에 제품 코드/운영을 변경하지 않았다.
- 우선순위: 현재 종목 맥락으로 진입(Public/Sidekick/Amazon), 핵심 문장별 출처(Perplexity/Fin), 쉬운 재설명과 저장(Notebook/Khanmigo), 이벤트를 챙기는 비서(Erica/Eno), 작은 캐릭터의 일관성(Duolingo).
- 현행 시안의 출처 전체 접기·획일적 예시·닫을 때 대화 삭제는 재검토 대상. 저장 정책은 사용자 제어와 고지를 함께 설계하기 전 바꾸지 않는다.
- 캐릭터·AI 호출 수·체류 시간만으로 개선을 판정하지 않는다. 이해도·원문 일치·응답 시간·반복 질문·재방문 시 찾기 경험을 함께 평가한다.
- 영속 정책 확정은 없으므로 메모리 승급하지 않는다. 원장과 보고서를 유지한다.

## 미해결 TODO
- [ ] 조사에 근거한 다음 시안: 데스크톱 종목 옆 패널/모바일 대화 화면, 핵심 출처, 대상별 질문, 쉽게 다시 설명, 저장/삭제 선택.
- [ ] 최신 운영의 뉴스 기업 구분 오류와 문장 난도 수정은 별도 최우선 과제로 유지.
- [ ] 실제 Chrome 연결 복구 후 코드 초안 클릭/반응형/로딩/오류 검수. 공식 문서 조사는 사용자 실측이 아니다.

## 다음 세션 진입점
- `artifacts/chatbot-benchmark-20261104/report.html`과 `services.json`.
- 채팅 코드 초안: `artifacts/joobi-chat-20261104/ui.patch`. 운영 HUE 그대로. 루트 전체 배포 금지.
