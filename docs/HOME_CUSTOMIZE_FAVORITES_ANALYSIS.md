# 홈화면 편집(A) + 메뉴 즐겨찾기(B) — 14인 전문가 패널 분석·의사결정 문서

> 2026-06-20. 디자인 6인 + 백엔드/엔지니어링 4인 + 관련(전략·컴플라이언스·QA·한국어UX) 4인 패널 → 도메인 종합 3 → 최종 통합. 코드 검증 기반.

## 판정 (사실상 만장일치)
- **B 메뉴 즐겨찾기('바로가기'/Pin)** = BUILD-MVP
- **A 홈 편집** = 보류·축소 재정의 (자유배치 영구 비제공)
- 패널 권고: 둘 다 **세무 v1 카나리 GO/NO-GO 이후** 백로그 (기회비용=1순위 리스크)
- **★ 파운더 결정(2026-06-20): 지금 구현. A 포함하되 "메인(총금액) 고정 / 그 아래 편집"으로 좁힘. 순서 B→A설계→A구현.** 패널의 세무 기회비용 인지하에 진행.

## 핵심 긴장의 답
"opinionated 기본의 명료함 vs 커스터마이즈 자유" → **화해시키지 말고 시간축으로 분리.** 디폴트 = 협상 불가 명료함(코드 SSOT). 커스터마이즈 = **코어를 잠근 옵트인 escape hatch**. '관리·확인 1번 도구'의 약속 = '결정 부담 없는 거울'. 홈 레이아웃 자유배치(풀 DnD)는 영구 비제공, 편집은 보조 위젯에만.

## THE load-bearing 아키텍처 결정
**카탈로그 = 코드, 사용자 의도 = 저장.**
- 위젯/메뉴 정의(label·icon·component)는 코드 레지스트리(SSOT). 사용자는 **id 배열/표시여부만 저장**.
- → 위젯/메뉴 추가·삭제·이름변경 = **무마이그레이션 코드 변경**. 저장된 배열이 슬림화 결정을 역전 불가(코어는 레지스트리에서 non-hideable 잠금).

### B 즐겨찾기
- **menuRegistry.ts SSOT 선행**: Header.NAV_ITEMS·MobileNav.TABS·FeatureDirectory.primary 3곳 하드코딩 → 단일 레지스트리에서 파생. `{id,label,icon,action:{section?,tab?,event?},screenIndependent}`. **라벨 불일치 버그 동시 해소**('이벤트 분석' vs '이벤트').
- **명명: "바로가기" + Pin** (NOT "즐겨찾기"+Star — Star는 이미 '관심 종목 찜'이 점유, FeatureDirectory.tsx:161/165/168). Pin = 의미 충돌 0.
- **진입점**: 모바일 5탭 flex 포화 → 6번째 탭 금지. PC='전체'·모바일='더보기' → 동일 '더보기' 시트(FeatureDirectory) 최상단 '바로가기' 섹션.
- **토글 모델·순서 고정**: BottomSheet.tsx:44-87 swipe-dismiss가 시트 내 드래그-리오더를 가로채 구조적 불가 → Pin on/off 토글, 순서='고정순'. 6개 한도.
- 복합 액션: '관심 종목'=section+tab 복합(action descriptor로 인코딩). 화면 비종속(데드메뉴 방지) 항목만 핀 후보.
- 저장: localStorage-only(Zustand persist 블롭 `menuFavorites: string[]`, darkMode 선례). resetPortfolio 0화 필수.

### A 홈 편집 (좁힌 형태)
- **코어 고정**: 총금액 히어로(Dashboard)는 레지스트리에 non-reorderable/non-hideable. **그 아래 보조 위젯만 편집.** (정확한 경계는 파운더 확인 — 본 문서 하단 '열린 결정')
- **DnD 없는 단발 토글 우선**: 표시/숨김 boolean. 순서변경은 텔레메트리 정당화 시 ↑↓ 버튼 증분(드래그 라이브러리 회피 → a11y WCAG 2.5.7 자동 충족, 모바일/PC 동일).
- 선행 리팩토링(탄탄한 구조): 공유 **WidgetCard chrome**(var(--token)만, 다크 부채 회피) + 위젯을 **id→컴포넌트 레지스트리**로 추출 + Dashboard 모놀리식은 고정이라 분해 불요(경계가 히어로 아래면).
- 렌더 합성 = `(user-visible AND data-gate-passes)`. 켰는데 데이터 없으면 1줄 빈 힌트(빈/깨진 카드 금지). '기본값으로 초기화' 상시 + Undo.
- AI 촉 발견경로(AI인사이트 탭·슬림링크·todayHeadline)는 숨김 대상 제외(영구무료 AI촉 = §6 회피 핵심).

## §6 / 정체성 (둘 다 순수 navigation → 무관, 단 박제 3건)
1. 영속 id를 **티커-불가 화이트리스트 enum**으로만 제한(추상 카테고리/메뉴키만). 개별 단일종목 '핀 위젯' 구조적 금지 — 종목찜은 watchlist로 일원화.
2. 직렬화 산출물에 종목코드/STOCK_KR 누출 검사 **불변식 단위테스트**로 박제(descriptive-not-prescriptive).
3. AI 촉 발견경로 코드상 숨김 제외.

## 리스크 (심각도)
| 심각도 | 리스크 | 완화 |
|---|---|---|
| high | 기회비용 — 2~3주가 세무(유일 painkiller)에서 빠짐 | 패널은 세무 카나리 선행 권고 / 파운더는 인지하 진행 |
| high | A 자기상쇄 — 슬림화를 사용자 손으로 역행 | 코어 non-hideable 잠금, 디폴트=코드 SSOT, 편집은 보조만 |
| medium | B 명명충돌(Star) | "바로가기"+Pin |
| medium | 메뉴 SSOT 3곳 표류 | menuRegistry SSOT 선행 |
| medium | §6 누출(티커 id) | 화이트리스트 enum + 불변식 테스트 |
| medium | 동기화 silent-fail(DB 채택 시) | MVP localStorage-only로 회피 |
| medium | 게이트 vs 숨김 혼동 | (visible AND gate) 합성 + 빈 힌트 |
| low | self-lockout / B 효용 과대 / 다크 부채 | 리셋 상시·코어 잠금 / 텔레메트리 30일 / WidgetCard 토큰 |

## 단계별 롤아웃
- **Phase 0**(패널 권고, 파운더 보류): 세무 v1 카나리 판정 선행
- **Phase 1 — B**(~1.5~2일): menuRegistry SSOT + 더보기 시트 '바로가기' Pin + localStorage + 텔레메트리
- **Phase 2 — A 설계+구현**(좁힌 형): WidgetCard chrome + 위젯 레지스트리 + 메인 고정/아래 표시·숨김 토글 + localStorage + 텔레메트리
- **Phase 3 — 풀 A + DB 동기화**(post-PMF only): Dashboard 분해·dnd-kit·user_portfolios JSONB·set-UNION 머지·60fps 게이트. 베타 단계 영구 보류 권고.

## 파운더 결정 필요
- [확정] 우선순위: 패널=세무 후 / **파운더=지금 진행** ✅
- [확정] B 명명: **"바로가기"+Pin** (권고대로)
- [확정] 저장: localStorage-only MVP, 멀티디바이스 수요 시 user_portfolios JSONB 승급
- [**미정 — 확인 중**] A 편집 경계: 총금액 히어로만 고정 vs 코어(히어로+보유테이블) 고정 vs 분석 서브탭만
- [미정] B 개수 한도(권고 6개), A 순서변경 허용 여부(권고 표시/숨김만 먼저)

## 측정 (검증=측정 룰)
- B: `menu_pin_added/removed`, `nav_via_favorite` → logApiCall(api_logs). 30일 사용 0이면 제거.
- A: `home_widget_toggle`(끄려는 욕구 선측정), 편집모드 진입률.
