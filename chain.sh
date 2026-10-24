#!/usr/bin/env bash
# Start/stop/inspect the local Hardhat blockchain (chainId 1337, port 8545).
# Usage: scripts/chain.sh start|stop|status|restart
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${HARDHAT_HOST:-127.0.0.1}"
PORT="${HARDHAT_PORT:-8545}"
RUN_DIR=".run"; PID_FILE="$RUN_DIR/chain.pid"; LOG_FILE="$RUN_DIR/chain.log"
RPC="http://$HOST:$PORT"
mkdir -p "$RUN_DIR"

rpc_up() {
  curl -s -m 2 -X POST -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$RPC" 2>/dev/null | grep -q '"result"'
}

case "${1:-status}" in
  start)
    if rpc_up; then echo "chain already running at $RPC"; exit 0; fi
    echo "starting Hardhat node on $RPC ..."
    nohup npx hardhat node --hostname "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
    for _ in $(seq 1 60); do
      if rpc_up; then echo "chain ready (pid $(cat "$PID_FILE"), log $LOG_FILE)"; exit 0; fi
      if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then echo "hardhat node exited early:"; tail -n 20 "$LOG_FILE"; exit 1; fi
      sleep 1
    done
    echo "timed out waiting for $RPC"; tail -n 20 "$LOG_FILE"; exit 1 ;;
  stop)
    if [ -f "$PID_FILE" ]; then
      pid="$(cat "$PID_FILE")"
      # npx spawns children; stop the whole group where possible.
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
      rm -f "$PID_FILE"; echo "chain stopped"
    else echo "no pid file; nothing to stop"; fi ;;
  restart) "$0" stop; sleep 1; "$0" start ;;
  status) if rpc_up; then echo "chain UP at $RPC"; else echo "chain DOWN"; exit 1; fi ;;
  *) echo "usage: $0 start|stop|status|restart"; exit 2 ;;
esac
