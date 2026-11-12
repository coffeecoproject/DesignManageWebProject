#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

napbox env
napbox exec postgres -- pg_isready -U startupmanage_app -d startupmanage_local
