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

## 알고리즘 후속 감사
- 사용자 요청: 앱 코드 알고리즘 확인. 앱 동작 변경 없이 수집→판정→답변 흐름 추가 검토.
- collectAssistantEvidence: 미국 회사도 한국어 Google News 결과가 한 건 있으면 영어 RSS 검색 생략. 회사 제목 최대5, 검색 seed는 시장/업종/회사 대표를 포함해 최대3. 공식 회사 발표는 저장된 projection만 재사용, 질문 시 직접 IR 수집 안 함.
- needsArticleSupplement: 개별 종목도 시장/업종 기사만 있으면 false. 회사 기사 존재를 요구하지 않아 회사 검색 실패+시장 기사 성공을 완전한 수집으로 취급하고 5분 캐시 가능. 반대로 회사 기사만 있으면 불완전 판정. 이를 진단 fixture로 재현.
- articlePassages: 사임/임시 CEO 선임 문단 제거, 가격 문단만 남는 합성 fixture 재현. 실제 운영에서 동일하게 탈락했음을 뜻하지 않음.
- 같은 날짜/본문 fixture를 NVIDIA IR URL과 Yahoo URL로 비교: 공식 URL0건/Yahoo1건. 출처 차단 재현.
- route withoutReporting은 회사 원인 근거 여부가 아니라 article/publication 하나라도 있는지만 판정. 시장 기사만 있어도 엄격한 기사0건 원인 검사가 꺼짐. 프롬프트에는 직접 원인 없으면 밝히라는 지시는 있으나 결정론적 충분성 검사는 없음.
- 기존 관련31개 + 임시 진단3개 =34통과(4파일, 0.628초). 진단3개는 현재 결함 동작을 확인한 것으로 수정 성공 테스트가 아님. 임시 테스트는 src에서 제거해 artifacts/nvda-algorithm-audit-20261113/assistantAlgorithmAudit.test.ts 보관.
- 앱 수정 없음, 전체/빌드/실제 모델/운영 질문 미실행. 기록만 로컬 커밋, push/배포 없음.
