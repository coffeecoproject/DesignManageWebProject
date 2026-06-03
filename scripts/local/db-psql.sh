#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

POSTGRES_DB="${SMS_POSTGRES_DB:-startupmanage_local}"
POSTGRES_USER="${SMS_POSTGRES_USER:-startupmanage_app}"

docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
