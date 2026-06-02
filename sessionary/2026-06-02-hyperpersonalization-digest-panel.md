# 2026-06-02 — 초개인화 ADD/REMOVE 패널 + 시차 digest 전략 + P0 구현

> 흐름: production 배포 확인(ccb0ca8 READY) → 휴장 일정 버그 픽스(현충일 토요일 D-4 오노출 → 주말 필터) → **초개인화 전략 워크플로**(웹리서치 4 + 5인 패널 + 종합, 10에이전트·~860k토큰·61분) → 사용자 "모두 진행, 메모리 문서박제부터" → 박제 + P0 구현 착수.

## 핵심 결정 (왜)

1. **시차 인지 정시 digest = 초개인화 핵심 ADD** — 패널 5인 만장일치 topPick. 주비 모닝브리프는 '얼마(델타)'만 있고 '왜'가 비어 있음. 토스 AI 시그널/카카오페이/Robinhood Cortex가 검증한 '방향0=왜·무엇' 레인이 정확히 그 빈 칸. 기존 morning-brief cron 인프라 ~90% 재활용 가능.
2. **토스가 비운 자리** — 토스는 실시간·이벤트·관심탭 pull에 강하나 '시차 인지 정시 push digest'(국장 시간 간밤 미장 / 미장 전 국장)는 1차 근거상 미발견. 주비가 보유 데이터(평단·증권사통합·OCR) + 시차 슬롯으로 선점.
3. **descriptive에서 멈춤 = 컴플라이언스이자 의도적 차별점** — 2026 업계 트렌드 descriptive→prescriptive 중 유일하게 안 따라가는 지점(§6 레드라인). Public.com이 briefing→AI Agents 자동매매로 미끄러진 대조군. 거래 유인 0이라 토스보다 깨끗하게 줄 수 있음.
4. **영구 무료 retention** — Robinhood가 Cortex를 Gold $5로 가둔 것과 정반대. AI 촉처럼 무료 레인 유지, PRO는 시각화/세무 도구만 잠금.
5. **§6 안전 = 정시 규칙 발송** — 미국 Publisher's Exclusion 판례 + 금융위 해석 모두 '이벤트 타이밍 발송'은 면제 약화, '규칙적 정시 발송'이 안전. 이벤트형은 기존 check-alerts에 분리 유지.
6. **RAG 환각이 유일한 §6 위험** — 토스 2026-01 사고(동일 티커 타사 뉴스 오노출→환각 인과→주가 급등락)가 반면교사. RAG-first + sanitizeAiObject + FORBIDDEN 인과어 이중 게이트 필수. 면책·해설 범위는 약관 v4 변호사 검토 묶음 포함 후 LIVE.

## 작업 요약

- **휴장 버그 픽스**(`f725348`): getUpcomingHolidaysForMarket에 주말(토·일) 필터. 현충일(06-06 토) → '다음 휴장' 미표시, 30일 내 평일 휴장 없으면 섹션 자동 숨김.
- **워크플로**(`wmfqvuqve`): 리서치 4(토스tech·카카오·시차 cross-market·2026 트렌드) → 패널 5(PM·개인화엔지니어·시장시차·UX·법무, UX 렌즈 1개 structured output 깨져 종합에 흡수) → 종합(ADD P0 5 + P1 4 + REMOVE 5 + deliverySpec).
- **박제**: 메모리 `project_personalized_digest_strategy.md` 신설 + MEMORY.md 인덱스. docs/PERSONALIZED_DIGEST_SPEC.md 구현 스펙.

## 미해결 TODO (대부분 완료 — 2026-06-03 갱신)

- [x] P0 구현 5건 (`98ed784`) + 적대 리뷰 12건 반영(`f28e10b`) + close 슬롯 게이트(`549bda3`)
- [x] build·lint·적대 리뷰 워크플로(36 에이전트, must-fix 2 반영)
- [x] **배포 완료** — main 머지·push, **두 플래그 off라 무변화 배포**(morning만 동작)
- [ ] 플래그 활성화: `DIGEST_CLOSE_SLOT_ENABLED='on'`(2슬롯 가동) → 그 후 (변호사 후)`DIGEST_RAG_EXPLANATION='on'`
- [ ] ⚠️ 아침 브리핑 ①②(주목종목 미장 우선·이메일 면책 DISCLAIMER_DIGEST) 그대로 둘지 되돌릴지 미결
- [ ] P1: 보유 종목 캘린더 / 홈 시차 적응형 재정렬 / digest 카피톤 lint / 미장 전 저녁 슬롯(KST21:00 in-app·email만)

## 다음 세션 진입점

**상태**: digest P0 배포 완료(플래그 off). **단, 같은 세션에서 생존 패널이 pivot-required 판정 → 세무 피봇으로 전략 무게중심 이동.** digest는 "1 maybe" 차별점으로 인정됐으나 retention 배선 필요.
**참고**: 후속 흐름은 `2026-06-03-survival-pivot-and-tax-design.md` 참조. 전략 [[project_personalized_digest_strategy]] · docs/PERSONALIZED_DIGEST_SPEC.md.
