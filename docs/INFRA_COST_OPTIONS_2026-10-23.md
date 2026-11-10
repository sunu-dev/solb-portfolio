# 주비 운영 인프라 비용과 대체 경로 (2026-10-23)

## 판단

- **월 $0 운영은 조건부로 가능하다.** Supabase Free의 용량 한도에는 현재 확인된 DB 크기 약 55.2 MB가 충분히 들어간다. 다만 Disk I/O 잔량 13% 경고와 동시 발생한 Supabase API Gateway 장애 때문에 현재 부하가 Free에서 안정적으로 돌아가는지 확인되지 않았다. 용량 여유가 I/O 여유를 뜻하지 않는다.
- Vercel Hobby는 약관상 개인·비상업적 용도로만 쓸 수 있다. 주비를 상업 서비스로 운영한다면 Vercel Pro 월 $20을 기준선으로 잡는다. 실제 현재 Vercel 구독·청구서는 확인되지 않았다.
- 장애가 회복되면 I/O 상위 SQL과 예약 작업을 먼저 측정·개선한다. 비효율적인 작업이 원인이라면 공급자를 옮겨도 비용과 지연이 따라간다. Supabase Pro 전환이나 Compute 증설은 측정 결과로 결정한다.

## 월 비용 비교 (USD, 세금·환율·초과 사용량·개발 인건비 제외)

| 시나리오 | DB·인증 | 호스팅 | 기본 월액 | 성립 조건 / 주요 제약 |
|---|---:|---:|---:|---|
| 현 구조, 비상업적 무료 운영 | Supabase Free $0 | Vercel Hobby $0 | **$0** | Supabase 500 MB DB·50k MAU·5 GB egress, Vercel Hobby 이용 조건, AI·메일 등 무료 할당량 준수. 현재 I/O 경고가 해결되어야 안정 운영 판단 가능. |
| 현 구조, 상업적 운영에서 DB 무료 유지 | Supabase Free $0 | Vercel Pro $20 | **$20** | DB I/O 한계는 그대로. Vercel Pro의 $20 사용 크레딧 초과분은 별도. |
| 현 구조, Supabase Pro Micro | Supabase Pro $25 | Vercel Pro $20 | **$45** | DB 일일 백업·7일 보관, 8 GB DB·100k MAU 포함. Pro $25에 월 $10 Compute 크레딧이 포함되어 Micro 비용을 상쇄한다. I/O 원인 해결을 보장하지는 않음. |
| 현 구조, Supabase Pro Small | Supabase Pro $30 | Vercel Pro $20 | **$50** | $25 구독료 + Small $15 - Compute 크레딧 $10. Nano 대비 I/O 기준 성능 증가. |
| 현 구조, Supabase Pro Medium | Supabase Pro $75 | Vercel Pro $20 | **$95** | $25 + Medium $60 - $10. 측정상 지속 부하가 높을 때만 검토. |
| Neon Free + 별도 인증, 상업적 운영 | Neon Free $0 + 인증 무료 티어 $0* | Vercel Pro $20 | **$20부터** | Neon 100 CU-hours/월·1 GB DB. 기존 매분 DB 예약을 그대로 두면 무료 시간 내 유지가 어려울 수 있음. 인증·RLS·API 이전과 Kakao 검증 필요. |
| Neon Launch 상시 0.25 CU + 별도 인증 무료 티어 | Neon 약 $19.70 + 인증 $0* | Vercel Pro $20 | **약 $39.70** | 730시간 × 0.25 CU × $0.106 + 1 GB × $0.35. 실제 자동 확장·스토리지·백업·함수 비용에 따라 증가. |
| Neon Launch 상시 0.5 CU + 별도 인증 무료 티어 | Neon 약 $39.04 + 인증 $0* | Vercel Pro $20 | **약 $59.04** | 730시간 × 0.5 CU × $0.106 + 1 GB × $0.35. |

\* 인증은 Clerk Hobby(최대 50k **monthly retained users**, 소셜 연결 최대 3개) 또는 Neon Managed Better Auth(Neon Free 최대 60k MAU)를 가정했다. 두 제품 모두 주비의 Kakao 로그인, 기존 계정 ID, Supabase RLS 규칙을 그대로 승계하는 것으로 **검증되지 않았다**. Clerk Pro가 필요하면 연간 결제 기준 월 $20이며 월 단위 결제 가격은 별도 확인이 필요하다. Neon의 공식 예시인 `간헐 부하·1 GB` 약 $15/월은 주비의 현재 매분 예약 작업을 유지한 상태의 견적이 아니다.

### 공통으로 더할 변동비

- **이메일:** Resend Free 3,000건/월, 하루 100건. 그 이상은 Pro $20/월(50,000건/월). 실제 발송량은 미확인.
- **예약 메시지:** 매분 작업을 DB 밖의 QStash로 옮기면 하루 1,440회라 Free 1,000건/일을 넘는다. PAYG는 10만 메시지당 $1로, 단순 30일 예약 호출 43,200건은 약 $0.43이지만 재시도·다른 작업·함수 실행료는 별도다. Neon Function Trigger로 바꾸는 선택지도 있으나 함수 사용량·DB 기상 시간은 실측해야 한다.
- **AI:** Gemini 2.5 Flash-Lite 표준 유료 요금은 입력 $0.10/100만 토큰, 출력 $0.40/100만 토큰; Flash는 $0.30/$2.50이다. 예시로 하루 100회, 회당 입력 3천·출력 1천 토큰, 월 30일이면 전부 Lite 약 $2.10 또는 전부 Flash 약 $10.20이다. 실제 주비의 다단계 호출, OCR, 검색 grounding, 재시도, 다른 AI 공급자 비용은 이 예시에 없다. 무료 API 할당량을 영구 운영비 $0으로 가정하지 않는다. 코드의 `AI_MONTHLY_BUDGET_USD`는 미설정/0이면 월 예산 차단이 비활성화되며 운영 설정값은 미확인이다.
- **시세·뉴스 API, 도메인, 세금·환율:** 현재 계약·실사용 청구를 확인하지 못해 합산할 수 없다. 상기 표는 전체 서비스의 확정 청구액이 아니라 비교용 기본액이다.

## 이전 비용과 실행 기준

현재 코드에는 Supabase SDK 참조 비테스트 파일 약 80개, 약 30개 테이블과 8개 RPC, Google/Kakao Auth, RLS, `pg_cron`·`pg_net` 의존성이 있다. Neon/일반 Postgres로 옮기는 것은 DB 파일 복사만으로 끝나지 않는다. API 계층, 세션과 기존 사용자 ID, 권한 정책, 예약 작업, 백업/복원을 격리 환경에서 다시 검증해야 한다. 따라서 위 Neon의 월 $5~$10 수준 절약 가능성이 있어도 일회성 개발·전환 비용은 별도이며 현재 견적할 근거가 없다.

1. Supabase 장애가 끝난 뒤 실제 청구·사용량(시간별 Disk I/O, 상위 SQL, DB 크기, MAU, egress), Vercel 플랜·사용량, Resend 발송량, Gemini 청구액을 수집한다.
2. 주비의 `pg_cron` 매분 digest retry, 주기적 수집, 일일 상장 목록 약 24,400건의 `last_seen` 갱신이 I/O에 미치는 영향을 측정한다. 문제 쿼리·배치를 개선하고 별도 백업/복원 확인 후 Free 유지 가능성을 재판정한다.
3. Free에서 지속 I/O가 기준을 넘고 운영 안정성이 필요하면 우선 Supabase Pro Micro($25 DB), 이후 필요한 경우 Small($30 DB)을 짧게 시험한다. 같은 부하에서 I/O와 응답 시간을 비교한다.
4. 개선 후에도 비용·장애가 반복될 때에만 Neon + 인증 격리 PoC를 시행한다. 월 요금 차이와 전환 비용, Kakao 계정 연속성·RLS 보안 동등성을 함께 평가한다.

## 공식 가격·조건 출처

- [Supabase 가격](https://supabase.com/pricing), [Compute·Disk I/O 기준](https://supabase.com/docs/guides/platform/compute-and-disk), [High Disk I/O 안내](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io)
- [Vercel 가격](https://vercel.com/pricing), [Hobby 이용 조건](https://vercel.com/legal/terms), [Cron 제한](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Neon 가격·CU-hour 계산](https://neon.com/pricing), [예약 함수와 scale-to-zero](https://neon.com/blog/your-neon-functions-can-now-run-on-a-schedule)
- [Clerk 가격](https://clerk.com/pricing), [커스텀 OIDC](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/custom-provider)
- [Resend 가격](https://resend.com/pricing), [QStash 가격](https://upstash.com/pricing/qstash), [Gemini API 가격](https://ai.google.dev/gemini-api/docs/pricing)
