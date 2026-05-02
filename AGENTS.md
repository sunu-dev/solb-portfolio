<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Session Management Protocol

이 프로젝트는 세션 관리 방법론을 따른다. 매 세션 시작 시 이 프로토콜을 인지하고 행동한다.

### 구조

- **메모리 (영구)**: auto-memory 시스템 — `~/.claude/projects/.../memory/` 의 분류된 파일들 (user_profile, feedback_*, project_*, reference_*). 분류 체계 보존, 단일 파일 평탄화 금지
- **세셔너리 (휘발성)**: `./sessionary/` 디렉토리의 `YYYY-MM-DD-{topic}.md` 파일 — 세션별 작업 로그
- **TODO 누적**: `./sessionary/TODO.md` — 세션 간 미해결 항목
- **아카이브**: `./sessionary/archive/YYYY-MM/` — 월말에 옛 세셔너리 이동
- **비밀정보**: `./.claude/secrets.local.md` — gitignore 처리, 메모리·세셔너리에 절대 기록 금지

### 세션 시작 시 (자동)

`.claude/settings.json`의 SessionStart hook이 다음을 자동으로 로드한다:
- `sessionary/` 디렉토리의 가장 최근 파일 1개 (파일명 역순 기준, archive 제외)
- TODO 누적 파일

이 정보를 바탕으로 직전 작업 컨텍스트를 이해하고 작업을 이어간다.

### 세션 종료 시 또는 사용자가 "정리해줘" 요청 시

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
(이 항목들은 TODO 누적 파일에도 반영한다)

## 다음 세션 진입점
어디서부터 시작하면 되는가
```

작성 후 TODO 누적 파일에 미해결 항목을 반영한다. 완료된 항목은 TODO에서 제거한다.

**파일명 규칙**: 반드시 `YYYY-MM-DD-` 날짜 prefix로 시작한다. 자동 로드 hook이 파일명 역순 정렬로 최신 파일을 찾기 때문이다. prefix가 없으면 정렬에서 누락된다.

### 승급 규칙 (세셔너리 → 메모리)

다음 조건을 만족하면 해당 내용을 auto-memory의 적절한 분류 파일로 이동한다:
- 동일한 도메인 지식이 3회 이상 참조됨
- "이건 항상 그래"라고 판단되는 컨벤션
- 외부 시스템과의 인터페이스 규약
- 사용자가 명시적으로 "메모리에 넣어줘"라고 지시

승급 후 기존 세셔너리에서는 해당 내용을 제거하거나 "메모리로 이동됨" 표시를 남긴다. 중복 금지.

**기존 메모리 시스템 보존**: auto-memory의 분류 체계(user/feedback/project/reference)를 따른다. 단일 파일로 평탄화하지 않는다.

### 아카이빙 규칙

매월 말 또는 사용자가 "아카이빙해줘" 요청 시:
- `sessionary/` 안의 일자별 파일들을 `sessionary/archive/YYYY-MM/`로 이동 (TODO 파일은 제외)
- 이동 시점에 의미 있는 내용은 메모리 승급 검토
- archive 디렉토리는 자동 로드 대상에서 제외됨

### 작성 시 주의

- 비밀정보(DB 접속, API 키 등)를 세셔너리나 메모리 파일에 기록하지 않는다
- 세셔너리는 미래의 자신(다음 세션 Claude)이 읽을 것을 가정하고 작성한다
- 결정의 이유를 반드시 남긴다. 무엇을 했는지보다 왜 그렇게 했는지가 더 중요하다
