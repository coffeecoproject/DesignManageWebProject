#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# The web dev server listens on this worktree's napbox host port `web`, so worktrees never collide.
# `up` creates the environment the first time; afterwards the port stays the same until `napbox down`.
napbox up >/dev/null
eval "$(napbox env)"

export SMS_WEB_PORT="$NAPBOX_HOST_WEB"
echo "Web: http://${NAPBOX_HOSTNAME}:${NAPBOX_HOST_WEB}"

exec corepack pnpm --filter @startupmanage/web dev "$@"
