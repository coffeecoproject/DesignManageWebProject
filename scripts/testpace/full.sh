#!/usr/bin/env bash
# testpace `full`: every non-test check that must pass before landing on main.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# The test suite that follows needs napbox for the Postgres tests: check it first.
scripts/testpace/require-napbox.sh
corepack pnpm -s typecheck
corepack pnpm -s lint
corepack pnpm -s build:web
corepack pnpm -s ai-native:check
