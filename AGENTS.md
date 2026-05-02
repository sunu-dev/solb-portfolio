<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Session Management Protocol (v3)

이 프로젝트는 세션 관리 방법론 v3를 따른다. 매 세션 시작 시 이 프로토콜을 인지하고 행동한다.

### 구조

- **메모리 (영구)**: auto-memory 시스템 — `~/.claude/projects/.../memory/` 의 분류된 파일들 (user_profile, feedback_*, project_*, reference_*). 분류 체계 보존, 단일 파일 평탄화 금지
- **세셔너리 (휘발성)**: `./sessionary/` 디렉토리의 `YYYY-MM-DD-{topic}.md` 파일 — 세션별 작업 로그
- **TODO 누적**: `./sessionary/TODO.md` — 세션 간 미해결 항목
- **아카이브**: `./sessionary/archive/YYYY-MM/` — 월말에 옛 세셔너리 이동
- **비밀정보**: `./.claude/secrets.local.md` — gitignore 처리, 메모리·세셔너리에 절대 기록 금지

### 정보 분담 원칙

| 정보 종류 | 들어갈 곳 | 예시 |
|---|---|---|
| 영속적 사실, 결정의 결과물, 마일스톤 | **메모리** (auto-memory) | "API 엔드포인트 `/users/me` 추가됨", "DB 스키마 v2 확정" |
| 시간순 작업 흐름, 시도와 결과 | **세셔너리** | "X 기능 만들기 위해 A 접근 시도 → 실패 → B로 전환 → 성공" |
| 미완료 작업, 다음 세션 진입점 | **TODO** | "[ ] auth 미들웨어 리팩토링 (B 접근 적용)" |

같은 작업이 양쪽에 걸치면 **흐름은 세셔너리에 / 결과 사실은 메모리에** — 중복 기록하지 않는다. auto-memory 분류 체계(user/feedback/project/reference)를 따른다.

### 세션 시작 시 (자동)

`.claude/settings.json`의 SessionStart hook이 다음을 자동으로 로드한다:
- `sessionary/` 디렉토리의 가장 최근 파일 1개 (파일명 역순 기준, archive 및 TODO.md 제외)
- TODO 누적 파일

**자동 브리핑 의무**: hook으로 로드된 내용을 읽은 직후, 사용자가 아무 질문도 안 했어도 **자발적으로** 다음을 보고한다:

1. **직전 세션 한 줄 요약** — sessionary 최신 파일에서 추출
2. **다음에 할 일 1건** — TODO.md의 가장 우선순위 항목 (대기 > 진행 중 > 차단)
3. **확인 질문** — "이거부터 시작할까요? 아니면 다른 일이 있으세요?"

이 브리핑은 사용자 첫 입력이 아무리 짧거나 무관한 내용이어도 (예: "ㅇㅇ", "안녕") 첫 응답에 반드시 포함한다. 사용자가 명시적으로 "브리핑 스킵"이라 말하기 전까지 매 세션 시작 시 발화한다.

### 세션 종료 시 또는 사용자가 "정리해줘" 요청 시 (4단계)

**1단계: 세셔너리 작성**

`sessionary/` 디렉토리에 `YYYY-MM-DD-{topic}.md` 형식 파일로 다음 구조로 작성한다:

```
# YYYY-MM-DD - {주제}

## 작업 요약
무엇을 했는가

## 결정사항
왜 그렇게 했는가

## 미해결 TODO
- [ ] 다음에 이어갈 항목 1
- [ ] 다음에 이어갈 항목 2

## 다음 세션 진입점
어디서부터 시작하면 되는가
```

**파일명 규칙**: 반드시 `YYYY-MM-DD-` 날짜 prefix로 시작한다. 자동 로드 hook이 파일명 역순 정렬로 최신 파일을 찾기 때문이다.

**길이 가이드**: 한 파일이 약 300줄을 넘으면 토픽을 분리한다 (같은 날이라도 다른 큰 주제는 별도 파일). hook 출력 비대화로 토큰 낭비 방지.

**2단계: TODO 동기화**

- 세션 내 task 도구(TaskCreate 등)의 미완료 항목을 `sessionary/TODO.md`로 흡수 (in-session task는 세션 종료 시 휘발됨)
- 완료된 TODO 항목은 TODO 파일에서 제거
- 새로 생긴 미해결 항목을 TODO에 추가

**3단계: 메모리 승급 자문**

자문한다: **"이번 세션에서 다룬 내용 중 메모리로 승급할 만한 영속적 사실이나 룰이 있는가?"**

후보가 있으면 사용자에게 명시적으로 제안한다. 예: "오늘 결정한 X 컨벤션을 메모리에 추가할까요?" 사용자가 동의하면 4단계로 진행, 아니면 세션 정리 종료.

**4단계: 메모리 승급 (해당 시)**

승급 절차:
1. auto-memory의 적절한 분류 파일로 추가 (user/feedback/project/reference)
2. 기존 세셔너리에서 해당 부분 제거 또는 "메모리로 이동됨" 표시
3. 두 곳에 중복되면 정합성이 깨지므로 한 쪽만 남긴다

### 승급 트리거 (능동)

자동 카운트("3회 참조") 룰은 **가이드일 뿐**, 실제 운영 메커니즘은 **능동 자문**:
- 매 세셔너리 작성 시 3단계에서 자문 (주된 트리거)
- 사용자 명시 요청 ("메모리에 넣어줘")
- 같은 도메인 지식을 여러 세션에서 다시 설명하게 됐을 때

### 아카이빙 규칙

매월 말 또는 사용자가 "아카이빙해줘" 요청 시:
- `sessionary/` 안의 일자별 파일들을 `sessionary/archive/YYYY-MM/`로 이동 (TODO 파일은 제외)
- 이동 시점에 의미 있는 내용은 메모리 승급 검토
- archive 디렉토리는 자동 로드 대상에서 제외됨

### 작성 시 주의

- 비밀정보(DB 접속, API 키 등)를 세셔너리·메모리에 기록하지 않는다
- 세셔너리는 미래의 자신(다음 세션 Claude)이 읽을 것을 가정해 작성한다
- 결정의 이유를 반드시 남긴다. 무엇을 했는지보다 왜 그렇게 했는지가 더 중요하다
- **동시 세션 충돌 주의**: 같은 머신에서 두 터미널로 같은 일자 작업 시 같은 파일 동시 쓰기 회피. 동시 운영 잦으면 파일명에 시간/세션 prefix 추가 변형 필요
