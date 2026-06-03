# 2026-06-03 — 생존 패널(pivot-required) + 세무 피봇 설계·법률 질문지

> 흐름: digest P0 배포 후 사용자가 "전체 화면·기능 12인 패널로 생존 회의" 요청 → **pivot-required 판정** → "세무 피봇 설계부터" → 설계 워크플로 → "법률 질문지 작성" → 세무사·변호사 자문 질문지 박제.
> **다음 세션 핵심**: 세무 기능 구현은 **세무사 calc 감수 + 변호사 카피·약관 검토** 게이트. 파운더가 자문 + 4 결정 후 진입.

## 핵심 결정·결과 (왜)

1. **생존 판정 = pivot-required (12인 만장일치, 확신 80%)** — Q1(쓸 이유) 11 no, Q2(생존) 0 survive. 죽음은 자본 아닌 방향에서(번레이트 0 → 활주로 있으나 매출 경로가 코드에 없어 slow-death 기본값). 메모리 [[project_survival_pivot]].
2. **방향0 = vitamin·수익 천장** — AI 자문 유료화하면 §101 무료면제(=§6 회피 전제) 붕괴. → AI 영구 무료, **과금은 자본시장법 밖(세무)**.
3. **세무가 유일 painkiller** — '계산·정리 노동'이라 §6 안 어기고 실행가능 결론 제공. 토스(자사 거래만)·ChatGPT(내 데이터 모름) 구조적 불가. 메모리 [[project_tax_pivot]].
4. **세무사법이 자본시장법만큼 중요** — §20③(2026.1.2) 오인 광고만으로 형사처벌 → "세무 비서" 네이밍 배제, "양도세 계산기". 계산도구 한정·신고 셀프(삼쩜삼 무혐의 앵커).
5. **평단 ≠ 세무 취득가** — 환차익 뭉개져 틀림(치명). lot별 결제일 공식환율 필요 → transactions/fx_rates 신설 + toKrwAtSettle 게이트. OCR 정산내역 = moat.

## 작업 요약

- **생존 회의 워크플로**(`wqpf3lfhx`→resume `w1shf0sb1`): Ground 4(코드 매핑) + 12인 패널 + 베어/불 + verdict. verdict가 StructuredOutput 실패 → **산문으로 바꿔 resume**(18 캐시, 1 재실행, 89초). 교훈 메모리 [[feedback-panel-audit-methodology]]에 박제.
- **세무 설계 워크플로**(`wf9ddndpz`): 리서치5(세법·금투세·세무사법·선례 + 데이터모델 코드) + 설계5인 + 산문 스펙. 결과 `docs/TAX_PIVOT_MVP_SPEC.md`.
- **법률 질문지**(`7a1a3b2`): `docs/legal-review/LEGAL_CONSULTATION_TAX.md` — 세무사 9문 + 변호사 6문 + 면책 4축 + 결정표. 배포 게이트.
- 메모리 승급 4건: project_survival_pivot(신규)·project_tax_pivot(신규)·MEMORY.md 인덱스(+market_strategy 캐비엇)·feedback_panel_audit_methodology(StructuredOutput 교훈).

## 미해결 TODO

### 🔴 세무 피봇 진입 게이트 (파운더 액션)
- [ ] **세무사 자문** — docs/legal-review/LEGAL_CONSULTATION_TAX.md A섹션 9문(환율 기준일·lot 취득가·환차손익·필요경비·과세대상 판정 주체·추정치 라벨 오차).
- [ ] **변호사 자문** — B섹션 6문(§20③ 네이밍·§2 상담/서류작성·OCR=직접입력 동치·약관규제법 §7·§101 단일 PRO 묶음).
- [ ] **파운더 결정 4건** — ①입력경로(OCR vs 수기) ②sold→sell 일원화 ③FX USD-only vs 다통화 ④공식 매매기준율 데이터 소스(서울외국환중개 라이선스).

## 후속 (같은 세션) — "감수 꼭 필요?" 검토 + Phase 1 골격 + v1 슬라이스 빌드

- **"세무사 감수 꼭 필요?" 3관점 워크플로(`wm7soled6`)** → 답: **법적 의무 아님, 조건부.** 증권사 제공 세액 합산·정리(v1)=감수 불요·변호사 약관만 / raw 자체 재계산(v2)=감수+E&O 필수. needs-confirm 4개 중 2개 국세청 공식답(환율=결제일 국제세원-229, lot=증권사 이동평균, 합계액 신고 허용). 선례(Koinly·Sharesight·삼쩜삼·토스) 만장일치='추정 도구+면책+전문가 유도'. spec/메모리 박제.
- **LLM이 변호사 대체 못 하는 이유 명시**: 변호사가 파는 건 지식이 아니라 **책임(중과실 방어 증거)**. [[feedback-professional-review-not-llm]].
- **Phase 1 안전 골격 빌드(`d052787`, main 푸시됨)**: taxRates.ts SSOT(verified만)·alertCompliance TAX_FORBIDDEN_PHRASES+gateTaxAdvice·lint-alerts 세무 scoped·transactions/fx_rates 마이그(Supabase 수동 적용 대기)·tax.ts toKrwAtSettle·StockItem.purchaseDate·TAX_TOOL_VERSION. 전부 dormant.
- **v1 합산기 슬라이스 빌드(브랜치 `tax-v1-slice`, `899c28c`+`0ba64e8`, 푸시됨·main 미머지)**: A computeTaxEstimate 순수함수+vitest 9건 / B taxStore(persist) / C TaxEstimateModal+포트폴리오 진입 카드. 다듬기: 만원 입력·연도 선택·세금0 맥락 메시지·합산 Aha·전체 지우기. tsc·lint·vitest·build 0.

### 🟢 자문 후 / 검증 후
- [ ] **v1 슬라이스 카나리/지인 WTP 검증** (변호사 전 가능 — 프리뷰는 공개 아님). 반응 좋으면 main 머지(공개)+결제 레일+변호사 약관.
- [ ] transactions/fx_rates 마이그 **Supabase 콘솔 수동 적용** (v2 자체계산 시 필요).
- [ ] v2(자체계산: 환차·필요경비·lot 재계산) = 세무사 감수+E&O 게이트.
- [ ] 파운더 결정 4건 (입력경로·sold일원화·FX·환율소스) — v2 진입 시.

### 🟡 digest 잔여 (별개)
- [ ] 플래그 on 단계: DIGEST_CLOSE_SLOT_ENABLED → (변호사 후) DIGEST_RAG_EXPLANATION
- [ ] 아침 브리핑 ①②(미장 우선·면책 문구) 되돌리기 여부

## 다음 세션 진입점

**상태**: 세무 v1 합산기 슬라이스 **빌드 완료**(브랜치 `tax-v1-slice` 푸시, main 미머지=비공개). 골격은 main. digest P0 배포됨(플래그 off).
**우선순위**: ① v1 슬라이스 **프리뷰/카나리 WTP 검증** → 반응 좋으면 main 머지+결제+변호사 약관 / ② v2(자체계산)는 세무사 감수 게이트.
**참고**: [[project_survival_pivot]] · [[project_tax_pivot]] · [[feedback-professional-review-not-llm]] · docs/TAX_PIVOT_MVP_SPEC.md(§v1 합산기 결정) · docs/legal-review/LEGAL_CONSULTATION_TAX.md.
