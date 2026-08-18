# AI 비용·감사 프리뷰 배포 준비도

기준일: 2026-07-17  
브랜치: `feat/ai-cost-ledger`  
범위: 프리뷰 배포 준비만 확인하며 운영 Supabase와 운영 Vercel은 변경하지 않는다.

## 현재 판정

**코드·DB 마이그레이션·환경변수·빌드 준비 완료, 파운더 화면 확인과 운영 적용 승인 대기.**

자동 브라우저와 macOS 화면 제어 런타임이 동일한 초기화 오류로 실행되지 않아 화면 육안 검증은 자동 완료로 표시하지 않는다. API·DB·프로덕션 빌드 증거는 확보했다.

## 요구사항별 증거

| 요구사항 | 판정 | 증거 |
|---|---|---|
| AI 비용 원장 | 완료 | 실제 Gemini 분석·AI 촉·OCR 3건의 모델·토큰·비용·지연시간 로컬 DB 저장 |
| 월 예산 하드캡 | 완료 | 합성 비용으로 95% 도달 후 AI 분석이 모델 호출 전 `503 budget_reached` 반환 |
| 전체 일일 하드캡 | 완료 | 로컬 합성 사용량 250건에서 모델 호출 전 `429` 반환 |
| AI 출력 감사 | 완료 | 분석·AI 촉 익명 표본 저장, 관리자 조회·검토 완료·JSON 내보내기 검증 |
| 개인정보 제거 | 완료 | 감사 JSON 재귀 검사에서 차단 키 0건, 원장에 프롬프트·응답·키 미저장 |
| 출처·기준시각 | 완료 | 분석·AI 촉 응답 메타데이터에 생성시각·모델·출처·조회시각 포함 |
| OCR 비용 통제 | 완료 | 합성 포트폴리오 이미지 인식 성공 및 `portfolio-ocr` 비용·사용량 저장 |
| 캐시 무과금 | 완료 | AI 촉 `intent=fetch` 전후 비용 행 수 동일 |
| 마이그레이션 인식 | 완료 | Supabase CLI가 `20260716000100`~`20260716000300` 3개를 로컬 마이그레이션으로 인식 |
| 마이그레이션 SQL | 완료 | 3개 재적용 성공, `supabase db lint --local --level error` 오류 0건 |
| 컴플라이언스 빌드 게이트 | 완료 | 알림·한국어·다크모드·투어 앵커 검사 통과 |
| TypeScript·프로덕션 빌드 | 완료 | Next.js 16.2.1 프로덕션 빌드 및 53개 정적 페이지 생성 성공 |
| 신규 단위 테스트 | 완료 | 비용·예산·감사·출처·안전상태·투자자 유형 23개 통과 |
| 전체 회귀 테스트 | 조건부 | 112개 중 기존 `formatKRW` 기대값 불일치 4건, 이번 기능과 무관하지만 배포 전 결정 필요 |
| 전체 ESLint | 조건부 | 저장소 기존 오류 47건 존재. 프로덕션 prebuild와 TypeScript는 통과 |
| 화면 육안 검증 | 대기 | 자동 UI 런타임 오류. 파운더가 로컬 URL에서 확인 필요 |

## 파운더가 로컬에서 볼 화면

로컬 서버: `http://localhost:3002`

서버가 내려가면 비밀값을 파일에 복사하지 않고 다음 명령으로 다시 실행한다.

```bash
BACKGROUND=1 ./start-local-supabase.sh
```

1. `/admin` → `API 관측`
   - 무료 베타 운영 안전 상태
   - AI 비용 원장과 기능·모델별 행
   - 월 누적·월말 예상·예산 95% 정지선
2. `/admin` → `AI 감사`
   - 분석·AI 촉 목표 100건 준비도
   - 공개 데이터 기준값과 사용자 노출 출력
   - 검토 완료 및 익명 JSON 저장
3. 일반 종목 → AI 분석
   - 결과 하단 생성시각·모델·출처·조회시각
   - 내용 오류 신고
4. 포트폴리오 → AI 촉
   - 결과 하단 생성시각·모델·출처
   - 기본 문자 이모지 대신 제품 아이콘·텍스트 사용 여부
5. 좁은 화면과 다크모드
   - 관리자 비용 표의 가로 스크롤
   - 텍스트·보더·상태색 대비

상세 체크 항목은 `docs/AI_COST_LOCAL_REVIEW_CHECKLIST.md`에 있다.

## 승인 후에만 실행할 운영 변경

### Supabase

적용 대상은 아래 3개뿐이다.

```text
20260716000100_ai_cost_ledger.sql
20260716000200_ai_output_audits.sql
20260716000300_ai_output_audits_source_snapshot.sql
```

과거 `YYYY-MM-DD_...sql` 파일은 현재 Supabase CLI가 건너뛴다. 과거 운영 적용 이력과 충돌할 수 있으므로 이번 작업에서 이름을 바꾸지 않았다.

### Vercel 환경변수

```text
AI_MONTHLY_BUDGET_USD=15
AI_MONTHLY_BUDGET_STOP_RATIO=0.95
AI_DAILY_LIMIT_TOTAL=120
ANALYSIS_DAILY_FREE=3
CHOK_DAILY_FREE=1
OCR_DAILY_LIMIT_USER=2
OCR_DAILY_LIMIT_ANON=1
ENABLE_CLAUDE_FALLBACK=false
AI_AUDIT_SAMPLE_RATE=1
AI_AUDIT_TARGET_PER_FEATURE=100
```

`ANALYSIS_DAILY_FREE`와 `CHOK_DAILY_FREE`가 실제 코드의 환경변수 이름이다. 운영 변경 후 `/admin` 안전 상태가 이 값과 일치하는지 다시 확인한다.

## 승인 순서

1. 파운더 로컬 육안 확인
2. 자본시장법 전문변호사 서면 의견에서 무료 개인화 AI·AI 촉 사용 가능 범위 확인
3. 운영 Supabase 마이그레이션 승인 및 적용
4. Vercel Preview 환경변수 승인 및 적용
5. 프리뷰 배포 후 동일 체크리스트 재검증
6. 별도 승인 없이는 Production 승격 금지
