# 2026-10-23 신뢰성 개선 배포 메모

## 현재 상태
**최종 자동 테스트 1,700개 통과·1개 skip. 운영 배포·DB 마이그레이션·예약 적용을 완료했다.** https://joobi.kr 의 운영 배포는 `dpl_BYVTsjoZkePQ7cqPZhRvgY87Sg5L`이며 production/Ready 상태를 확인했다. 코드·로컬 브라우저·빌드·격리 PostgreSQL 검증에 이어, 운영에서 매분 재시도 worker가 정상 호출되는 것도 확인했다.

전환 전 운영 기준은 `dpl_2pg6YVQnKMxmtKpyVVvVx6C38M1w`, 해당 선별 소스는 `/private/tmp/joobi-detail-release-20261022`다. 이번 배포는 `/private/tmp/joobi-trust-fixes-20261022`의 선별 소스를 사용했으며 무관한 변경이 있는 root 전체를 배포하지 않았다. 배포 및 운영 확인 자료는 [trust-release-20261023](../artifacts/trust-release-20261023/)에 보관한다. 이 문서의 운영 상태 갱신은 보관된 배포 소스 아카이브를 변경하지 않는다.

**확인 범위:** 빈 outbox에서 예약→HTTP→worker→DB 처리까지 확인했다. 이메일함/푸시 기기에서 실제 알림을 받는 흐름은 미검증이다. 보관 정리 예약은 등록됐지만 첫 실행 시각인 2026-10-22 19:25 UTC(한국 시각 10월23일04:25)가 아직 오지 않아 실제 실행은 확인하지 않았다. 시장 소식에는 KRX·미국 노동통계국(BLS)·환율 비교 자료의 부분 경고가 남아 있다.

## 제품 결정
- 사용자의 재무데이터 제외 제안에 따라 상세의 PER/EPS/시가총액/배당/52주 수치와 기업 지표 진입을 제거했다. 빈 숫자를 데이터처럼 제공하지 않는다.
- 회사가 하는 일·산업 연결·주가·거래량·뉴스·일반 재무 개념 설명은 유지한다. 가상 예시에는 실제 실적이 아니라는 표기를 유지한다.
- 공개 AI 입력에서 PER/EPS/52주 수치를 제거한다. 최신 재무수치가 없음을 프롬프트에 명시한다. 자유 생성 답변 전체가 검증됐다는 뜻은 아니다.
- 새 /api/company-profile은 저장된 분류만 제공한다. /api/fundamentals은 410/no-store로 종료한다. 내부 종목 유니버스/관리용 수집 데이터까지 삭제하는 작업은 포함하지 않았다.

## 운영 적용 순서
이번 배포에서는 아래1–4단계를 완료했으며5단계의 재시도 worker 정상 호출을 관측했다. 아래 절차는 이후 재적용 시에도 사용한다.

1. DB에 supabase/migrations/20261022000200_digest_delivery.sql 적용. 기존 표·구독 상태를 변경하지 않는 추가 마이그레이션이다. 새 함수/표의 RLS·권한 확인.
2. 선별 소스에 운영 환경을 연결하고 prebuild/build 후 staged 배포. 프로필200·재무410·뉴스168시간·비인증 digest-retry401과 UI 확인. cron 실제 실행은 스모크 테스트에 사용하지 않는다.
3. 운영 도메인을 검증된 staged 배포로 전환. 기존 producer가 실행 중인 예약 시각 경계를 피해 구·신 producer의 동시 실행을 피한다. legacy 확인과 새 outbox 등록은 서로 다른 구현 사이의 단일 트랜잭션이 아니다.
4. Vault의 기존 joobi_market_watch_cron_secret이 운영 CRON_SECRET과 일치하는지 값을 출력하지 않고 확인. 운영 worker 경로가 배포된 후 supabase/operations/digest-retry-schedule.sql 적용. 매분 재시도 예약과 7일 보관 정리를 추가한다. 기존 마감 슬롯 활성화 플래그는 별도이며 이 예약으로 켜지지 않는다.
5. 다음 정상 예약에서 큐 크기·대기시간·채널별 결과와 pg_net 응답을 확인한다. provider accepted는 실제 수신 확인이 아니다. 실제 수신 테스트는 명시된 테스트 수신자에 한한다.

## 발송 계약과 한계
- 사용자/날짜/슬롯/채널마다 하나의 영속 payload. 이메일은 같은 row id로 Resend idempotency key를 유지한다. 서로 다른 채널의 성공/실패를 분리한다.
- 전송 전에 최신 구독 동의와 현재 이메일을 다시 확인한다. 수신 주소가 바뀌면 이전 payload는 취소한다. auth.users 삭제 시 payload도 cascade 삭제된다.
- 최대3회·생성 후6시간·2분 lease. 첫 실패 후5분, 다음 실패 후15분 이후 다시 처리할 수 있다. 429/5xx는 재시도하며 이메일 네트워크 불명확 결과도 동일 키로 재시도한다. 공급자 멱등키의 24시간 보관 범위 안에서만 재시도한다.
- Resend 409 중 `concurrent_idempotent_requests`는 같은 키로 재시도하지만, 본문 불일치인 `invalid_idempotent_request`는 종료한다. HTML 오류 응답도 HTTP 상태대로 분류한다. 2xx라도 공급자 접수 ID가 없으면 성공으로 기록하지 않고, 멱등키가 있을 때만 재시도한다. 기준: [Resend 공식 멱등키 설명](https://resend.com/changelog/idempotency-keys).
- 푸시는 공급자 멱등성이 없어 불명확한 타임아웃/중단을 자동 재전송하지 않는다. 404/410으로 종료된 구독은 당시 전송한 endpoint가 여전히 일치할 때만 삭제해, 그 사이 새로 등록된 구독을 보호한다.
- worker는 회당 최대10개를 병렬 처리한다. 이메일 시작을600ms 간격으로 분산하고 DB/수신자 조회·결과 저장에5초, 공급자 요청에10초 상한을 둔다. 경로의 실행 제한은60초다. 정기 worker 기준 최대600회/시간이며 재시도도 이 예산을 사용한다. 처리량 상한은 실제 수신 보장이 아니며, 생산자의 구독·포트폴리오 일괄 조회와 공급자 한도는 베타 규모에 맞춘 구조다.
- 한 사용자의 준비 오류가 뒤 사용자의 queue 등록을 막지 않는다. 누락이 있으면 개인 정보 없이 실패 수를 보고하고 producer는500을 반환한다. 한 건의 결과 저장 오류가 있어도 다른 claim의 처리는 완료하며 worker 전체는 실패로 보고한다.
- SQL에서 만료·중단 처리된 실패도 `claim_digest_failure_report()`가 회수한다. `failure_reported_at`으로 보고 대상을 원자적으로 선점해 동시 worker가 같은 실패를 중복 집계하지 않는다. 새 발송 claim이0개여도 확인하며, 응답의 `reportedFailures`는 이번 시도의 `failed`와 별개다. 운영 경고는 개인 정보 없는 집계만 사용한다. 이 집계와 Slack/이메일/기기에서 실제 메시지를 받은 사실은 구분한다.
- rolling 전환 시 기존 notification_log가 있으면 중복 위험 때문에 해당 날짜를 자동 재전송하지 않는다. 기존 실패 알림의 과거 소급 발송은 하지 않는다.

## 평가액과 운영 설정
- 환율·시세가 없으면 평가액/변동액을 미확인으로 표시한다. 1,400원 가정이나 일부 종목 합계를 전체 값으로 내보내지 않는다. 오늘 주가 변화는 현재 환율 환산이며 환율 자체의 하루 변화는 제외한다.
- 종목 시세는 가격·등락값이 유한하고 가격이 양수여야 한다. 관측시각이 없거나4일 이상 지났거나 현재보다5분 넘게 미래인 값은 쓰지 않는다. 환율도 양수와 같은 관측시각 범위를 확인한다. 시장 휴장 여부를 추정해 오래된 값을 오늘 값으로 바꾸지 않는다.
- 어제 비교는 정확히 전날의 원화 스냅샷만 사용하고 종목·통화별 총 보유 수량이 같을 때만 계산한다. 복수 증권사의 같은 종목은 합산해서 비교한다. 유효하지 않은 등락값은 주목 종목에도 넣지 않는다. 보유 종목의 작은 움직임으로 시장 전체가 조용했다고 서술하지 않는다.
- 미국 시세의 서버 키 해석은 `/api/quotes`와 같이 `FINNHUB_API_KEY` 우선, 기존 `NEXT_PUBLIC_FINNHUB_API_KEY` 다음이다. 후자의 이름만 있는 운영 구성도 처리하며 키 값은 응답·로그·문서에 포함하지 않는다.
- `NEXT_PUBLIC_APP_URL`이 없으면 `https://joobi.kr`를 사용한다. 결정된 appUrl을 한국 시세 조회에 인자로 전달하고, 환율 요청·브리핑 링크·수신거부 링크도 같은 기본 도메인을 사용한다. `undefined/api/...`나 이전 Vercel 도메인을 기본값으로 만들지 않는다.

## 검증 근거
- 최종 전체 자동 테스트1,700개 통과·1개 skip. 타입 검사와 필요한 빌드/문구 검사를 완료했다. skip은 통과한 검사에 포함하지 않는다.
- 알림 집중 검증5파일·41개 통과: 채널별 재시도/동의/주소 변경/중복 방지, 만료·중단 보고, 배치 처리량과 타임아웃, HTTP/409 분류, 생산자 오류 격리, 시세 관측시각, 운영 키 fallback과 기본 URL.
- 편집한 알림 TypeScript 파일 ESLint 및 알림 문구 검사 통과.
- 네트워크·공개 포트 없는 임시 PostgreSQL15에서10개 검사 통과: 마이그레이션 및 재적용, 동시 claim과 lease, 이메일/푸시 중단 처리 차이, 실패1회 집계와 동시 reporter, 비인증 권한 차단, service role 접근, 계정 삭제 cascade. 임시 컨테이너는 제거했다.
- 검증 중 실제 사용자 이메일·푸시 발송은 하지 않았다. `sent`는 공급자 접수이며 메일함/기기 도착 검증과 구분한다. 격리 검사 원본은 `/private/tmp/digest-db-review-20261023.json`, `/private/tmp/check-digest-review-20261023.py`, 상세 검토는 `/private/tmp/delivery-review-20261023.md`다. 배포 artifact에 함께 보관한다.

## 운영 관측
2026-10-22 16:04:25 UTC(한국 시각 10월23일01:04:25)의 [postdeploy-health.json](../artifacts/trust-release-20261023/postdeploy-health.json)을 기준으로 다음을 확인했다.

- `joobi-digest-retry` 매분 예약과 `joobi-digest-retention` 매일19:25 UTC 예약이 모두 활성 상태다. DB outbox/RLS 등록, anon·authenticated 조회 제한, service role의 claim 권한도 별도 적용 결과에서 확인했다.
- 재시도 예약이16:02·16:03·16:04 UTC에 연속3회 성공했다. pg_net 실제 응답은 모두 HTTP200이며 timeout과 error가 없다. `ok: true`, `sent/retryable/failed/cancelled/reportedFailures`는 모두0이다.
- outbox 행0개, 남은 QA 계정0개, 기존 인증 사용자3명·포트폴리오3행을 확인했다. 이 관측은 실제 수신자가 있는 발송 성공 검증으로 계산하지 않는다.
- 보관 정리의 첫 예약은19:25 UTC다. 위 관측에는 해당 작업의 실행 기록이 없으므로 **등록 완료·실제 첫 실행 미검증**으로 구분한다. 첫 실행 후 cron 실행 결과와 보관 기준을 넘긴 행이 남아 있는지 확인한다.
- 최신 시장 수집도 HTTP200이지만 부분 결과다. 시세19/20, KRX0/1, 경제 자료 전체 확인0/1, 시장 뉴스2/2이며 경고는 원·달러 비교 미확인·거래소 공시 갱신 실패·BLS 일정의 마지막 확인 목록 사용이다. HTTP 성공을 모든 원천 데이터 복구로 해석하지 않는다.

상태별 결과와 대기시간, 아직 보고 대상으로 회수되지 않은 종료 실패를 같이 확인한다. 구독 확대 시 큐 지연 임계값에 대한 별도 경고와 producer 분할을 검토한다.

```sql
select channel, status, last_error, count(*)
from public.digest_deliveries
where created_at >= now() - interval '1 day'
group by channel, status, last_error;
select count(*) as waiting, min(created_at) as oldest
from public.digest_deliveries where status in ('pending','retryable','sending');
select count(*) as unreported_terminal_failures
from public.digest_deliveries where status = 'failed' and failure_reported_at is null;
```

## 되돌리기
알림 코드까지 이전 배포로 되돌릴 때는 단순 도메인 롤백만 하지 않는다. 먼저 새 retry 예약을 해제하고 실행 중 worker/lease 종료를 확인한다. 새 outbox에 이미 sent/sending인 날짜를 기존 notification_log와 조정해 이전 producer가 같은 알림을 다시 보내지 않게 해야 한다. payload/표를 즉시 삭제하지 않고 결과를 확인한 후 정리한다. 조회 UI만 문제가 있으면 알림 구현은 유지하고 UI를 수정 배포하는 편이 안전하다.

## 남은 검수
보관 정리 예약의 첫 실제 실행, 이메일함·푸시 기기의 종단 간 실수신, 실제 OAuth·두 실기기 사용·PWA 설치, KRX/BLS/환율 비교 자료의 복구 및 장시간 추이는 후속 확인 대상이다. 내부 QA를 제외한 외부 초보자의4주 이용 검증과 디자인 피드백도 별도이며, 이번 배포로 시장성이 입증되지는 않았다.

## 최종 관측 추가 (2026-10-23 01:17 KST)
`artifacts/trust-release-20261023/postdeploy-health-final.json`: 최근15분 digest 정상 HTTP200 14회,실패0·빈큐·QA0. 산업16:05UTC 요청42/42·선별28,시장16:10UTC 원천부분누락 지속·연속실패1→2 확인. 운영공개47/47·실제QA인증17/17·자산/권한10/10,390/320px다크·작업실확인. 전체근거와미검증범위는같은artifact의REPORT.md를따른다.
