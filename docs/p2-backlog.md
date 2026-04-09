# P2 백로그 — 다음 스프린트

> P0 (완료 2026-04-09), P1 (완료 2026-04-09) 이후 남은 과제.
> 우선순위는 전문가 9인 크로스 회의 결과 기준.

---

## DevOps

### CI/CD 파이프라인
- **무엇**: GitHub Actions 워크플로 — PR마다 `tsc --noEmit` + `jest` 자동 실행
- **왜**: 현재 regression은 사용자 민원으로 발견됨. 배포 전 자동 검증 필요
- **파일**: `.github/workflows/ci.yml` 신규 생성
- **예시**:
  ```yaml
  on: [push, pull_request]
  jobs:
    check:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 20, cache: npm }
        - run: npm ci
        - run: npx tsc --noEmit
        - run: npm test -- --passWithNoTests
  ```

### .env.example
- **무엇**: 모든 환경변수 키를 빈 값으로 나열한 파일
- **왜**: 두 번째 개발자 또는 미래의 나(새 환경)가 필요한 키를 즉시 파악 가능
- **내용**:
  ```
  FINNHUB_API_KEY=
  GEMINI_API_KEY=
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  NEXT_PUBLIC_KAKAO_JS_KEY=
  SLACK_WEBHOOK_URL=
  AI_DAILY_LIMIT_GUEST=3
  AI_DAILY_LIMIT_USER=10
  AI_DAILY_LIMIT_TOTAL=250
  ```

### Supabase 마이그레이션 파일
- **무엇**: `supabase/migrations/` 디렉터리에 현재 스키마 SQL 파일 추가
- **왜**: DB 스키마가 어디에도 버전 관리되지 않음. 새 Supabase 프로젝트 생성 불가
- **테이블**: `user_portfolios`, `ai_usage`
- **파일**: `supabase/migrations/001_initial_schema.sql`

---

## 아키텍처

### 포트폴리오 총계 계산 중복 제거 (DRY)
- **무엇**: `Dashboard.tsx`와 `PortfolioSection.tsx` 양쪽에서 `totalValue/totalCost/totalPL` 계산 중복
- **왜**: 계산 로직 변경 시 두 곳 수정 필요. 버그 발생 위험
- **해결책**: `src/hooks/usePortfolioTotals.ts` 훅 추출
  ```ts
  export function usePortfolioTotals() {
    // totalValue, totalCost, totalPL, todayChange, etc.
    // Dashboard와 PortfolioSection이 공유
  }
  ```

### 환율 기본값 1400 단일 상수화
- **무엇**: `1400` (USD/KRW 기본값)이 파일 4곳에 하드코딩
- **왜**: 환율 기본값 변경 시 여러 파일 수정
- **해결책**: `src/config/constants.ts`에 `export const DEFAULT_USD_KRW = 1400;` 추가 후 import

---

## AI/데이터

### historicalNote 근거 기반 생성
- **무엇**: AI 프롬프트의 `historicalNote` 필드가 근거 없이 생성될 수 있음 (hallucination 위험)
- **왜**: 초보 투자자가 "과거에 이런 패턴이면 N% 상승했다" 류의 잘못된 정보를 믿을 수 있음
- **해결책**:
  - 프롬프트에 "historicalNote는 반드시 '과거 유사 RSI/추세 데이터를 보유하지 않아 패턴 통계 제공이 불가합니다'라고 명시하거나, 실제로 제공된 데이터(RSI, 볼린저밴드 수치)만 근거로 활용하세요" 추가
  - 또는 historicalNote를 프롬프트에서 제거하고 실제 과거 데이터를 API로 조회하여 주입

---

## 프론트엔드

### 스타일 시스템 단일화
- **무엇**: Tailwind CSS + CSS-in-JS (style prop) + inline style 3가지가 혼용
- **왜**: 다크모드/반응형 처리가 일관되지 않음. 유지보수 비용 증가
- **해결책**: 신규 컴포넌트는 CSS variables + Tailwind 조합으로 통일. 기존 컴포넌트는 점진적 마이그레이션
- **규칙**: 색상은 `var(--text-primary)` 등 CSS 변수 사용. 레이아웃은 Tailwind. 복잡한 조건부 스타일만 inline

---

## PWA/모바일

### 스와이프 투 디스미스
- **무엇**: 바텀시트(종목 편집, 설정 패널 등) 아래로 스와이프하면 닫히는 제스처
- **왜**: 모바일 앱의 기본 UX 기대치. 현재는 X 버튼이나 오버레이 탭만 가능
- **해결책**: `useDragDismiss` 훅 — `onTouchStart/onTouchMove/onTouchEnd`로 드래그 감지 후 임계값 초과 시 닫기

### PWA 설치 프롬프트 커스텀
- **무엇**: 브라우저 기본 설치 프롬프트 대신 앱 내 안내 배너 표시
- **왜**: 기본 프롬프트는 맥락 없이 뜸. 앱 가치 전달 후 설치 유도가 효과적
- **해결책**: `beforeinstallprompt` 이벤트 캡처 → 앱 내 "홈 화면에 추가" 배너

---

## 보안

### Finnhub WebSocket 완전 프록시
- **현황**: P1에서 ws-token 엔드포인트로 부분 개선. 클라이언트가 서버에서 키를 받아서 직접 WebSocket 연결
- **P2 목표**: 서버가 WebSocket 프록시 역할 → 클라이언트는 서버와만 통신
- **왜 P2**: 구현 복잡도 높음. 현재 키가 브라우저 네트워크탭에 보이지만 번들에는 없는 상태로 위험도 낮음
- **해결책**: Next.js App Router의 `/api/ws-proxy` route (WebSocket upgrade 지원) 또는 별도 ws 서버

### `X-Forwarded-For` 스푸핑 방지
- **무엇**: `/api/ai-analysis`에서 IP를 `x-forwarded-for` 헤더로 추출하는데, 클라이언트가 헤더를 위조해 rate limit 우회 가능
- **해결책**: Vercel에서는 `x-real-ip` 또는 `x-vercel-forwarded-for` 사용 (위조 불가), 또는 Supabase auth 기반 rate limit으로 이전
