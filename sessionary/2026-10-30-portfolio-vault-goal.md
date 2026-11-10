# 2026-10-30 - 투자 기록 비공개 보관 목표 진행

## 작업 요약
- 사용자가 ‘진행하자. 이번 목표야’라고 지정해 goal을 만들었다. 운영자가 투자 본문을 읽지 못하는 요구를 유지하며 구현·검증·출시 조건 정리를 진행 중이다.
- 29일 밤부터 패스키 PRF, 암호문 RPC adapter/session, IndexedDB cache/outbox, 연결 controller를 구현했다. 실서비스 훅/화면에는 아직 연결하지 않았다.
- DB 전환안을 migrations가 아닌 proposals에 작성했다. 사용자별 rollout 기본 닫힘, RLS/명시적 owner 확인, CAS, 활성 평문 필드 원자 교체, 구버전 쓰기/삭제·재생성 차단, 읽기 유지형 쓰기 중단.
- 격리 PostgreSQL17에서 합성 역할/데이터로30개 통과. 컨테이너 포트·외부 네트워크·볼륨 없이 실행 후 제거. 최초 bootstrap 임시 서버 재시작 타이밍을 보정했다. 실제 Supabase나 사용자 자료를 조회하지 않았다.
- 실제 Chrome156/가상 인증기의 PRF 생성/get/리로드 복호화·취소·잘못된 소유자·키·미지원 거부 통과. 실제 iOS/Mac/Android 하드웨어와 새 기기 복원을 뜻하지 않는다.
- IDB/controller26개 검사로 암호문 영속 저장·동시 수정·quota 보존·손상 오류·응답 유실 복구·명시적 충돌 선택·잠금 검증. RPC/비밀 재료는 합성 fixture, native WebAuthn과 별도 검증이다.
- 운영 정본6개 파일을 선택 복사한 격리본에서 typegen/타입/제품lint/전체1,822tests/1skip/선택ESLint 통과. React ‘use’ callback 오인 lint와 WriteResult 분기타입을 수정. UUID fixture는 관리자 식별자 리터럴 금지 규칙을 훼손하지 않고 난수로 생성했다.
- root typecheck는 과거 artifact의 WatchStatus 오류가 있어 정본 격리로 검증했다. root 전체를 배포하지 않았다. env·배포 링크는 새 검증본에 복사하지 않았다.
- CUA 계정 보안 확인은 kernel asset 쓰기 오류로 실패. MFA는 미확인 상태 유지.

## 결정사항
- 수기 복구키 부담을 줄일 패스키 PRF를 먼저 검증한다. 카카오 토큰/계정 ID로 키를 만들거나 서버 마스터키로 우회하지 않는다. 실제 지원 범위·분실 복구 UX는 미확정이다.
- 복구 검증 후에만 기존 평문 활성 행을 전환하도록 initializer에 별도의 키 다시 열기 콜백을 요구한다. 이것이 새 물리 기기 복구를 증명하지는 않는다.
- 운영 알림/로컬 평문/기존 백업이 남아 있으므로 보호 약속과 전환 활성화는 보류한다. 현재 운영 JSON 저장 사실을 유지한다. 사용자 데이터 삭제나 기존 동기화 중단을 임의로 하지 않는다.
- `docs/PORTFOLIO_VAULT_ROLLOUT.md`에 다음 단계와 범위별 증거를 연결했다. 자체 검증을 독립 감사나 실기 통합으로 표시하지 않는다.

## 미해결 TODO
- [ ] 기존 usePortfolioSync/Zustand와 설정·잠금·편집/복구 화면 연결.
- [ ] 실제 패스키 기기 간 복원, 키 추가/회전/분실, 로컬 사본 전환·오류 재개.
- [ ] 서버 맞춤 알림·발송 lease/과거 외부 사본·백업 보존 전환.
- [ ] MFA/최소 권한/CSP·독립 검토·운영 실사용 검수. goal active, 완료 처리하지 않음.

## 다음 세션 진입점
- source6파일 해시는 `artifacts/portfolio-vault-rollout-20261029/stage-result.json`, 설명은 REPORT.md. 날짜는 작업 시작일29일을 유지한다.
- `/private/tmp/joobi-vault-rollout-20261029`는 무env/무Vercel 격리 검증본. 이전 운영 정본 DGLY와 구분. SQL `supabase/proposals/portfolio_vault_v1.sql`은 운영에 적용하지 않는다.
- goal objective를 이어서 수행한다. 앞선 전체 디자인·I/O 관측 TODO는 그대로 유지했다.

## 메모리 승급 검토
- 패스키 지원·기기 복구·보호 수준이 미확정이므로 완료된 영속 사실로 승급하지 않는다. 실제 적용이 끝난 뒤 보호 범위와 운영 규칙의 승급을 제안한다.

## 01:10 후속 — 로컬 내구 저장과 인증 인계
- 직전 턴은 Q&A·보호 경계 구현/검증으로 progress. 이번에도 실제 코드와 근거를 갱신했으며 goal active 유지.
- controller 로컬 큐를 서버 응답 대기와 분리했다. 서버 저장 중 최신 편집을 IDB에 보관, 이전 응답으로 새 outbox 삭제 금지 및 revision 재설정. 네트워크 대기가 로그아웃을 막지 않는다.
- runtime은 Zustand 변경 직후 미저장 표시, 암호화 내구 저장 완료 후 표시 갱신. 실패한 최신 변경은 메모리에 보존하고 로그아웃/계정 전환을 중단한다. 재시도 성공 뒤 키/스토어 종료. 서버 쓰기 중단도 이미 받은 변경 저장 후 닫음.
- 실제 Zustand adapter와 owner별 공유 handoff, useAuth의 비동기 인계를 연결. Supabase callback은 동기로 반환, 이전 계정 UI를 즉시 닫고 로컬 저장 뒤 최신 이벤트만 반영. 여러 auth 소비자의 중복 close는 합침.
- Chrome/Web Crypto/IDB 합성 RPC/store port41개 통과. 실제 Zustand adapter3개, auth harness 비동기 이벤트/실패 포함 전체1,851tests/1skip·타입/제품lint/선택 ESLint 오류0. 홈 runtime 생성 및 실제 OAuth 브라우저 flow는 검증 범위 밖이다.
- 선택27파일 stage hash·소스 묶음 갱신. 운영 DB/배포/외부 발송/실제 사용자 자료 변경 없음. 다음은 홈 서버 상태 경계·잠금 해제·기존 자료 이관 연결. reader flag를 켜지 않는다.
- 보호 기능 출시 사실로 메모리 승급하지 않음. MFA·실기 복원·알림/백업·독립 검토 미해결.

## 00:55 후속 — Q&A와 기존 저장 경계
- 사용자 ‘병행해서 Q&A도 만들어 놓는 게 나을까’에 따라 도움말 `/help#privacy` 현재 사실7개, 보관 안내 링크를 구현했다. 암호화 적용 후 답변은 `docs/PORTFOLIO_PRIVACY_QA.md`에 미공개 초안으로 분리했다. 보호 완료를 주장하지 않는다.
- 실제 Next help 화면을 무env/무배포 격리본에서 합성 auth 설정으로 확인. 320/390/1440px·질문7개의 Enter/Space 열기 닫기·가로 넘침 없음·pageerror0·앱 쓰기 요청0. 외부 폰트/Kakao 요청은 차단, 문의 발송 없음. 로컬 서버/Chrome 종료.
- Zustand 평문 자동 저장과 예전 outbox·계정전환 recovery 복제 경로에 정책 경계를 추가했다. 보호 표시를 본 브라우저에서는 owner를 비우거나 reader flag를 내려도 평문으로 돌아가지 않는다. 중립 화면 설정만 별도 저장하며 기존 자료는 그대로 보존한다.
- reader 설정은 기본 꺼짐. **아직 켜면 안 된다.** 보호 계정의 예전 logout/identity 코드에는 암호화 인계가 없으면 중단하는 안전장치만 있고 실제 controller 연결은 남았다. 새 기기 서버 상태 확인도 필요하다.
- 평문 persist를 끄면 로컬 전용 개인 일정·최근 종목·투자 유형·마지막 가져오기 복구 지점이 사라질 수 있음을 발견해 암호화 payload에 포함했다. 알 수 없는 필드는 조용히 버리지 않고 오류 처리. 개인 상태만 달라도 저장 응답 비교/충돌로 구분하며 누락된 개인 상태로 저장을 덮지 않는다.
- 전체 검사 최초 실패는 window-only fixture에서 새 저장소 실패 경고가 로그인 이벤트보다 먼저 발생한 것이었다. 실제 저장소 경고를 숨기지 않고 승인 함수 호출 직전 spy를 초기화해 경계를 분리했다. 기존 crypto/payload 검사7개는 그대로 보존하고 새 개인 상태10개는 별도 파일에 추가했다.
- 최종 선택19파일 격리 verify **1,839통과/1skip**, 타입·제품lint, 선택 ESLint 오류0/기존 help 전체이동 경고1. Chrome IDB/controller **28개** 통과, 외부 요청0. 기존 DB30/패스키 검증은 변경 없는 경계로 유지했다.
- 운영 DB/배포/사용자 자료/외부 알림 변경 없음. REPORT·stage manifest·소스 묶음을 갱신한다. goal active, 후속은 runtime 저장대기/로그아웃 인계 → 화면/이관 → 실제 기기/알림/백업 검증이다.
- 영속 완료 사실로 승급할 보호 약속은 아직 없다. 메모리 변경 없음.

## 10:08 후속 — 서버 저장 방식 진입 검사
- `portfolioVaultAccess` 추가. 새 기기의 서버 sealed 판정 후 보호 표시를 저장하고 잠금 상태로 진입한다. 서버 오류/미지원 RPC/잘못된 응답/로컬 저장 거부 시 unavailable로 닫는다.
- legacy/empty 응답도 평문 쓰기 허가로 취급하지 않고 migration-required로 분리했다. 기존 보호 계정의 하향 응답, 요청 중 다른 탭의 보호 표시 추가, 계정 전환/reset 이후 늦은 응답을 차단한다.
- 공개 상태에는 저장 본문·키 봉투·패스키 descriptor·원문 오류를 넣지 않는다. 홈과 잠금 UI에는 아직 연결하지 않았다.
- 선택29파일 격리 검증: 전체1,861통과/1skip, 타입·제품lint·선택ESLint 오류0(기존 help 경고1). 신규 진입 검사10개 포함. 운영 변경 없음.
- 다음: 기존 평문 사본 보존/이관 경계 뒤에 진입 검사와 잠금 UI 연결. reader flag 유지 off. 실제 새 물리 기기 복원과 Supabase 통합 검증은 별도 잔여.

## 12:55 후속 — 홈 보호 모드와 읽기 전용 잠금 화면
- 홈의 로그인/수화/기존 identity 준비보다 앞에 `PORTFOLIO_VAULT_READER_ENABLED` 보호 분기를 연결했다. flag는 운영에서 계속 off이며 기존 홈은 그대로다.
- `PortfolioVaultBoundary`는 새 기기의 저장 방식 확인 → 패스키 해제 → 읽기 전용 종목/수량 → 잠그기 흐름을 제공한다. 기존 HomeContent를 마운트하지 않아 legacy sync/quote cache/설정/알림 훅을 실행하지 않는다.
- `portfolioVaultEntry`는 기존 사용자 localStorage·outbox·복구본·candle/노트 및 메모리의 투자 상태가 있으면 이관 대기로 막는다. 기존 사본을 삭제/덮어쓰기/새 계정으로 인수하지 않는다. 이 검사 자체는 이관 구현을 대신하지 않는다.
- runtime readOnly 옵션은 자동 flush·편집 수집·충돌 선택을 막는다. 서버로 보내지 않은 암호문 outbox는 보존하며 별도 안내한다. 일반 쓰기 runtime 동작은 유지한다.
- 검증: 선택35파일 격리 타입/제품lint/전체1,870통과·1skip. 선택ESLint 오류0, 기존 help/page 경고4(이번 신규 컴포넌트 경고0).
- 실제 Next 컴포넌트·Chrome156 native WebAuthn 가상 인증기·IDB로18개 검사. 320/390/1440px, 키보드 unlock, 잘못된 응답→재시도, 잠금→재해제→리로드, 비공개 본문 localStorage 없음, 서버 읽기 RPC만 호출, 기존 복구본 보존. 320 열린 화면/390 잠금 화면 시각 확인. 기존 로컬 암호화41검사 재통과.
- UI 검증은 격리본의 임시 `/vault-check` route와 합성 계정/RPC 사용. 실제 Kakao→홈 인증 연결·실제 Supabase·물리 기기 간 복원 증거는 아니다. 임시 route 및 생성 dev types 제거. 첫 UI 시도는 합성 도메인이 기존 CSP에 차단되어 실패했고, CSP를 완화하지 않고 허용된 Supabase 도메인 형태의 요청을 Playwright에서 모두 가로채도록 수정했다.
- 운영 배포·DB 변경·기존 기록 삭제 없음. 다음은 이관 재개/복구 및 쓰기 제품 경로·알림/백업 전환, 실기 복원 검증. 전체 목표 미완료.

## 13:18 후속 — 중단 후 전환 재개와 개인 알림 중단 경계
- 사용자 요청: 중간 완료 보고 대신 최종 완료 시 보고. 작업은 계속했으며 최종 완료로 선언하지 않았다. 실제 패스키 복원 확인을 위한 iPhone/Mac 사용 가능 여부를 비동기 질문했다. 답변 미수신.
- `portfolioVaultMigration` 추가. 서버 행을 교체하기 전에 기기에 암호화 전환 의도를 저장·재독해 검증한다. 개인 payload뿐 아니라 CAS 기준 시각·prepared/confirmed 상태도 인증 암호문 안에 넣어 메타데이터 변조로 오래된 기록이 새 행을 덮지 않도록 했다.
- Web Locks로 같은 계정의 동시 준비를 직렬화. 기존 journal을 새 키로 덮지 않는다. 저장된 키 봉투를 패스키로 다시 열어 init하고, RPC 성공 응답만으로 완료 처리하지 않고 서버 ciphertext 재조회·복호화·내용 비교를 요구한다. 응답 유실/확인 상태 저장 quota 실패는 journal로 재개하며 init 중복을 막는다. confirmed 뒤 서버 행이 없어졌다고 재초기화하지 않는다.
- 전환 coordinator는 아직 제품 UI에 연결하지 않았다. local/cloud 소유자·충돌 조정, 이전 사본 정리, 서버 알림 정지/백업 확인을 대체하지 않는다. 기존 localStorage/outbox/recovery를 삭제하는 API도 넣지 않았다.
- 서버 전용 `PORTFOLIO_PRIVATE_NOTIFICATIONS_PAUSED` 설정 추가. 미설정/off는 기존 동작, on 및 그 외 설정값은 보수적으로 중단한다. morning/close digest·monthly-d3·check-alerts는 private DB read 전, digest queue는 enqueue/claim/발송 전 차단한다. 실제 운영 환경변수는 변경하지 않았다.
- 중단 스위치는 새 배포의 새 작업을 막는 수단이다. 이미 실행 중인 옛 배포·provider 전송·큐에 보관된 기존 본문·과거 외부 사본을 회수/삭제하거나 drain 완료를 증명하지 않는다. rollout을 켜기 전에 별도 검증이 필요하다.
- 실제 Home/useAuth 분기까지 합성 Supabase 세션으로 브라우저 검증 확대. 320/390/1440px에서 홈→잠금→native 가상 패스키 해제→목록→잠금, 내부 API/legacy sync 호출 없음. real Kakao 인증을 수행한 것은 아니다.
- 최종 이 턴 검증: 선택46파일, 전체1,893통과/1skip, 타입·제품lint·선택ESLint 오류0(기존 help/page 경고4). native Chrome 로컬/전환45개 + Next UI21개. source archive 갱신, 비밀파일/배포링크 없음. 운영 배포·DB migration·개인 메일/푸시 전송 없음.
- 다음: 실제 기기 복원 준비(기기 답변 대기), 기존 데이터 reconciler와 전환 UI·계정별 삭제/설정/편집·개인 알림 대안, DB/발송/백업 drain, MFA/최소 권한/독립 검토. 전체 목표 미완료. 자동 goal 도구 상태는 usageLimited이며 complete로 바꾸지 않았다.

## 후속 — 사용자 실제 기기 검증 준비
- 사용자가 같은 Apple 계정의 iPhone/Mac 사용 가능, 준비됐다고 확인했다. Apple 계정 주소/비밀번호/인증번호는 수집하지 않는다.
- `scripts/passkey-device-check/`에 개인 자료/로그인/API 없는 정적 호환성 시험 페이지, build/verify 스크립트 추가. 실제 crypto/passkey 모듈을 복사하되 시험 artifact에서만 RP를 자체 vercel.app hostname으로 제한하고 패스키 표시명을 ‘주비 보관 시험 (삭제 가능)’으로 구분했다. 제품 소스 RP는 joobi.kr/localhost 그대로다.
- Mac 생성 후 URL fragment의 합성 암호문/키 포장본/공개 descriptor를 iPhone으로 보내 복호화한다. 복호화 키·PRF 결과는 URL/저장소/서버에 기록하지 않는다. 페이지는 localStorage/sessionStorage를 사용하지 않고 connect-src none, referrer none, iframe 금지, no-store.
- CLI65.7 --temporary --prebuilt는 로그인된 환경에서 별도 프로젝트의 첫 production 배포를 만들었다. 기존 solb-portfolio/joobi.kr에는 배포하지 않았다. 자동 만료를 가정하지 않으며 실기 시험 후 이 시험 프로젝트를 정리할 것.
- 시험 프로젝트 `prj_RbshKKtRzfVqFDfbq8J0M5HQpCP2`, deployment `dpl_A8vyMWiAGd2gcbRbKe4bf3FkR5iq`, 별도 주소 https://joobi-passkey-device-check-20261030.vercel.app. 도메인 alias는 인증 없이200으로 시험 페이지를 제공한다. 전체 서비스의 보호 설정을 변경하지 않았다.
- 로컬 및 원격 실제Chrome/가상 WebAuthn: 생성→리로드→복호화 성공, 변조 거부, 유효하지 않은 링크 거부, 영속 저장0, 데이터 전송 요청0, 320/390/1440 가로넘침0. 실제 물리 기기 복원 결과는 아직 받지 않았다. 이 시험이 성공해도 joobi.kr 통합·기존 자료 이관·전환/백업/운영 통제는 별도 잔여다.

## 후속 — 취소하지 않았는데 cancelled 표시
- 사용자가 시험 중 cancelled를 보고했고 직접 취소하지 않았다고 설명했다. 실제 오류 기기/단계 및 인증 UI 표시 여부를 질문했으며 아직 답변 대기다. 원인은 확정하지 않았다.
- 원인 중 확인된 부분: safeFailure가 WebAuthn NotAllowedError와 AbortError를 모두 cancelled로 치환했고 시험 UI는 이를 명시적 사용자 취소로 표현했다. NotAllowedError를 not_allowed로 분리, AbortError도 요청 중단으로 안내. raw platform 오류/기기/키 자료는 출력하지 않는다.
- 오류에 create/get 작업 단계만 추가, 시험 화면은 단계·안전한 코드·경과 초만 표시. 비공개 계정/키/패스키ID/UA 수집 없음. RP·challenge·PRF·userVerification·암호화 정책을 약화시키거나 예외로 넘기지 않았다.
- 전체1,896통과/1skip, 타입/제품lint/ESLint 오류0(기존4경고). 실제 Chrome 시험 UI에 NotAllowedError 주입 시 사용자 취소로 단정하지 않음, 로컬/원격 기존 생성→리로드→복호화와 변조 거부 유지.
- 별도 시험 프로젝트에만 `dpl_GiHswrP1GJiT1qmHQ5bHxvUue5tn` 배포. 동일 alias `https://joobi-passkey-device-check-20261030.vercel.app` 유지하여 기존 패스키/시험 fragment 유효. joobi.kr 운영 배포 없음. 이것은 오류 안내·진단 개선이며 실제 iPhone 복원 장애 해결 완료가 아니다.
- 기기/단계 확인 후 iPhone 암호 앱의 시험 패스키 존재/브라우저 맥락 또는 Mac 생성 직후 연속 create/get 흐름을 구분해 진단할 것. 사용자에게 삭제/무작정 재생성을 요구하지 않는다.

## 후속 — Mac 생성 직후 실패, 별도 클릭과 기존 패스키 재사용
- 사용자가 실패 위치를 Mac에서 패스키를 만든 직후로 확인했다. iPhone 동기화 실패로 판단하지 않는다. 기존 코드는 create() 완료 직후 자동 get()을 요청했으며 연속 인증 흐름을 분리했다. 실제 Safari 거절 원인 자체가 완전히 입증된 것은 아니다.
- `registerPortfolioPasskey`는 등록만 수행. `createPortfolioVaultUsingPasskey`는 별도 버튼 클릭으로 PRF get 수행. 시험 페이지는 공개 descriptor/owner만 #setup fragment에 남겨 새로고침 후에도 등록을 반복하지 않고 이어갈 수 있다.
- 이미 등록됐으나 descriptor를 남기지 못한 이전 시험을 위해 `createPortfolioVaultWithSelectedPasskey`와 ‘이미 만든 패스키로 계속’ 버튼 추가. 같은 RP의 discoverable credential을 사용자가 직접 선택, UVrequired/PRF 필수 유지. 이 함수는 새 시험 보관함 준비용이며 기존 투자 기록 복구 키를 교체하거나 기존 vault를 재초기화하는 기능이 아니다.
- 실제Chrome 가상 인증기: 등록 단계 get0회, 새로고침 뒤 별도 버튼 get, 기존 패스키 선택 재사용 후 credential수1 유지, 앞선 시험 암호문 계속 복호화 가능, NotAllowed 오안내 방지, 변조 거부. 로컬/배포 주소 모두 통과. 전체1,897통과/1skip·타입/제품lint/선택ESLint 오류0(기존4경고).
- 격리 검증 중 닫는 괄호 누락을 타입 검사에서 발견해 수정, 시험 artifact 빌더에도 transpile diagnostics 검증을 추가했다. 검증 실패본은 배포하지 않았다.
- 시험 프로젝트에만 `dpl_C6wTRDA74UyaW7V61AcRjLFnB8kF` 배포, 동일 alias/RP 유지. joobi.kr 운영 변경 없음. 사용자에게 Mac Safari에서 기본 시험 페이지를 열고 ‘이미 만든 패스키로 계속’으로 재개 요청. 실제 Mac 준비 완료 및 iPhone 복원 결과는 대기 중이다.

## 후속 — Mac/iPhone 시험 복원 성공 사용자 보고
- Mac에서 기존 시험 패스키로 재개한 뒤 사용자가 ‘이 기기에서 복원 성공’을 보고했다. 이후 iPhone Safari로 링크를 보내 같은 버튼을 누르도록 안내했고, 사용자가 다시 복원 성공을 보고했다. 대화 순서에 따라 후자는 iPhone 성공으로 기록한다.
- 근거는 사용자 보고이며 자동 관찰/화면 캡처 증거가 아니다. 동일 Apple 계정 Mac/iPhone 사용은 앞서 사용자 확인. Apple 계정 식별 정보/비밀번호/인증번호는 수집하지 않았다.
- 시험 도메인 C6wT 배포의 합성 암호문을 두 기기에서 열었다는 결과다. 동기화된 로컬 패스키 사용인지 Mac을 통한 교차 기기 인증인지는 독립 확인하지 않았다. 원기기 분실/재설치/모든 복구수단 분실, joobi.kr 실제 카카오·계정·투자 흐름, 기존 자료 이관·알림·백업·독립 검토까지 완료된 것은 아니다.
- 근거 파일: artifacts/portfolio-vault-rollout-20261029/device-check-physical-user-report.json. 시험 페이지는 후속 확인을 위해 유지하며, 실기 시험 종료 시 별도 프로젝트 정리 예정. 운영 개인정보 보호 주장/배포는 변경하지 않는다.
- 다음: 기존 기록 전환 및 편집/설정 경로 완성, 원기기 의존 여부와 운영 도메인 검수, 개인 알림·백업 전환/운영 통제 검증. 전체 목표 미완료.

## 21:09 후속 — 전환 기록 누락·동시 편집 차단
- 암호화 payload가 옛 history normalizer의 20건 제한으로 과거 이력을 버리지 않도록 변경. 각 이력을 개별 검증하고, 알 수 없는 필드·잘못된 변경·값 보정 등 내용 손실이 있으면 거부한다. 25건 암호화/복호화 보존 검증.
- 전환 입력은 정규화 전후 전체 내용이 동일해야 한다. demo 제거·미지원 종목 분류 등도 전환 중 몰래 삭제하지 않고 명시적 사전 정리가 필요하다.
- 전환 journal의 암호화 intent에 원본 localStorage 항목 이름과 SHA-256 지문을 포함한다. 원본 값 자체는 추가 저장하지 않는다. 준비 중, 서버 읽기 뒤, 패스키 복구 확인 뒤, 서버 확인 뒤에 기기 원본 변화 여부를 검사한다. 변경·삭제·새 복구본 생성 시 원본과 journal을 남기고 중단한다.
- 지문 확인은 다른 구버전 탭을 잠그는 원자적 트랜잭션이 아니다. 마지막 확인 이후의 경합 가능성과 서버 전환 이후 기기 원본 정리는 여전히 별도 해결 대상이다. 지문은 원본의 소유권이나 reconciled payload 포함 여부도 증명하지 않는다.
- 미완료 전환 journal이 남아 있으면 fresh-device reader로 우회 진입하지 못하게 했다. 신규 intent schema는 아직 배포되지 않은 staged 형식이며 이전 실사용 journal은 없다.
- 선택 운영 정본 격리 검증: 타입/제품 lint/전체 1,908통과·1skip, 선택 ESLint 오류0·기존경고4. Chrome native 암호화/IDB/Web Locks 검증45개 통과. 운영 배포/DB/환경변수/원본 삭제 없음.
- 운영 계정 Supabase·Vercel·GitHub·이메일 MFA 여부를 비동기 질문했다. 답변 미수신이며 미확인 상태다. 이 확인만으로 나머지 제품 구현이 완료되는 것은 아니다.
- 잔여: 원본별 소유권·누락 없는 조정 UI, 편집/설정/삭제 실제 연결, 알림·과거 백업 전환, 실제 Supabase 및 joobi.kr 통합 검수, 운영 통제·독립 검토. 전체 목표 미완료, goal complete 처리하지 않음.

## 21:17 후속 — 소유자별 전환 원본 비교
- `portfolioVaultMigrationReview.ts` 추가. 명시된 cloud/local/outbox의 owner가 없거나 다른 계정이면 중단하며, 손실 없이 읽을 수 없는 형식도 거부한다. 내용이 다른 원본을 최신 시각으로 자동 선택하지 않는다.
- 서버/기기 기본 기록이 일치할 때에만 기기 전용 privateState를 보존한 결과를 반환한다. privateState가 어디에도 없으면 기본값으로 채우지 않고 중단한다. 서버 행이 사라졌는데 이전 행을 가리키는 outbox가 있으면 충돌로 남긴다. 출력은 원본과 참조를 공유하지 않는다.
- 이 비교기는 원본 수집/전환 UI에 아직 연결되지 않았다. ready는 모든 사본 수집·rollout 허용·원본 동시 변경 방지 증명이 아니다. 실제 source inventory와 coordinator의 연계가 필요하다.
- 전체 선택 정본 검증 1,916통과·1skip, 타입/제품lint/선택ESLint 오류0(기존4경고). 운영 변경 없음.
- CUA 연결 재확인도 kernel assets 쓰기 오류로 실패. 계정 MFA 상태는 계속 미확인, 기존 비동기 질문 답변 대기.
- 전체 목표는 미완료. 자동 goal의 usageLimited 상태도 해제되거나 complete로 변경되지 않았다.

## 21:26 후속 — 원본 수집·화면 연결과 운영 구조 실측
- 사용자는 제한한 적 없으며 계속 진행을 명시했다. goal 도구 usageLimited 상태를 사용자 설정이나 일반 작업 중단 근거로 해석하지 않는다. 실제 코드·검증·운영 읽기 작업을 계속했다.
- raw localStorage의 v3 primary/outbox를 직접 읽고 owner별 비교기와 암호화 journal 준비 경로에 연결했다. 원본을 지우는 legacy reader를 사용하지 않는다. 복구본/메모/다른 owner outbox/미지원 버전·필드가 있으면 원본 보존 후 중단한다.
- 검토한 원본과 대상 owner/storage를 WeakMap으로 결합, UI에 반환된 결과를 바꾸거나 다른 storage를 넘겨도 준비에 사용할 수 없다. 전환 lock 대기 중 원본 변경도 검사한다.
- 보호 boundary에 ‘기존 기록 확인하기’ 화면 연결. 실제 Supabase raw select와 owner 조건 사용. 결과는 읽기 전용 대조이며 등록/전환/삭제는 하지 않는다. 검증은 격리 앱+합성 Supabase 응답으로 수행했다.
- 기존 CLI 인증으로 운영 Supabase의 catalog와 집계에 읽기 접근 성공. 사용자 투자 본문/식별자/발송 내용은 조회하지 않았다. RLS 활성, vault 열/RPC 미설치 확인. 기존 save RPC는 security invoker, anon 실행 불가.
- 운영에 legacy settings JSON 열이 있고 현재 nonempty 행0. 기존 검증 스키마에는 이 열이 없었다. SQL proposal을 보강해 비어 있지 않은 settings가 있으면 전환 CAS를 거부하고, sealed 행에 settings 평문을 넣는 작업은 제약조건으로 거부한다. 운영 DDL은 실행하지 않았다.
- 현시점 digest queue 전체/미완료/active lease/본문 보관 행0. 예약 producer 중단이나 향후 유입 차단을 증명하지 않는다. 백업 API는 backups:null, PITR:false, WAL-G:true. 과거 백업/WAL 사본 소멸은 미확인이다.
- 근거: artifacts/portfolio-vault-rollout-20261029/live-preflight-20261030.json. 전체1,928통과/1skip, 타입·제품lint·선택ESLint 오류0(기존4경고), 실제 Chrome UI30검사, 격리 Postgres32검사 통과. 운영 배포/DB 변경/알림 발송/원본 삭제 없음.
- 잔여: 추가 사본 이관과 충돌 선택, 패스키 등록·전환 UI 및 편집/삭제 연결, 실제 Supabase JWT 통합, 알림 producer 전환·백업 보존 확인, 운영 계정 MFA·독립 검토. 전체 목표 미완료.
