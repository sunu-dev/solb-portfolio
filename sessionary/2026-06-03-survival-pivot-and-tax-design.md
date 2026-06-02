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
- **법률 질문지**(`7a1a3b2`): `docs/LEGAL_CONSULTATION_TAX.md` — 세무사 9문 + 변호사 6문 + 면책 4축 + 결정표. 배포 게이트.
- 메모리 승급 4건: project_survival_pivot(신규)·project_tax_pivot(신규)·MEMORY.md 인덱스(+market_strategy 캐비엇)·feedback_panel_audit_methodology(StructuredOutput 교훈).

## 미해결 TODO

### 🔴 세무 피봇 진입 게이트 (파운더 액션)
- [ ] **세무사 자문** — docs/LEGAL_CONSULTATION_TAX.md A섹션 9문(환율 기준일·lot 취득가·환차손익·필요경비·과세대상 판정 주체·추정치 라벨 오차).
- [ ] **변호사 자문** — B섹션 6문(§20③ 네이밍·§2 상담/서류작성·OCR=직접입력 동치·약관규제법 §7·§101 단일 PRO 묶음).
- [ ] **파운더 결정 4건** — ①입력경로(OCR vs 수기) ②sold→sell 일원화 ③FX USD-only vs 다통화 ④공식 매매기준율 데이터 소스(서울외국환중개 라이선스).

### 🟢 자문 후 구현 (Phase 1, ~4주)
- [ ] W1-2: taxRates.ts SSOT(verified만)·transactions/fx_rates 마이그·TAX_FORBIDDEN_PHRASES lint·약관 v5
- [ ] W3-4: toKrwAtSettle·무료 통합 미리보기·what-if 매도·250만 공제 현황판·손익통산(과세대상 게이트)·투자탭 위젯·OCR 정산내역
- [ ] Phase 2: fx 적재 cron·PRO 리포트 다운로드·토스페이먼츠 빌링키·정산내역 파서

### 🟡 digest 잔여 (별개)
- [ ] 플래그 on 단계: DIGEST_CLOSE_SLOT_ENABLED → (변호사 후) DIGEST_RAG_EXPLANATION
- [ ] 아침 브리핑 ①②(미장 우선·면책 문구) 되돌리기 여부

## 다음 세션 진입점

**상태**: 세무 피봇 **설계·법률 질문지 완료**. 코드 변경 0(세무는 게이트 전 미구현). digest P0는 배포됨(플래그 off).
**우선순위**: 파운더가 세무사·변호사 자문 + 4 결정 가져오면 → Phase 1 W1-2(안전 골격: taxRates SSOT·스키마·lint·약관 v5)부터. 자문 전이라도 **calc 정확성 노출 없는 골격**은 선행 가능.
**참고**: [[project_survival_pivot]] · [[project_tax_pivot]] · docs/TAX_PIVOT_MVP_SPEC.md · docs/LEGAL_CONSULTATION_TAX.md.
