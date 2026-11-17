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

## 운영 반영
- 후속 사용자 운영지시에 따라53573d6 커밋/main통합/push. dpl_2YusF7oSJ4Bnei5eP1HeGtmhms7K READY.
- 원격2964통과21생략,홈/시장/경제일정200,alias일치,초기error조회0건. 실유료대화는 미실행.
- 복구02be1b3. 결과기록만 미커밋으로 유지(문서만 재배포하지 않음).

## 운영 사용자 검수 실패
- 시선에이아이 표기 미인식→한국시장, 시선AI는 식별되나 원인 없음.
- 새배포 alias READY재확인. 최근15분 운영진단에 회사검색2회 status400, 시장combined/shared도400. evidence unavailable/primary0/background0.
- 이는 기사부재 증거가 아니라 검색API실패.정확한400원인은 응답본문/요청계약 추가확인 필요. 실API검수 없이 배포한 한계가 사용자답변에서 드러남.

## 후속 방어 수정
- fix/news-provider-20261117. 시선에이아이 별칭추가, 시선 에이아이 내부 LIDR 에이아이 짧은이름 중복을 명시적 긴이름 범위로 제거.
- API400/401/403/404를 자료없음으로 삼키지 않고503/생성중단/미차감.관련134검사통과3생략.
- 정확한400본문 진단 및 실제검색검증은 유료호출승인대기(최대4회/추정1달러이내),미실행. 후속배포없음.

## 사용자 API 승인 후 실제 진단
- 사용자 최대4회/추정1달러이내 승인. 실제3회(오류진단1,회사검색1,답변생성1),추가호출없음.
-400본문은 mk.co.kr crawler inaccessible. 내가 추가한 도메인이 요청전체 거절을 유발했음.허용목록에서제거.
- 실제뉴스핌 https://www.newspim.com/news/view/20261116000368 확보6.264초,검색1본문1.생성5.136초.
- 생성본문은 AI안경부정행위 우려→시선AI보안기술 관심 연결,인과확정은유보.반복설명/확인과제 표현은후속개선여지.
- 실검사초기실패는 테스트가 운영정규화(mentor=true/assistant=true)를 누락한 문제. 캡처응답을API없이실제파서로replay해형식/근거ID/맥락검사통과.
- 전체2971통과18생략,리플레이1통과,빌드/린트통과. /private/tmp/joobi-provider-live-{1,2}.log,replay.log,final-tests.log,build.log.
- 후속commit/push/운영반영 없음. 현재운영은53573d6이며정정배포필요.

## 13:27 운영 답변 재실패 조사
- 사용자 질문 어제 시선ai 상승/오늘 하락에 원인없음 답변. 최신6355927 READY 확인.
- 가장 최근 요청 로그 회사검색2회, 각각본문1/채택0/entity_rejected1. 근거평가 unavailable.
- 로그에 원문URL/제목없어 정확한 오탈락 여부는 미확정. API400 아닌 본문 대상회사 분류 탈락 단계 확인.
- 제품코드/유료API/운영수정 없음. 다음은 공개기사 진단정보와 본문/별칭 재현, 복합기간 처리 점검.
