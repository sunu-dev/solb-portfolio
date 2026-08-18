#!/bin/zsh
set -euo pipefail

cd "${0:A:h}"

if ! supabase status >/dev/null 2>&1; then
  echo "로컬 Supabase가 실행 중이 아니에요. 먼저 'supabase start'를 실행해주세요."
  exit 1
fi

set -a
source .env.local
set +a

# Supabase CLI가 출력하는 로컬 개발 전용 값만 현재 프로세스에 주입한다.
eval "$(supabase status -o env 2>/dev/null)"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

export AI_MONTHLY_BUDGET_USD="${AI_MONTHLY_BUDGET_USD:-1}"
export AI_MONTHLY_BUDGET_STOP_RATIO="${AI_MONTHLY_BUDGET_STOP_RATIO:-0.95}"
export AI_AUDIT_SAMPLE_RATE="${AI_AUDIT_SAMPLE_RATE:-1}"
export AI_AUDIT_TARGET_PER_FEATURE="${AI_AUDIT_TARGET_PER_FEATURE:-100}"
export AI_DAILY_LIMIT_TOTAL="${AI_DAILY_LIMIT_TOTAL:-250}"
export ANALYSIS_DAILY_FREE="${ANALYSIS_DAILY_FREE:-3}"
export CHOK_DAILY_FREE="${CHOK_DAILY_FREE:-1}"
export OCR_DAILY_LIMIT_USER="${OCR_DAILY_LIMIT_USER:-5}"
export ENABLE_CLAUDE_FALLBACK="false"

if [[ "${BACKGROUND:-0}" == "1" ]]; then
  nohup npm run dev -- -p "${PORT:-3002}" </dev/null >"${LOG_FILE:-/tmp/joobi-local.log}" 2>&1 &
  echo "로컬 검토 서버를 백그라운드에서 시작했어요: http://localhost:${PORT:-3002}"
  exit 0
fi

exec npm run dev -- -p "${PORT:-3002}"
