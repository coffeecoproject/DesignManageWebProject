#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

napbox logs postgres --tail "${SMS_POSTGRES_LOG_TAIL:-120}"
