#!/usr/bin/env bash
# Pre-demo health check. Exit code 0 only if everything the demo needs is in place.
cd "$(dirname "$0")/.."
fail=0
ok()  { echo "  [ok]   $*"; }
bad() { echo "  [FAIL] $*"; fail=1; }
warn(){ echo "  [warn] $*"; }

echo "Tooling"
node -v | grep -qE '^v(2[0-9]|[3-9][0-9])' && ok "node $(node -v)" || bad "Node >= 20 required"
[ -d node_modules ] && ok "dependencies installed" || bad "run scripts/setup.sh"

echo "Configuration (.env)"
if [ -f .env ]; then
  ok ".env present"
  for k in READER OPERATOR APPROVER EXECUTOR ADMIN; do
    v="$(grep -E "^PAYMENT_${k}_TOKEN=" .env | cut -d= -f2-)"
    if [ "${#v}" -lt 32 ] || [[ "$v" == replace-with-* ]]; then bad "PAYMENT_${k}_TOKEN is a placeholder/too short (backend will answer 401) - run: node scripts/gen-env.cjs"; fi
  done
  mode="$(grep -E '^EXECUTION_MODE=' .env | cut -d= -f2-)"; echo "  mode: ${mode:-demo}"
  if [ "$mode" = "real" ]; then
    for k in RPC_URL CHAIN_ID CONTRACT_ADDRESS CONTRACT_ABI PRIVATE_KEY RECIPIENT_ALLOWLIST MISSION_RECIPIENTS_JSON; do
      [ -n "$(grep -E "^$k=" .env | cut -d= -f2-)" ] || bad "$k is empty but EXECUTION_MODE=real"
    done
  fi
else bad ".env missing - run scripts/setup.sh"; fi

echo "Build artifacts"
[ -f dist/server.js ] && ok "dist/server.js built" || bad "run npm run build"
[ -d artifacts/contracts ] && ok "contracts compiled" || bad "run npx hardhat compile"

echo "Services"
scripts/chain.sh status >/dev/null 2>&1 && ok "local chain up" || warn "local chain down (needed for real mode)"
PORT="$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2)"; PORT="${PORT:-5000}"
curl -s -m 3 -o /dev/null "http://127.0.0.1:$PORT/api/missions/policies" && ok "backend answering on :$PORT" || warn "backend not running"
code="$(curl -s -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/payments")"
[ "$code" = "401" ] && ok "payments API enforces auth (401 without token)" || warn "payments API returned $code without a token (expected 401)"
if [ -f deployments/localhost.json ] && scripts/chain.sh status >/dev/null 2>&1; then
  addr="$(node -p "require('./deployments/localhost.json').gateway")"
  res="$(curl -s -m 3 -X POST -H 'Content-Type: application/json' --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$addr\",\"latest\"],\"id\":1}" "$(node -p "require('./deployments/localhost.json').rpcUrl")")"
  echo "$res" | grep -q '"result":"0x"' && bad "gateway $addr has no code (chain restarted? re-run deploy)" || ok "gateway contract has code on chain"
fi
exit $fail
