#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# Puts the environment to sleep and returns its memory; data is kept and the next connection wakes it.
napbox sleep
