#!/usr/bin/env bash
# One-time local setup: installs both apps and writes their .env files.
# Safe to re-run: it never overwrites an .env that already exists.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

command -v node >/dev/null || { echo "Node.js >= 20 is required."; exit 1; }
command -v openssl >/dev/null || { echo "openssl is required to generate tokens."; exit 1; }

if [ ! -f "$ROOT/.env" ]; then
  tok() { openssl rand -hex 32; }
  ADMIN="$(tok)"
  cat > "$ROOT/.env" <<ENV
PORT=5000
FRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173
RATE_LIMIT_MAX=1000

PAYMENT_READER_TOKEN=$(tok)
PAYMENT_OPERATOR_TOKEN=$(tok)
PAYMENT_APPROVER_TOKEN=$(tok)
PAYMENT_EXECUTOR_TOKEN=$(tok)
PAYMENT_ADMIN_TOKEN=$ADMIN
READER_ACTOR=payment-reader
OPERATOR_ACTOR=payment-operator
APPROVER_ACTOR=payment-approver
EXECUTOR_ACTOR=payment-executor
ADMIN_ACTOR=payment-admin
PAYMENT_DB_PATH=./data/payments.json

# Real chain submission is not implemented; keep demo mode.
EXECUTION_MODE=demo
USE_REAL_CONTRACT=false
RPC_URL=
CHAIN_ID=1337
CONTRACT_ADDRESS=
PAYMENT_DECIMALS=18
CONFIRMATIONS=1
ENV
  chmod 600 "$ROOT/.env"
  echo "Wrote .env (backend). Admin token for the Payments tab:"
  echo "  $ADMIN"
else
  echo ".env already exists - left unchanged."
fi

if [ ! -f "$ROOT/frontend/.env.local" ]; then
  cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env.local"
  echo "Wrote frontend/.env.local"
fi

echo "Installing backend dependencies..."
(cd "$ROOT" && npm ci)
echo "Installing frontend dependencies..."
(cd "$ROOT/frontend" && npm ci)

echo
echo "Done. Start both with:  ./scripts/dev.sh"
