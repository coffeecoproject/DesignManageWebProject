#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
source scripts/local/temp-db.sh

SQL_DIR="$(mktemp -d "${TMPDIR:-/tmp}/period-close-postgres-concurrency-drill.XXXXXX")"
SCHEMA_NAME="period_close_drill_$(date +%Y%m%d%H%M%S)_$$"
trap 'rm -rf "$SQL_DIR"; temp_db_down' EXIT

corepack pnpm --filter @startupmanage/api exec tsc -p tsconfig.test.json

for section in setup hold-lock contend-lock verify cleanup; do
  node apps/api/node_modules/.cache/startupmanage-api-contract-tests/finance/periodClosePostgresConcurrencyDrillCli.js "$SCHEMA_NAME" "$section" > "$SQL_DIR/$section.sql"
done

temp_db_up
temp_db_psql -v ON_ERROR_STOP=1 < "$SQL_DIR/setup.sql"

temp_db_psql -v ON_ERROR_STOP=1 < "$SQL_DIR/hold-lock.sql" > "$SQL_DIR/holder.out" 2>&1 &
HOLDER_PID=$!

sleep 1

set +e
temp_db_psql -v ON_ERROR_STOP=1 < "$SQL_DIR/contend-lock.sql" > "$SQL_DIR/contender.out" 2>&1
CONTENDER_STATUS=$?
set -e

if [[ "$CONTENDER_STATUS" == "0" ]]; then
  cat "$SQL_DIR/holder.out"
  cat "$SQL_DIR/contender.out"
  echo "period-close concurrency drill expected the contender session to fail on row lock timeout" >&2
  exit 1
fi

wait "$HOLDER_PID"

if ! grep -Eq "canceling statement due to lock timeout|lock timeout" "$SQL_DIR/contender.out"; then
  cat "$SQL_DIR/contender.out"
  echo "period-close concurrency drill contender failed, but not with an expected lock timeout" >&2
  exit 1
fi

cat "$SQL_DIR/holder.out"
cat "$SQL_DIR/contender.out"

temp_db_psql -v ON_ERROR_STOP=1 < "$SQL_DIR/verify.sql"
temp_db_psql -v ON_ERROR_STOP=1 < "$SQL_DIR/cleanup.sql"

echo "period_close_postgres_concurrency_lock_conflict_observed"
