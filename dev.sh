#!/usr/bin/env bash
# Start / stop the whole local stack: Hardhat chain -> deploy -> backend -> (frontend).
#   scripts/dev.sh up [--frontend ../HYPNEXIX-FRONTEND-main] [--demo]
#   scripts/dev.sh down | status | logs
# --demo   keep EXECUTION_MODE=demo (no chain-backed payments) instead of real
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"; RUN_DIR=".run"; mkdir -p "$RUN_DIR"
BACKEND_PORT="$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 || true)"; BACKEND_PORT="${BACKEND_PORT:-5000}"

cmd="${1:-status}"; shift || true
FRONTEND=""; DEMO=0
while [ $# -gt 0 ]; do
  case "$1" in
    --frontend) FRONTEND="$2"; shift 2 ;;
    --demo) DEMO=1; shift ;;
    *) echo "unknown option $1"; exit 2 ;;
  esac
done

wait_http() { # url, label, seconds
  for _ in $(seq 1 "${3:-40}"); do curl -s -m 2 -o /dev/null "$1" && { echo "$2 ready"; return 0; }; sleep 1; done
  echo "timed out waiting for $2 ($1)"; return 1
}

case "$cmd" in
  up)
    [ -f .env ] || node scripts/gen-env.cjs
    scripts/chain.sh start
    if [ "$DEMO" -eq 1 ]; then
      NO_ENV_UPDATE=1 npx hardhat run scripts/deploy-local.ts --network localhost
    else
      npx hardhat run scripts/deploy-local.ts --network localhost
    fi
    [ -f dist/server.js ] || npm run build
    if [ -f "$RUN_DIR/backend.pid" ] && kill -0 "$(cat "$RUN_DIR/backend.pid")" 2>/dev/null; then
      echo "backend already running"
    else
      nohup node dist/server.js >"$RUN_DIR/backend.log" 2>&1 & echo $! >"$RUN_DIR/backend.pid"
    fi
    wait_http "http://127.0.0.1:$BACKEND_PORT/api/missions/policies" backend 30
    if [ -n "$FRONTEND" ]; then
      ( cd "$FRONTEND"
        [ -f .env.local ] || cp .env.example .env.local
        if [ -f "$ROOT/$RUN_DIR/frontend.pid" ] && kill -0 "$(cat "$ROOT/$RUN_DIR/frontend.pid")" 2>/dev/null; then echo "frontend already running"
        else nohup npm run dev -- --host 127.0.0.1 >"$ROOT/$RUN_DIR/frontend.log" 2>&1 & echo $! >"$ROOT/$RUN_DIR/frontend.pid"; fi )
      wait_http "http://127.0.0.1:5173" frontend 40
    fi
    echo; scripts/dev.sh status ;;
  down)
    for svc in frontend backend; do
      f="$RUN_DIR/$svc.pid"
      if [ -f "$f" ]; then pid="$(cat "$f")"; pkill -P "$pid" 2>/dev/null || true; kill "$pid" 2>/dev/null || true; rm -f "$f"; echo "$svc stopped"; fi
    done
    scripts/chain.sh stop ;;
  status)
    scripts/chain.sh status || true
    if curl -s -m 2 -o /dev/null "http://127.0.0.1:$BACKEND_PORT/api/missions/policies"; then echo "backend UP :$BACKEND_PORT"; else echo "backend DOWN"; fi
    if curl -s -m 2 -o /dev/null "http://127.0.0.1:5173"; then echo "frontend UP :5173"; else echo "frontend DOWN"; fi ;;
  logs) tail -n 40 "$RUN_DIR"/*.log ;;
  *) echo "usage: $0 up|down|status|logs [--frontend DIR] [--demo]"; exit 2 ;;
esac
