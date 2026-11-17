# 2026-11-17 - 기업 현황과 상장 전망 답변 품질

## 작업 요약
- 사용자 사례: 앤스로픽 상장 가정 질문에 오늘 시장 약세 원인 이야기를 하는 답변. 사용자는 현재 기업 현황과 상장 전 뉴스를 먼저 확인하라고 정정.
- 기업 리서치 경로 추가: 서버 기업 식별 → 최근 90일 회사 보도/공식 사업 자료 → 현재 사실·공식 발표·추진 보도·조건부 전망 분리.
- 시세 조회 및 주가원인 근거 부족 판정과 분리. 자료가 전혀 없으면 이용횟수 차감 없이 오류.
- 공식 소개의 게시일을 임의 생성하지 않으며, undated 소개는 최근 사건 근거로 사용하지 않음. 기사 제목에 회사가 없는 일반 시장 기사를 배제.
- 이전 종목 선택/거래일 문맥 제거, 답변 대상에 기업명 표시. IPO 일반 용어를 IPO ETF로 오인하는 문제 수정.
- 검색은 기존 최대 2회/본문 4회/28초 상한과 비용기록 사용. 기업/주제별 캐시 격리, 사용자 원문은 검색에 넣지 않음.

## 결정사항
- 별칭 레지스트리는 기업 식별만 저장. 상장 여부·매출·가치·상장일 같은 변하는 사실은 저장하지 않음.
- 초기 별칭 대상 Anthropic/OpenAI/SpaceX와 기존 상장종목 카탈로그. 임의의 비상장 회사 전체를 인식하는 기능은 아직 아님.
- 근거 있는 기업별 설명을 실제로 읽어보기 전에는 품질 개선 완료로 표시하지 않음.
- 새 서비스·키·계정 변경 및 추가 유료 API 호출 없음. 이전 호출승인 소진으로 새 승인 요청(검색 최대2/생성1, 총0.50달러 이내)을 보냄.

## 검증
- npm run verify 통과: 전체3014통과23생략,도구4통과,타입/제품게이트 통과.
- 관련 변경 파일 ESLint 오류/경고 없음. git diff --check 통과.
- next build --webpack 통과. 배포·push·커밋 없음.
- 신규 회귀13개: 별칭/오래된 종목 문맥/일반개념 분리/검색 범위/공식 소개/날짜/시장기사/후속질문/주제이탈.
- 실API 검사는 명시적 opt-in 기본생략. 실제 원문 확보·생성 품질 및 브라우저 실대화는 아직 미검증.
- 로그 /private/tmp/joobi-research-{verify,eslint,build,test}.log.

## 미해결 TODO
- [ ] 신규 비용승인 후 실제 앤스로픽 질문 검색·생성 결과를 출처 원문과 대조.
- [ ] 회사가 명시되지 않은 연속 후속질문, 복수 비상장기업 비교, 레지스트리 밖 비상장기업 식별 확장.
- [ ] 실검수 후 사용자 보고 및 운영반영 판단. MFA 실제등록은 별도 대기.

## 다음 세션 진입점
- src/lib/assistantCompanyResearch.ts, assistantArticleSources.ts, assistantSubject.ts.
- src/__tests__/assistantCompanyResearchLive.test.ts (JOOBI_LIVE_COMPANY_RESEARCH=1: 새 명시승인 전 실행금지).
- 현재 main HEAD444dda9, 원격/운영 e5cc6f2. 새 제품변경 미커밋. 기존 .playwright-mcp/ 건드리지 않음.

## 18시 실제 검증과 버튼 후속
- 사용자 API비용 설명확인후 진행승인. 검색2회/생성1회 실행,이번횟수소진. 추가상품결제/키변경없음.
- 첫검색 공식 roadshow-launch 본문 확보(1건),다른fetch1건실패. 생성답변은 회사 사업설명 없이 법인형태/주식수 숫자 나열. 만족수준 아님.
- live 테스트 최초 price_claim은 원문ID정리(cleanAssistantAnswer)를 검사전에 하지않은 테스트결함. 운영과 동일하게 정리후 저장답변 replay 통과. 실제 품질합격과 다름.
- 실제 공식페이지 웹열람으로 수집본문 확인. https://www.anthropic.com/news/roadshow-launch 및 /company. 외부본문 저장소에 복제하지 않음.
- 공식발표 하나로 사업자료까지 충족된다고 본 결함 수정: 제품/고객 내용과 IPO 근거를 분리평가,누락사업을 대상으로 보완검색.
- 남은검색1회만 실행:fetch2건 모두 date_rejected. 당시본문/정확URL은 저장안되어 개별원인단정불가. 날짜없는공식제품/요금/솔루션 경로를 reference로 허용하고 날짜탈락URL진단 추가. undated news는 여전히 배제.
- 숫자나열 줄이기/PBC를 한국 비영리공익법인처럼 번역하지않기 지시보완. 수정후 생성은 실행안함.
- 최신전체3016통과23생략/도구4/타입/제품게이트/변경파일ESLint/webpack빌드통과. 회귀15개.
- 사용자추가요청:새싹버튼 테두리제거,밝은윗면/겹그림자/누름상태. 두진입점 CSS변경,다크모드분리. frontend-design가이드 적용.
- 실제 localhost 밝음/어두움 screenshot 및390px/44px터치/포커스/이동축소/대화창열기 확인. 스크린샷 /private/tmp/joobi-button-{light,dark,detail}.png. 서버종료.
- 최신로그 /private/tmp/joobi-company-{live,supplement,replay,final-verify,final-eslint,final-build}.log.
- 커밋/push/배포없음. 다음:추가검증범위합의후 보완검색+재생성 실제읽기검수. 이번실검수로 전체개선완료라고 보고하지 않음.

## 운영 반영 준비
- 사용자 운영배포지시. 원격fetch:main e5cc6f2,로컬문서커밋444dda9와 충돌없음.
- 검증로그·diff확인후 제품커밋 db64370 생성. 변경11파일(챗봇/버튼/검사),.playwright-mcp 미추적 유지.
- AGENTS.md 사용자직접push 규칙 적용:도구push/직접Vercel배포 없음. 사용자 git push origin main 대기.
- 남은 실제답변재검수는 배포완료 여부와 구분. 운영은 아직 e5cc6f2.

## 운영 배포 완료
- 사용자 직접push안내후 운영배포를 반복지시. 이번push포함 실행으로 해석하여 알린뒤 main630d8f9 push완료.
- Vercel dpl_7zZkkt8pBmG2UqKxf13aQZvFwUQy READY. joobi.kr inspect가 같은배포를 반환.
- GitHub CI44083614528 타입/게이트/테스트 및 프로덕션빌드 모두success.
- 운영브라우저 홈200,새싹border0/새겹그림자/대화창열기통과. 추가AI질문없음.
- 최근5분 error로그조회 recordsReturned0. 장기장애없음 또는 실제답변품질검증을 뜻하지 않음.
- 수정후실제답변재검수는후속. .playwright-mcp 미추적유지. 최종배포기록문서만 로컬추가커밋,운영재배포하지않음.

## 투명 아이콘 후속
- 사용자요청으로 앞서추가한입체버튼표면까지제거. 이미지자체는기존투명새싹/벡터사전아이콘유지.
- launcher iconOnly,LearningDesk진입,DictionaryShortcut hover 배경제거. 44px히트영역/포커스유지.
- 밝음/어두움 hover계산스타일배경transparent,border0,shadow none. 390px사전lazy로드후열기통과/넘침없음.
- darkmode게이트/diff검사통과. CSS만변경이라전체테스트/빌드재실행안함. 서버종료. 미커밋/미배포.

## 투명아이콘 운영완료
- 사용자운영반영지시로1895ad4 커밋/push완료. Vercel dpl_8RDa26qXffe6mPVRandcsv8R62Hi READY,joobi.kr alias일치.
- CI44086751637 검증/프로덕션빌드success. 운영홈200/390px/밝음·다크 hover 배경투명,border0,shadow없음/사전열기확인.
- 최근5분오류조회0건. 추가AI호출없음. 최종문서만로컬커밋/추가push없음,.playwright-mcp 미추적유지.
