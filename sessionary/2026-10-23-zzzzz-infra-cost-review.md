# 2026-10-23 - 무료 운영 가능성과 인프라 비용 비교

## 작업 요약
- Supabase Disk I/O 경고 이후 사용자가 요청한 무료 유지 가능성, 유료 전환, 타서비스 비용을 공식 요금표와 현재 코드 구조로 비교했다. 상세 근거와 월액은 `docs/INFRA_COST_OPTIONS_2026-10-23.md`에 기록했다.
- DB 크기 약 55.2 MB는 Supabase Free 500 MB 미만이지만, 관측된 Disk I/O 잔량 13%는 별도 성능 위험이다. 실제 시간별 I/O·청구 지표는 Supabase 장애/대시보드 연결 실패로 확인하지 못했다.
- 상업 운영을 가정한 기본액은 Vercel Pro + Supabase Free 월 $20, Supabase Pro Micro 월 $45, Small 월 $50, Medium 월 $95. Neon Launch 상시 0.25 CU + 인증 무료 티어 + Vercel Pro는 계산상 약 $39.70, 0.5 CU는 약 $59.04이며 전환비용/변동비 제외다.
- Vercel Hobby는 개인·비상업용이다. Neon Free의 월 100 CU-hours는 현재 매분 DB 작업을 유지하면 초과할 수 있다. Kakao 인증·RLS·API 이전도 미검증이다.

## 결정사항
- 현재 경고만으로 유료 전환·공급자 이전을 실행하지 않는다. 요금표보다 실측 I/O 원인 및 현재 청구서가 필요하고, 코드의 Supabase 의존도가 높아 이전의 일회성 비용이 월 요금 차이를 넘을 수 있기 때문이다.
- 비용 자료는 시점이 있는 가격 비교 문서로 보존한다. 실제 Vercel 플랜, Supabase 사용량, Resend 발송량, Gemini 및 시세·뉴스 API 청구액이 확인되면 갱신한다.

## 미해결 TODO
- [ ] Supabase/호스팅 상태가 회복된 뒤 월별 실청구와 시간별 I/O·상위 SQL을 수집해 무료 유지 가능성과 Pro Micro/Small 시험 필요성을 판정한다.
- [ ] 상업 운영 여부에 맞는 Vercel 플랜·약관을 확인한다.
- [ ] 이전을 결정할 경우 Kakao·기존 계정 ID·RLS·예약 작업을 격리 PoC에서 검증한다.

## 다음 세션 진입점
- `sessionary/TODO.md`의 Supabase Disk I/O 진단을 먼저 완료하고, `docs/INFRA_COST_OPTIONS_2026-10-23.md`의 조건부 비용을 실제 청구액으로 교체한다.
