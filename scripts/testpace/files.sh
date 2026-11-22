#!/usr/bin/env bash
# testpace `files`: run the given test files (path[:line[:column]], relative to the repo root).
# Files are split by app and handed to `testpace run vitest` in that app. API `*.postgres.test.ts` files get one
# throwaway napbox Postgres for the whole batch, removed when the batch ends.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -eq 0 ]]; then
  echo "usage: scripts/testpace/files.sh <test-file>[:line[:column]]..." >&2
  exit 2
fi

api_files=()
web_files=()
needs_postgres=0

for arg in "$@"; do
  case "$arg" in
    apps/api/*)
      api_files+=("$arg")
      path="${arg%%:*}"
      [[ "$path" == *.postgres.test.ts ]] && needs_postgres=1
      ;;
    apps/web/*) web_files+=("$arg") ;;
    *)
      echo "[files] not a test file of apps/api or apps/web: $arg" >&2
      exit 1
      ;;
  esac
done

temp_env=""
cleanup() {
  if [[ -n "$temp_env" ]]; then
    napbox down --temp "$temp_env" >/dev/null 2>&1 || echo "[files] could not remove napbox temp environment $temp_env" >&2
  fi
}
trap cleanup EXIT

if [[ "$needs_postgres" == "1" ]]; then
  scripts/testpace/require-napbox.sh
  temp_env="files-$(date +%s)-$$"
  napbox up --temp "$temp_env" >/dev/null
  export STARTUPMANAGE_TEST_PSQL="napbox exec postgres --temp $temp_env -- psql -X -q -U startupmanage_app -d startupmanage_local"
fi

status=0
if [[ ${#api_files[@]} -gt 0 ]]; then
  testpace run vitest --cwd apps/api "${api_files[@]}" || status=1
fi
if [[ ${#web_files[@]} -gt 0 ]]; then
  testpace run vitest --cwd apps/web "${web_files[@]}" || status=1
fi
exit "$status"
