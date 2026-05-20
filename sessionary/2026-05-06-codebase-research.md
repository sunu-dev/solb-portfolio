# 2026-05-06 — 전체 코드베이스 분석 보고서

## 작업 요약

사용자가 `research.md`에 전체 코드 분석 보고서 작성 요청 (--ultrathink).

**진행 방식**:
- 6개 Explore 에이전트 병렬 실행 (영역별 분담)
  1. 앱·라우트·API 표면
  2. 상태·훅·라이브러리 (Zustand, hooks, lib)
  3. 도메인 로직·설정 (utils, config)
  4. 컴포넌트 인벤토리 (61개)
  5. Supabase 스키마·마이그레이션
  6. AI·외부 API 통합 레이어

- 본 컨텍스트에서 종합 → `research.md` 774줄 작성

**보고서 구성** (17 섹션 + 부록 2):
0. Executive Summary (6가지 차별점)
1. 프로젝트 메타 (패키지, 환경변수, vercel.json)
2. 디렉토리 구조
3. 페이지 라우트 (6개)
4. API 라우트 (~30개, 카테고리별)
5. DB 스키마 (15 테이블, 4건 미적용 마이그레이션 강조)
6. 클라이언트 상태 (Zustand 533줄, 6훅, 3층 캐시)
7. 컴포넌트 인벤토리 (61개, 22,263줄)
8. 도메인 로직 (알림 엔진/정책 SSOT/컴플라이언스/챕터 P1~P4/건강도 4축/DNA 7캐릭터/AI 4 레이어 프롬프트)
9. AI 통합 (Provider failover, 촉 8단계 파이프라인, 회로 차단, Rate Limit)
10. Universe 158종
11. 디자인 토큰 & UX
12. 권한 모델
13. 정합성 결함 (C1, C2-data, H1-data, L3-data, M4-data)
14. 트리거 자동 처리
15. 빌드/배포 검증
16. 강점 & 트레이드오프 + 다음 우선순위
- Appendix A: 통계 / B: docs/ 참고

## 결정사항

- **병렬 6 에이전트**: 단일 에이전트로 179파일을 다 읽으면 컨텍스트 폭발. 영역별 분담이 효율적.
- **research.md 위치**: 프로젝트 루트 (docs/가 아닌). 사용자 요청대로 따름.
- **인용 형식**: `file_path:line` (CLAUDE.md 준수)
- **Markdown 표 다용**: 라우트/테이블/정책처럼 정형 정보가 많아 가독성 우선

## 미해결 TODO

오늘 신규 발생 항목 없음 — 보고서 작성만 수행.

기존 TODO는 변동 없음 (research.md는 TODO에 없던 ad-hoc 작업이었음).

## 다음 세션 진입점

기존 우선순위 그대로:
1. 🔴 Supabase 마이그레이션 4건 적용 (사용자 액션)
2. 🔴 Vercel 환경변수 추가 (RESEND_API_KEY 등)
3. 🔴 NEXT — `/admin/chok-debug` 배포 후 PER 채움률 확인 → 50% 이하면 `/candle` fallback 검토

`research.md`는 신규 기여자/미래의 자신을 위한 1-stop 핸드북으로 활용.
