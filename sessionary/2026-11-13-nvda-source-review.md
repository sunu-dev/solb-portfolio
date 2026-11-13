# 2026-11-13 - NVDA 원인 보도 누락 코드 조사

## 작업 요약
- 사용자 스크린샷은 11/12 NVDA -4.34%, 기사/발표 자료 미확보 응답. 외부 조사에서 CEO 사임 공식 발표와 SEC 공시, 당일 Reuters 보도를 찾음.
- git clean/HEAD00e7c2d 확인. 수집·인물 규칙·route 파일은 운영 e921efa와 diff 없음.
- assistantArticleSources.ts: NVIDIA 공식 사이트/AP/Reuters/MarketScreener는 DOMAINS 미포함. SEC 허용. 회사 검색1·본문열람1, 공유시장 검색1·열람2, 각각28초. 회사 검색 지시는 business/earnings/products/production 중심.
- articlePassages는 경제·시장 키워드 점수0 단락 제거. CEO/resignation/board/investigation 자체는 가점 없음. 따라서 경영진 사실 단락만은 탈락 가능하나 실제 요청 탈락 원인이라고 확정할 수 없음.
- 날짜/최소200자/회사·시장 분류 필터, 회사 lane에서 company 이외 scope 제거. 일반 오류는 no_usable_article로 합쳐지고 상세 수집 로그는 JOOBI_SOURCE_DIAGNOSTIC=1일 때만 출력.
- route는 article/publication0이면 제목 제거 후 가격과 원인미확인 답으로 전환.
- ASSISTANT_PERSON_RULE는 사생활·미확인 개인 의혹 제외, 이사회 조사·경영진 교체 등 회사 사실 설명은 허용. 이 규칙만으로 전부 누락 설명 불가.

## 결정사항
- 코드상 구조적 제약과 해당 요청의 실제 실패 원인을 구분. 원시 검색/열람 로그는 확보하지 못함.
- 앱 수정·비용 발생 모델 호출·운영 질문·push·배포 없음. 문서만 변경, 실행 테스트 없음(코드 변경 없음).

## 미해결 TODO
- [ ] 출처 확장, 경영진 사건 보존, 대체 열람, 단계별 실패 사유 진단 설계/검증.

## 다음 세션 진입점
- src/lib/assistantArticleSources.ts, src/lib/assistantIntent.ts, src/app/api/ai-analysis/route.ts.
