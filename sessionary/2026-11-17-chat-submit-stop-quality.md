# 2026-11-17 - 질문 전송·중단 및 답변 품질

## 작업 요약
- 첫 Enter가 전송을 막고 물어보기 재클릭을 요구하는 분기 확인. 사전 전송범위를 유지하고 form 제출에서 동의/전송을 함께 처리.
- 중단 버튼 클릭 preventDefault 및 별도 key로 전송 버튼 재사용 방지. 기존 초안복원/늦은 응답 무시 유지.
- handler 검사27통과, TypeScript/변경파일ESLint통과. 실제 DOM에서 사용자 중단증상 재현은 아직 미실행이며 해당 원인 확정 금지.
- 운영02be1b3 그대로. 작업 브랜치 fix/chat-submit-stop-20261117, 미커밋/push없음. 이전 배포결과 문서 변경 보존.

## 결정사항
- 사용자의 한 번 전송 요청에 따라 과거 최초 Enter 차단 규칙을 교체. 한국어 조합/Shift+Enter 방지 유지.
- 중단은 응답 기다리기 취소이며 서버 작업/횟수 환불 보장 아님. 기존 안내 유지.
- 시선AI 질문 답변은 원인 미확인+무관한 시장요약+사용자에게 조사 전가 문제가 있음.
- 11/16 10:01 뉴스핌 원문에 시험부정행위 우려와 시선AI 보안기술 관련 보도 확인.
- https://member.newspim.com/news/view/20261116000368
- 보도와 상승의 인과관계 확정은 별개. 당일 관련 보도가 실제 있으므로 검색/수집/필터/생성 중 누락지점 점검 필요.
- 실제 유료모델 재실행 및 운영 데이터 변경 없음. 검색/답변품질 개선 구현 완료로 주장하지 않음.

## 미해결 TODO
- [ ] 브라우저에서 첫 클릭/Enter 1회, 중단 직후 복원·재전송 없음 검수.
- [ ] 시선AI 근거 누락 단계 조사. 해당 기사 하드코딩 대신 일반 수집경로 검증.
- [ ] 종목 안내의 티커 노출 및 “질문에 적은” 표현 개선.

## 다음 세션 진입점
- HANDOFF.txt, src/components/learning/AskJoobi.tsx, src/__tests__/joobiChatFlow.test.tsx.
- src/lib/assistantArticleSources.ts, src/lib/assistantEvidenceSource.ts.

## 후속 코드 진단
- assistantArticleSources.ts DOMAINS에 newspim.com/mk.co.kr 없음. 검색·본문fetch 모두 allowed_domains 적용, fetchedArticleEvidence도 allowed URL만 채택. 앞서 확인한 뉴스핌 보도는 이 본문근거 경로에서 제외되는 구조가 확정됨.
- retrieve당 검색 max_uses1, 전체기한28초. 이는 제한 존재 확인이며 해당 요청 timeout/API실패 증거는 아님.
- assistantQuestion.ts224행은 직접원인 없으면 시장비교로 마무리하도록 지시.259행은 근거없는 확인과제 keyAdvice=[] 지시가 이미 존재. 프롬프트 추가만으로 자료 누락 해결 불가.
- 실제 요청 도구결과/최종근거 미확보이므로 모든 실패단계 및 API장애 여부 확정하지 않음.

## 엔진 설계 요청
- docs/JOOBI_NEWS_ANSWER_ENGINE.md v1 작성. 설계만, 제품코드 추가변경 없음.
- 시장 기사1건도 withoutReporting을 해제하는 코드 확인. 기사개수 대신 질문별 근거상태로 대체 설계.
- 기존총검색2/본문4 예산 안에서 회사우선 적응형배분, 출처정책/사건선별/템플릿/검증/평가/점진이행 설계.

## 엔진 구현 및 운영 전 보고
- 사용자 요청에 따라 구현/로컬검증 진행, 운영배포 전 정지.
- 구현범위와 보수적 한계는 docs/JOOBI_NEWS_ANSWER_ENGINE.md 끝에 기록. 근거상태/적응형검색/캐시/탈락집계/프롬프트/검증 연동.
- 전체2965통과18생략, 뒤에 추가한 API2회귀 포함 해당파일111통과3생략. lint/quality/tool4/webpack production build통과.
- 실제 브라우저에 실제 AskJoobi를 렌더링하고 인증·fetch만 로컬fixture: Enter1회 전송, 중단abort/초안복원/자동재전송없음, 다음초안보존 확인.
- 테스트 서버3016 종료. /private/tmp/joobi-chat-browser 및 joobi-engine-browser-results에 검수도구/로그. 운영인증 우회 없음.
- 실API 1사례 검색/답변검증은 자동승인검토가 명시적 유료호출 승인없음으로 거절. 비용/최대호출범위 설명후 async승인질문, 아직 답 없음. 우회/실행안함.
- 실제 기사누락 해결/최종답변 개선/성능·비용 효과는 실검증 전 확정하지 않음. 실제30+10평가/충돌의미분류 등 설계후속 남음.
- 코드/문서 미커밋, push/배포없음. 기존운영02be1b3.
