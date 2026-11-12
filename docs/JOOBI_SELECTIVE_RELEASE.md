# 주비 선별 배포 절차 (2026-11-12 기준)

main에는 운영에 내보내지 않기로 한 작업(보호 보관·패스키, 종목 상세 개편, 산업 그림, 로딩 시안, 수집 도구)이 함께 있다. 그래서 운영은 **main 전체가 아니라 릴리스 브랜치**로 배포한다. 2026-11-12 채팅 배포 두 번을 이 절차로 했다.

## 먼저 알아둘 것

- **`git push origin main` = 운영 배포.** Vercel 프로젝트 `solb-portfolio`가 GitHub `sunu-dev/solb-portfolio`에 연결돼 있고 운영 브랜치가 `main`, 빌드 생략 설정이 없다(2026-11-12 Vercel API로 확인). main을 올리면 main HEAD 전체가 joobi.kr에 자동 배포된다. 사용자가 main 전체 배포를 명시하지 않는 한 origin/main에 올리지 않는다.
- 다른 이름의 브랜치 push(`release/...`, `backup/...`)는 미리보기 배포만 만든다(Vercel 로그인으로 보호, joobi.kr과 무관).
- 이 컴퓨터의 GitHub 기본 계정은 `swhan-cubox-ai`라서 이 저장소에 쓰기 권한이 없다(403). push는 `sunu-dev` 계정으로 해야 한다: `gh auth switch --user sunu-dev` → push → 필요하면 `gh auth switch --user swhan-cubox-ai`.
- 운영 Vercel 배포는 CLI(`vercel`, 로그인 계정 sunudevelop-1252)로 한다.

## 기준점

| 이름 | 커밋 | 뜻 |
|---|---|---|
| 운영 소스 기준 | `ea1fdc3` | 채팅 선별 배포 전 운영 소스 |
| 채팅 작업 시작점 | `a9fdb82` | main에서 채팅 작업을 시작한 지점. 이때 채팅 파일은 `ea1fdc3`과 같았다 |
| 릴리스 브랜치 | `release/chat-natural-20261112` | `ea1fdc3` + 옮겨도 되는 파일만. 2026-11-12 현재 `b49f711` |

옮겨도 되는 파일 = `a9fdb82..main`에서 바뀐 파일 중 **`ea1fdc3`과 `a9fdb82`가 같은 파일**(또는 새 파일). 둘이 다르면 그 파일에는 운영에 없는 작업이 섞여 있으므로 손으로 필요한 줄만 옮긴다. 지금까지 그런 파일은 `src/app/page.tsx`, `src/components/analysis/AnalysisPanel.tsx`(React key 한 줄씩)뿐이었다.

## 1. 릴리스 워크트리 만들고 main 변경 얹기

```zsh
#!/bin/zsh
# 사용: zsh release-sync.zsh <릴리스 워크트리 경로> <옮길 main 커밋>
set -e
M=$(git rev-parse --show-toplevel); R="$1"; SHA="$2"; LIST="$R.files.txt"
[ -d "$R" ] || git -C "$M" worktree add "$R" release/chat-natural-20261112
git -C "$M" diff --name-only a9fdb82.."$SHA" -- src public scripts sources package.json package-lock.json next.config.ts vercel.json tsconfig.json vitest.config.ts eslint.config.mjs .vercelignore \
  | grep -v -E '^src/app/page.tsx$|^src/components/analysis/AnalysisPanel.tsx$' > "$LIST"
while read f; do
  if git -C "$M" cat-file -e ea1fdc3:"$f" 2>/dev/null; then
    git -C "$M" diff --quiet ea1fdc3 a9fdb82 -- "$f" || { echo "손으로 옮길 파일(운영과 다름): $f"; exit 2; }
  else
    git -C "$M" cat-file -e a9fdb82:"$f" 2>/dev/null && { echo "손으로 옮길 파일(미배포 작업 위에서 생김): $f"; exit 2; }
  fi
done < "$LIST"
cd "$R" && xargs git checkout -q "$SHA" -- < "$LIST" && git add -A
echo "운영 기준과 다른 파일: $(git diff --cached --name-only ea1fdc3 | wc -l | tr -d ' ')개"
```

`page.tsx`·`AnalysisPanel.tsx`가 `a9fdb82` 이후 main에서 또 바뀌었다면 `git diff a9fdb82..<SHA> -- <파일>`을 보고 필요한 부분만 운영 판에 옮긴다.

## 2. 릴리스 워크트리에서 검사

```zsh
cd <릴리스 워크트리>
ln -s <main 저장소>/node_modules node_modules; ln -s <main 저장소>/.env.local .env.local
npx tsc --noEmit
npm run lint:ui && npm run lint:alerts && npm run lint:korean && npm run lint:darkmode && npm run lint:tour-anchors
npx vitest run --maxWorkers=2
npx next build --webpack      # symlink한 node_modules에서는 webpack 빌드로 확인했다
git commit -m "release: ..."
rm -f node_modules .env.local && rm -rf .next   # 올리기 전에 반드시 지운다
cp -R <main 저장소>/.vercel .vercel              # 프로젝트 연결 정보(무시 파일)
```

## 3. 단계 배포 → 확인 → 운영 전환

```zsh
vercel deploy --prod --skip-domain --yes          # 운영 설정으로 빌드하지만 joobi.kr에는 아직 연결 안 함
vercel curl / --deployment <배포 주소> -- --silent -o /dev/null -w '%{http_code}\n'      # 200
vercel curl /api/ai-analysis --deployment <배포 주소> -- --silent --request POST \
  --header 'Content-Type: application/json' \
  --data '{"questionId":"ask-joobi","questionConsent":true,"questionText":"오늘 시장 어때요?","symbol":"GENERAL"}'   # 401 unauthorized
vercel promote <배포 주소> --yes                  # joobi.kr 전환
curl -s -o /dev/null -w '%{http_code}\n' https://joobi.kr/   # 200
```

원격 빌드도 테스트를 다시 돈다(prebuild). 전환 뒤 Vercel 런타임 로그(1시간 보관)에서 `/api/ai-analysis` 오류와 `[joobi-validation]`·`[joobi-step-timing]`을 본다.

## 되돌리기

- 직전 채팅 배포: `dpl_78AHcGj7TGmF8EbHiVDG9GuQ8WTW`
- 채팅 선별 배포 전 운영: `dpl_6dXQvQjjyr2vvyip7LEJFRicb7fa`
- `vercel promote <배포 ID 또는 주소> --yes`로 되돌린다.

## 배포 이력

| 날짜 | 배포 | 릴리스 커밋 | main 커밋 | 내용 |
|---|---|---|---|---|
| 2026-11-12 | `dpl_78AHcGj7TGmF8EbHiVDG9GuQ8WTW` | `1a2bba8` | `9da461b` | 채팅 자연스러움·첫 답 지연·기사 없는 답·검증 재작성·검토 수정 |
| 2026-11-12 | `dpl_9WScYHWe5kb8PoftT6NP6xjZttLQ` | `b49f711` | `a14d59f` | 실존 인물 보도 기준 추가(현재 운영) |

과정과 판단 근거: `sessionary/2026-11-12-chat-release.md`.
