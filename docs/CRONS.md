# Cron Jobs — 운영 SSOT

> 모든 Vercel cron 정의·스케줄·목적을 한 곳에 정리. `vercel.json` 의 `crons` 배열과 1:1 대응.
> 변경 시 이 문서를 함께 갱신할 것.

## 현재 등록된 Cron 9개 (vercel.json 항목 10개 — `enrich-warm`이 2회 등록)

| # | path | 스케줄 (UTC) | KST 환산 | 빈도 | 목적 |
|---|---|---|---|---|---|
| 1 | `/api/cron/morning-brief` | `0 22 * * *` | 매일 07:00 | 일별 | 모닝 브리핑 푸시·이메일 발송 |
| 2 | `/api/cron/cleanup-pii` | `0 19 * * 6` | 토요일 04:00 | 주별 | PII 365일+ 자동 삭제 + alert_log cleanup |
| 3 | `/api/cron/monthly-d3-reminder` | `0 11 * * *` | 매일 20:00 | 일별 | 월말 D-3 리마인더 (월말 3일 전만 발송) |
| 4 | `/api/cron/chok-followup` | `30 17 * * *` | 매일 02:30 | 일별 | AI 촉 추천 종목 24h 후 성과 트래킹 |
| 5 | `/api/cron/sync-listings` | `0 0 * * *` | 매일 09:00 | 일별 | Finnhub 전체 상장 목록 diff (신규/상폐) |
| 6 | `/api/cron/enrich-listings` | `0 1 * * *` | 매일 10:00 | 일별 | stock_listings 시총·상장일 점진 채움 (40건/일) |
| 7 | `/api/cron/check-alerts` | `0 13 * * *` | 매일 22:00 | 일별 | 가격·기술지표 알림 체크. 미장 개장 직전·푸시 quiet hours 안전 (2026-05-15 등록, BLOCKER #2 대응) |
| 8 | `/api/cron/morning-brief-close` | `0 7 * * *` | 매일 16:00 | 일별 | 국장 마감 digest 슬롯. `runDigest(req,'close')` 얇은 래퍼 — 슬롯을 wall-clock이 아닌 **경로**로 결정론화(재시도 시 슬롯 뒤집힘 방지). `DIGEST_CLOSE_SLOT_ENABLED='on'` 게이트 |
| 9 | `/api/cron/enrich-warm` | `50 21 * * *` | 매일 06:50 | 일별 | 국장 오전 세션 직전 `enrichUniverse()` L2 캐시 예열. **Gemini 미호출** |
| 9 | `/api/cron/enrich-warm` | `50 12 * * *` | 매일 21:50 | 일별 | 미장 저녁 세션 직전 예열 (같은 경로, 두 번째 스케줄) |

> 2026-08-18 현행화 — 이전 판은 7개만 기재해 `morning-brief-close`·`enrich-warm`이 누락돼 있었다.

## Vercel 플랜 한계 (반드시 지킬 것)

**현재 플랜: Hobby (Free)**

| 한계 | Hobby | 위반 시 |
|---|---|---|
| Cron 최소 간격 | **일별 1회만** | vercel.json 거부 → 배포 자체 미생성 |
| 시간당 cron (`* * * * *`, `*/30 * * * *`, `0 * * * *`) | ❌ 금지 | 동일 |
| Function maxDuration | 60s | TIMEOUT |
| 정확도 | ±59분 (`0 1 * * *` → 01:00~01:59 사이 발동) | — |

> **참고 사고 (2026-05-13)**: `enrich-listings` 에 `10 * * * *` (매시 10분) 등록 → Vercel이 vercel.json 통째로 거부 → 4커밋 배포 누락. 진단 후 일별로 전환하여 해결. 커밋 `8c40e6f`.

## 운영 가이드라인

### 새 cron 추가 시 체크리스트

- [ ] 스케줄이 **일별 또는 더 드문 빈도** 인가? (Hobby 한계)
- [ ] Function 60초 안에 끝나는가? (batch 처리는 BATCH_SIZE × per-item time 계산)
- [ ] `defineRoute({ auth: 'cron', rateLimit: false })`로 감쌌는가? (인증 자체 구현 금지)
- [ ] 실패 시 Slack 알림 (선택)
- [ ] 이 문서 업데이트했는가?

### 인증 규약 (2026-08-18)

cron 인증은 `src/lib/apiRoute.ts`의 `defineRoute({ auth: 'cron' })` **한 곳**이 담당한다.
라우트가 각자 `verifyCronAuth`를 복제하던 시절 `check-alerts`만 `if (!secret) return false` 가드가 빠져,
`CRON_SECRET` 미설정 시 `Authorization: Bearer undefined` 헤더로 인증이 뚫릴 수 있었다.

- 예외는 `check-alerts` 하나 — Vercel Cron(GET, CRON_SECRET)과 Upstash QStash(POST, 서명 검증)를
  동시에 받아 공통 cron 모드로 표현할 수 없다. 자체 인증을 유지하되 미설정 가드는 필수.
- 이 규약은 `src/__tests__/cronAuthBoundary.test.ts`가 박제한다 — 예외를 늘리려면 사유와 함께 등재해야 한다.

### Cron 시간 분산 원칙

여러 cron이 동시 실행되면 Hobby `Concurrent Builds=1` 한계로 큐잉 발생 + Finnhub rate limit 충돌. 각 cron 사이 **최소 30분 간격** 유지:

```
00:00 UTC  sync-listings    (KST 09:00)
01:00 UTC  enrich-listings  (KST 10:00)
11:00 UTC  monthly-d3       (KST 20:00)
17:30 UTC  chok-followup    (KST 02:30)
19:00 UTC  cleanup-pii      (KST 04:00, 토요일만)
22:00 UTC  morning-brief    (KST 07:00)
```

### 수동 트리거 방법

```bash
# CRON_SECRET 은 Vercel Settings > Environment Variables 에서 확인
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://solb-portfolio.vercel.app/api/cron/<route-name>
```

응답이 401 이면 시크릿 틀림, 200/503 이면 정상 동작.

## 향후 Pro 전환 시 가능한 것

- 시간당 cron (`0 * * * *`, `*/30 * * * *`) 가능 → `enrich-listings` 가속 (40건/일 → 40건 × 24 = 960건/일 → 24,400건 26일에 완료)
- Function maxDuration 300s → 한 번에 batch 200건 처리
- `chok-followup` 을 시장 마감 직후로 정밀 트리거 가능

## 환경변수 의존

- `CRON_SECRET` — 모든 cron 인증
- `FINNHUB_API_KEY` — sync/enrich-listings
- `SUPABASE_SERVICE_KEY` — 모든 cron DB 쓰기
- `SLACK_WEBHOOK_URL` (선택) — 알림
- `VAPID_*` — push (morning-brief, check-alerts)
- `RESEND_API_KEY` (선택) — 이메일 (morning-brief, monthly-d3)
