#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

SQL_DIR="$(mktemp -d "${TMPDIR:-/tmp}/period-close-postgres-concurrency-drill.XXXXXX")"
SCHEMA_NAME="period_close_drill_$(date +%Y%m%d%H%M%S)_$$"
CLEANED_UP=0

cleanup() {
  if [[ "$CLEANED_UP" == "0" && -f "$SQL_DIR/cleanup.sql" ]]; then
    scripts/local/db-psql.sh -v ON_ERROR_STOP=1 < "$SQL_DIR/cleanup.sql" >/dev/null 2>&1 || true
    CLEANED_UP=1
  fi

  rm -rf "$SQL_DIR"
}

trap cleanup EXIT

corepack pnpm --filter @startupmanage/api exec tsc -p tsconfig.test.json

for section in setup hold-lock contend-lock verify cleanup; do
  node apps/api/node_modules/.cache/startupmanage-api-contract-tests/finance/periodClosePostgresConcurrencyDrillCli.js "$SCHEMA_NAME" "$section" > "$SQL_DIR/$section.sql"
done

scripts/local/db-psql.sh -v ON_ERROR_STOP=1 < "$SQL_DIR/setup.sql"

scripts/local/db-psql.sh -v ON_ERROR_STOP=1 < "$SQL_DIR/hold-lock.sql" > "$SQL_DIR/holder.out" 2>&1 &
HOLDER_PID=$!

sleep 1

set +e
scripts/local/db-psql.sh -v ON_ERROR_STOP=1 < "$SQL_DIR/contend-lock.sql" > "$SQL_DIR/contender.out" 2>&1
CONTENDER_STATUS=$?
set -e

if [[ "$CONTENDER_STATUS" == "0" ]]; then
  cat "$SQL_DIR/holder.out"
  cat "$SQL_DIR/contender.out"
  echo "period-close concurrency drill expected the contender session to fail on row lock timeout" >&2
  exit 1
fi

wait "$HOLDER_PID"

if ! rg -q "canceling statement due to lock timeout|lock timeout" "$SQL_DIR/contender.out"; then
  cat "$SQL_DIR/contender.out"
  echo "period-close concurrency drill contender failed, but not with an expected lock timeout" >&2
  exit 1
fi

cat "$SQL_DIR/holder.out"
cat "$SQL_DIR/contender.out"

scripts/local/db-psql.sh -v ON_ERROR_STOP=1 < "$SQL_DIR/verify.sql"
scripts/local/db-psql.sh -v ON_ERROR_STOP=1 < "$SQL_DIR/cleanup.sql"
CLEANED_UP=1

echo "period_close_postgres_concurrency_lock_conflict_observed"
