#!/usr/bin/env bash
# Full reproducible end-to-end run on a throwaway chain:
#   build -> start chain -> deploy -> run payment unit tests + e2e -> stop chain
# Usage: scripts/e2e.sh [--keep-chain]
set -euo pipefail
cd "$(dirname "$0")/.."
KEEP=0; [ "${1:-}" = "--keep-chain" ] && KEEP=1

started_here=0
cleanup() { if [ "$started_here" -eq 1 ] && [ "$KEEP" -eq 0 ]; then scripts/chain.sh stop || true; fi; }
trap cleanup EXIT

echo "== build"; npm run build --silent
echo "== compile contracts"; npx hardhat compile
if scripts/chain.sh status >/dev/null 2>&1; then
  echo "== chain already running; deploying a fresh set of contracts onto it"
else
  scripts/chain.sh start; started_here=1
fi
echo "== deploy (does not touch .env)"
NO_ENV_UPDATE=1 npx hardhat run scripts/deploy-local.ts --network localhost
echo "== payment-service tests"
node --test --test-force-exit test/paymentLifecycle.test.cjs
echo "== end-to-end tests"
node --test --test-force-exit test/e2e/e2e.test.cjs
echo "== ALL E2E CHECKS PASSED"
