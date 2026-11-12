#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# Runs psql inside the Postgres service; stdin is forwarded, there is no interactive terminal.
napbox exec postgres -- psql -U startupmanage_app -d startupmanage_local "$@"
