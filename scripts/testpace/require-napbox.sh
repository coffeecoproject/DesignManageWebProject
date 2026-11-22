#!/usr/bin/env bash
# Fails fast when the napbox daemon that runs the throwaway test Postgres is not available.
set -euo pipefail

if ! command -v napbox >/dev/null 2>&1; then
  echo "[napbox] napbox is not on PATH: Postgres tests need it (install the napbox plugin, then run its setup)" >&2
  exit 1
fi
if ! napbox status >/dev/null 2>&1; then
  echo "[napbox] napboxd is not running: run 'napbox setup' (or the napbox MCP setup tool) and retry" >&2
  exit 1
fi
