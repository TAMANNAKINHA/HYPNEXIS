#!/usr/bin/env bash
# One-command first-time setup for a clean checkout.
#   scripts/setup.sh [--frontend ../HYPNEXIX-FRONTEND-main] [--skip-install]
set -euo pipefail
cd "$(dirname "$0")/.."

FRONTEND=""; SKIP_INSTALL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --frontend) FRONTEND="$2"; shift 2 ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    *) echo "unknown option $1"; exit 2 ;;
  esac
done

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing required tool: $1"; exit 1; }; }
need node; need npm; need curl
major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$major" -ge 20 ] || { echo "Node >= 20 required (found $(node -v))"; exit 1; }
echo "node $(node -v), npm $(npm -v)"

if [ "$SKIP_INSTALL" -eq 0 ]; then
  echo "== installing backend dependencies"
  if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
fi

echo "== creating .env with generated payment tokens"
node scripts/gen-env.cjs

echo "== compiling contracts"
npx hardhat compile

echo "== building backend (tsc)"
npm run build

if [ -n "$FRONTEND" ]; then
  [ -d "$FRONTEND" ] || { echo "frontend dir not found: $FRONTEND"; exit 1; }
  echo "== frontend ($FRONTEND)"
  ( cd "$FRONTEND"
    [ -f .env.local ] || { cp .env.example .env.local; echo "created .env.local"; }
    if [ "$SKIP_INSTALL" -eq 0 ]; then if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi; fi
    npm run typecheck && npm run build )
fi

echo
echo "Setup complete. Next: scripts/dev.sh up   (chain + deploy + backend [+ frontend])"
