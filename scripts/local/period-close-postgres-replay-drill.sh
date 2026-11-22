#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
source scripts/local/temp-db.sh

SQL_FILE="$(mktemp "${TMPDIR:-/tmp}/period-close-postgres-replay-drill.XXXXXX.sql")"
SCHEMA_NAME="period_close_drill_$(date +%Y%m%d%H%M%S)_replay_$$"
trap 'rm -f "$SQL_FILE"; temp_db_down' EXIT

corepack pnpm --filter @startupmanage/api exec tsc -p tsconfig.test.json
node apps/api/node_modules/.cache/startupmanage-api-contract-tests/finance/periodClosePostgresReplayDrillCli.js "$SCHEMA_NAME" > "$SQL_FILE"

temp_db_up
temp_db_psql -v ON_ERROR_STOP=1 < "$SQL_FILE"
