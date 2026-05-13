# Cron Jobs — 운영 SSOT

> 모든 Vercel cron 정의·스케줄·목적을 한 곳에 정리. `vercel.json` 의 `crons` 배열과 1:1 대응.
> 변경 시 이 문서를 함께 갱신할 것.

## 현재 등록된 Cron 7개

| # | path | 스케줄 (UTC) | KST 환산 | 빈도 | 목적 |
|---|---|---|---|---|---|
| 1 | `/api/cron/morning-brief` | `0 22 * * *` | 매일 07:00 | 일별 | 모닝 브리핑 푸시·이메일 발송 |
| 2 | `/api/cron/cleanup-pii` | `0 19 * * 6` | 토요일 04:00 | 주별 | PII 365일+ 자동 삭제 + alert_log cleanup |
| 3 | `/api/cron/monthly-d3-reminder` | `0 11 * * *` | 매일 20:00 | 일별 | 월말 D-3 리마인더 (월말 3일 전만 발송) |
| 4 | `/api/cron/chok-followup` | `30 17 * * *` | 매일 02:30 | 일별 | AI 촉 추천 종목 24h 후 성과 트래킹 |
| 5 | `/api/cron/sync-listings` | `0 0 * * *` | 매일 09:00 | 일별 | Finnhub 전체 상장 목록 diff (신규/상폐) |
| 6 | `/api/cron/enrich-listings` | `0 1 * * *` | 매일 10:00 | 일별 | stock_listings 시총·상장일 점진 채움 (40건/일) |
| 7 | `/api/cron/check-alerts` | (수동/외부) | — | — | 알림 체크. Vercel cron 미등록 (QStash 또는 외부 트리거 가능) |

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
- [ ] `CRON_SECRET` Bearer 검증 포함했는가?
- [ ] 실패 시 Slack 알림 (선택)
- [ ] 이 문서 업데이트했는가?

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
