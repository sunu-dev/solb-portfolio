# 주비 무료 베타 AI 운영 결정안

기준일: 2026-07-17

## 결론

무료 베타는 **초대 사용자 50명, 전체 AI 호출 120회/일, 월 AI 예산 $15, 예산의 95%($14.25)에서 자동 중단**으로 시작한다.

회원별 기본 한도는 다음과 같이 둔다.

| 기능 | 회원 1명당 한도 | 사용 모델 |
|---|---:|---|
| AI 종목 분석 | 3회/일 | Gemini 2.5 Flash |
| AI 촉 새 추천 생성 | 1회/일 | Gemini 2.5 Flash-Lite |
| 보유종목 이미지 인식 | 2회/일 | Gemini 2.5 Flash |

AI 촉의 캐시 조회는 새 모델 호출이 아니므로 호출 한도와 비용 산정에서 제외한다. 사용자 수가 50명을 넘더라도 전체 120회/일 하드캡이 최종 비용을 막는다.

## 실제 로컬 측정값

같은 애플리케이션 코드와 실제 Gemini API를 사용한 단일 표본이다. 기능별 편차를 고려해 운영 중에는 원장의 7일 이동평균과 상위 비용 호출을 함께 본다.

| 기능 | 입력 토큰 | 출력 토큰 | 실측 비용 | 지연시간 |
|---|---:|---:|---:|---:|
| AI 종목 분석 | 4,735 | 822 | $0.00347550 | 5.668초 |
| AI 촉 새 추천 | 2,853 | 359 | $0.00042890 | 3.666초 |
| 이미지 인식 | 1,464 | 78 | $0.00063420 | 2.803초 |

Gemini 2.5 Flash의 공식 유료 표준 단가는 입력 $0.30/백만 토큰, 출력 $2.50/백만 토큰이다. Gemini 2.5 Flash-Lite는 입력 $0.10/백만 토큰인 저비용 모델이다. 가격표 원문은 [Google Gemini API 가격](https://ai.google.dev/gemini-api/docs/pricing)을 기준으로 한다.

## 비용 상한 계산

가장 비싼 현재 표본인 AI 종목 분석만 120회 발생한다고 보수적으로 계산하면:

`$0.00347550 × 120회 × 30일 = 월 $12.5118`

따라서 월 $15 예산의 95%인 $14.25 안에 들어온다. 기능 구성비가 실제처럼 섞이면 비용은 이보다 낮아진다. 모든 회원이 매일 개인 한도를 전부 쓰는 가정은 전체 하드캡이 먼저 차단한다.

## 증설 규칙

아래 조건을 7일 연속 만족할 때만 한 단계를 올린다.

1. 월 예상 비용이 예산의 70% 미만이다.
2. 비용 원장 누락과 사용량 기록 실패가 없다.
3. AI 출력 감사에서 `high` 심각도 미검토 건이 없다.
4. 오류율과 p95 지연시간이 운영자가 정한 허용 범위 안이다.

| 단계 | 초대 사용자 | 전체 호출/일 | 월 예산 | 95% 중단점 |
|---|---:|---:|---:|---:|
| 1차 베타 | 50명 | 120회 | $15 | $14.25 |
| 2차 베타 | 100명 | 240회 | $30 | $28.50 |
| 확장 베타 | 250명 | 500회 | $60 | $57.00 |

확장 베타의 500회/일은 현재 가장 비싼 호출만 발생하면 월 $52.13 수준이다. 모델·프롬프트 변경 후에는 이전 단가를 그대로 사용하지 않고 실측을 다시 한다.

## 모델 선택 결정

- AI 종목 분석과 OCR은 현재 품질을 유지하기 위해 Gemini 2.5 Flash를 유지한다.
- AI 촉은 이미 비용이 낮은 Gemini 2.5 Flash-Lite를 유지한다.
- Claude 자동 폴백은 무료 베타에서 끈다. 공급자 장애 때 고가 모델로 무제한 우회하는 비용 위험을 없애기 위해서다.
- 사용자 개인 API 키 방식은 1차 베타의 기본 경로로 쓰지 않는다. 설정 난이도, 키 보관 책임, 고객지원 복잡도가 사용자 증가 효과보다 크다.
- Google 무료 티어는 입력 데이터가 제품 개선에 사용될 수 있다고 가격표에 명시되어 있으므로, 실제 사용자 포트폴리오 이미지와 개인화 입력은 유료 티어 및 해당 계정의 데이터 처리 조건을 확인한 뒤 운영한다.

Claude는 복잡한 검토용 선택지로 남기되 실시간 사용자 응답의 기본 모델로 사용하지 않는다. Claude API는 별도 선불 사용 크레딧이 필요하며 Claude.ai 개인 구독과 API 사용료는 분리된다. 근거는 [Anthropic API 결제 안내](https://support.anthropic.com/en/articles/8977456-how-do-i-pay-for-my-api-usage)와 [구독·API 분리 안내](https://support.anthropic.com/en/articles/9876003-i-subscribe-to-a-paid-claude-ai-plan-why-do-i-have-to-pay-separately-for-api-usage-on-console)다.

## DeepSeek·Qwen 후보 재검토

공식 가격표와 주비의 AI 종목 분석 실측 토큰(입력 4,735·출력 822)을 기준으로 비교했다.

| 후보 | 공식 단가 입력/출력, 1M 토큰 | 같은 토큰 사용 시 1회 예상 | 120회/일·30일 최악 상한 |
|---|---:|---:|---:|
| Gemini 2.5 Flash | $0.30 / $2.50 | $0.00347550 | $12.5118 |
| DeepSeek V4 Flash | $0.14 / $0.28 | $0.00089306 | $3.2150 |
| Qwen Flash 글로벌 128K 이하 구간 | $0.022 / $0.216 | $0.00028172 | $1.0142 |

- DeepSeek V4 Flash의 모델명, 1M 컨텍스트, 가격은 [DeepSeek 공식 가격표](https://api-docs.deepseek.com/quick_start/pricing/)에서 확인했다.
- Qwen은 모델·배포 지역·입력 길이에 따라 가격이 크게 달라진다. 위 표는 `qwen-flash` 글로벌 128K 이하 구간이며, 최신 `qwen3.6-flash` 가격과 동일하지 않다. [Alibaba Cloud 공식 가격표](https://www.alibabacloud.com/help/en/model-studio/model-pricing)를 호출 시점마다 다시 확인한다.
- GLM Flash의 입력·출력 각 $0.05 주장은 공식 국제 가격과 일치하지 않았다. 공식 가격표상 `GLM-4.7-FlashX`는 입력 $0.07·출력 $0.40이며 무료 Flash 모델은 별도의 제한·운영 안정성 검증이 필요하다. [Z.AI 공식 가격표](https://docs.z.ai/guides/overview/pricing)
- Doubao는 공식 문서에서 동일 조건의 달러 단가를 재확인하지 못했으므로 현재 후보 결정에서 제외한다.

### 결정

1. 1차 무료 베타의 기본 모델은 기존 Gemini 구성을 유지한다.
2. DeepSeek V4 Flash를 **AI 종목 분석 전용 비공개 A/B 1순위**로 둔다.
3. Qwen Flash는 DeepSeek의 한국어·JSON·금융 수치 품질이 기준을 못 넘을 때 2순위로 시험한다.
4. AI 촉은 현재 Gemini Flash-Lite 실측 비용이 DeepSeek 예상 비용보다 낮으므로 교체하지 않는다.
5. OCR은 이미지 인식 품질이 검증된 Gemini를 유지한다.
6. 실제 사용자 포트폴리오를 후보 공급자에 보내기 전 개인정보 처리, 보관, 학습 제외, 국외이전 고지와 변호사 의견을 확인한다.

A/B는 동일한 익명·합성 입력 50건으로 JSON 스키마 성공률, 한국어 자연스러움, 공개 수치 일치율, 금지표현 발생률, 평균·p95 지연시간, 호출 실패율을 비교한다. 품질 기준을 통과하기 전에는 실제 사용자 트래픽을 분기하지 않는다.

### Vercel AI Gateway 판단

Gateway는 DeepSeek·Alibaba·Google을 단일 API로 비교하고 비용·실패 경로를 관측하기에 유리하다. 공식 문서상 토큰 가격에 추가 마진이 없고 월 $5 무료 크레딧이 있으므로 합성 50건 A/B에는 적합하다. [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), [가격](https://examples.vercel.com/docs/ai-gateway/pricing)

다만 실제 포트폴리오 입력에는 다음 게이트를 둔다.

- 무료 플랜에서도 요청별 `disallowPromptTraining`은 사용할 수 있다.
- 요청별·팀 전체 Zero Data Retention은 Pro 또는 Enterprise에서만 제공된다. [Vercel ZDR 안내](https://vercel.com/changelog/zero-data-retention-no-prompt-training-on-ai-gateway)
- 따라서 Hobby 상태에서는 Gateway를 **합성·공개 데이터 A/B 전용**으로만 검토한다.
- 실제 사용자 개인화 입력을 Gateway로 보내는 전환은 Vercel Pro, ZDR 적용 확인, 공급자 허용목록 고정, 개인정보 문서·변호사 검토 후 별도 승인한다.
- Gateway 도입 후에도 주비 자체 비용 원장과 월 예산 하드캡은 제거하지 않는다. 공급자 대시보드는 보조 증거이고 애플리케이션의 선제 차단은 주비 서버가 담당한다.

## 운영 환경에 넣을 값

운영 적용 전 사용자 승인을 받아 다음 값을 Vercel 환경변수로 설정한다.

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

`AI_AUDIT_SAMPLE_RATE=1`은 베타 초기 전수 기록을 뜻한다. 감사 데이터에는 프롬프트 원문, 사용자 식별자, 평단, 보유수량, 목표수익률, 손절값, 사용자 메모를 저장하거나 내보내지 않는다.

## 매주 확인할 숫자

- 이번 달 누적 비용, 30일 예상 비용, 예산 사용률
- 기능·모델별 평균 비용과 최고 비용 호출
- 비용 기록 실패, 사용량 기록 실패, 회로 차단 발생 수
- 전체 일일 하드캡 도달 횟수와 사용자별 한도 도달률
- AI 출력 감사 표본 수, `review`/`high` 건수, 미검토 건수
- 캐시 적중으로 절감된 AI 촉 호출 수
