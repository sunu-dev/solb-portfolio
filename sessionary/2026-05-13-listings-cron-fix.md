# 2026-05-13 — 신규 상장 확장 + Vercel Cron 사고 + 검증

## 작업 요약

직전 세션 (5/12) 5건 큰 작업의 **검증** + **신규 상장 파이프라인 확장** (B1+B2 — 한국 거래소 우회 + universe 후보 자동 enrich) + **Vercel cron 사고 디버깅**.

### A. AI 호출 통제 정책 검증 (commit 검증)

기존 c7777af 까지 정상 배포 + Supabase profiles 마이그레이션 적용 완료 확인. 사용자가 "이것만 적용하면 되지?" 묻고 신규 1건 적용 완료.

자동 검증 결과:
- 신규 8개 엔드포인트 모두 401 또는 200 응답 (의도대로)
- 코드 정합성: `getUserTier`/`getTierLimits` import 정상, 4 핫스팟 `data-tour` 모두 마킹

### B. 신규 상장 — Phase 1+2+3 후 추가 작업

**Phase 1 — sync-listings cron 첫 트리거**: US 24,400건 정상, KS·KQ 0건 (Finnhub 무료 한계).

**Phase 2 (B1) — 한국 거래소 우회**:
- `/api/admin/listings/add` 신규 — 한국 종목 수동 추가 (verifyAdmin)
- ListingsPanel '＋ 수동 추가' 토글 폼: 거래소 select + symbol/한국어명/설명
- Symbol 정규화 (KS/KQ suffix 자동)

**Phase 2 (B2) — universe 후보 자동 enrich**:
- `/api/cron/enrich-listings` 신규 — 매시간 50건씩 (Finnhub 60/min 안전)
- `/api/admin/listings/enrich` 신규 — 종목별 즉시 enrich
- ListingsPanel 각 row에 '📊 데이터 채움' 버튼
- `/api/search` first_seen fallback 제거 (24,400건 오탐 위험 박멸)

### C. Vercel Hobby Cron 사고 (3시간 디버깅)

**증상**: 87123f5, 322fb45 push 완료 + GitHub HEAD = 322fb45 확인됐는데 Vercel deployments에 둘 다 누락. webhook 미수신 의심.

**진단 경로**:
1. Vercel MCP `list_deployments` 호출 → 신규 deployment 0건 확인
2. 사용자 수동 redeploy 시도 → 옛 c7777af만 재빌드
3. GitHub Webhook 확인 → 비어있음 (정상 — GitHub App 방식)
4. 사용자 의심: "푸시가 안 된거 아냐?" → `git ls-remote` 검증 → push 100% 정상
5. **진짜 원인 발견**: `vercel.json` 에 `"schedule": "10 * * * *"` (매시 10분 cron)이 Hobby 한계 위반 → Vercel이 vercel.json 통째로 거부 → deployment 자체 미생성
6. 가설 검증: cron 제거 + push (8c40e6f) → 즉시 BUILDING 시작 ✅

**해결**:
- `enrich-listings` cron을 `0 1 * * *` (일별, KST 10:00)으로 변경
- `BATCH_SIZE` 50→40, `SLEEP_MS` 1100→1000 (60s 한계 안전)
- 24,400건 enrich 완주 약 610일 (Pro 전환 시 26일)

**부산물 — `docs/CRONS.md` 신규**:
- 7개 cron 전체 SSOT
- Vercel Hobby 한계 명시 (일별 1회, 시간당 금지)
- 새 cron 추가 시 체크리스트
- 시간 분산 원칙 (Concurrent Builds=1 안전)
- **이 사고 재발 방지** 핵심 효과

### D. 사용자 액션 (이번 세션 중)

- ✅ `profiles` 마이그레이션 적용
- ✅ `stock_listings` 마이그레이션 적용
- ✅ CRON_SECRET 제공 → enrich cron 첫 트리거 (FUNCTION_INVOCATION_TIMEOUT 발생 → batch 축소로 해결)
- ✅ Vercel 콘솔 수동 redeploy 시도 (옛 commit만 재빌드, 진단 도움)

## 결정사항

### Vercel Hobby 한계 명문화

`docs/CRONS.md` SSOT로 만들어 같은 사고 재발 방지. **시간당 cron 표현(`* * * * *`, `*/30 * * * *`, `0 * * * *`)은 vercel.json 자체를 거부**. 새 cron 추가 시 반드시 체크.

### Pro 전환 vs Hobby 유지

**Hobby 유지 결정** (사용자 비용 절감 우선). 단:
- enrich-listings를 일별로 한정 (610일 완주, 그러나 시총 큰 종목 25일 안에 완료 가능)
- 매월 ROI 재평가 — PRO 결제 페이지 출시 시점에 Pro 전환 트리거

### 한국 거래소 우회 — KRX OpenAPI 등록 회피

OpenDART 자동화 부담 큼. 우회:
1. **admin 수동 추가** (B-1 핵심)
2. **search 결과 자동 등록** — 사용자가 .KS/.KQ 검색 시 자동으로 `stock_listings` insert (P0-9)
3. KRX 자동 cron은 후속 (사용자 명시 요청 시)

## 미해결 TODO

- 🟡 ai-analysis 신규 IPO 안내 (stock_listings 데이터 채워진 후, Phase 2)
- 🟡 KRX OpenDART 자동 fetch cron (월 10건 이하라 admin 수동도 OK)
- 🟡 enrich-listings 모니터링 (1주일 후 시총 큰 종목 약 수백 건 채워졌는지 SELECT)
- 🟡 PRO 결제 페이지 출시 트리거 시 Vercel Pro 전환

## 다음 세션 진입점

오후 작업 (`2026-05-13-consulting-and-broker.md`)로 연결됨. 그 외:

1. enrich-listings cron 결과 확인 (1주일 후)
2. 베타 사용자 모집 시작 가능 (코드·인프라 준비 완료)
