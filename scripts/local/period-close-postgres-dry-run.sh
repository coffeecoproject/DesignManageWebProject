#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

SQL_FILE="$(mktemp "${TMPDIR:-/tmp}/period-close-postgres-dry-run.XXXXXX.sql")"
trap 'rm -f "$SQL_FILE"' EXIT

corepack pnpm --filter @startupmanage/api exec tsc -p tsconfig.test.json
node apps/api/node_modules/.cache/startupmanage-api-contract-tests/finance/periodClosePostgresDryRunCli.js > "$SQL_FILE"

scripts/local/db-psql.sh -v ON_ERROR_STOP=1 < "$SQL_FILE"
