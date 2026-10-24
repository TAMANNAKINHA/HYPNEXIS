#!/usr/bin/env bash
# Runs the backend (http://localhost:5000) and the frontend (http://localhost:5173) together. Ctrl+C stops both.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/.env" ] || { echo "Run ./scripts/setup.sh first."; exit 1; }

(cd "$ROOT" && npm run dev) &
BACK=$!
(cd "$ROOT/frontend" && npm run dev) &
FRONT=$!
trap 'kill $BACK $FRONT 2>/dev/null || true' EXIT INT TERM
wait
