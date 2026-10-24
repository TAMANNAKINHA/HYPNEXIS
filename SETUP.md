# Setup (clean checkout)

Required: Node >= 20, npm >= 10, git, curl, bash (Linux/macOS/WSL). No real funds or real keys are needed
anywhere in this guide: the local chain uses Hardhat's public test accounts.

Repos are siblings:

    workspace/
      HYPNEXIS-main/            <- this repo (backend + contracts + scripts)
      HYPNEXIX-FRONTEND-main/   <- frontend

## 1. One-command setup

    cd HYPNEXIS-main
    scripts/setup.sh --frontend ../HYPNEXIX-FRONTEND-main

This installs dependencies (`npm ci`), creates `.env` **with freshly generated payment tokens**, compiles the
contracts, builds the backend and typechecks/builds the frontend. Re-running it is safe.

> Why generated tokens? The backend ignores any `PAYMENT_*_TOKEN` shorter than 32 characters or starting with
> `replace-with-`, so copying `.env.example` unchanged makes every `/api/payments` call return 401.
> `node scripts/gen-env.cjs` fills them in; add `--force` to rotate them.

## 2. Start the whole stack

    scripts/dev.sh up --frontend ../HYPNEXIX-FRONTEND-main      # chain + deploy + backend + frontend
    scripts/dev.sh status
    scripts/dev.sh down

| Service  | URL                    | Log                |
|----------|------------------------|--------------------|
| Chain    | http://127.0.0.1:8545  | `.run/chain.log`   |
| Backend  | http://localhost:5000  | `.run/backend.log` |
| Frontend | http://localhost:5173  | `.run/frontend.log`|

`up` runs `scripts/deploy-local.ts`, which writes `deployments/localhost.json` and updates `.env`
(`EXECUTION_MODE=real`, `RPC_URL`, `CHAIN_ID=1337`, `CONTRACT_ADDRESS`, `CONTRACT_ABI`, `PRIVATE_KEY` = Hardhat
account #0, recipient allowlist). Use `--demo` to deploy but keep `EXECUTION_MODE=demo`.

Restarting the chain wipes it: run `npm run deploy:local` again (or `scripts/dev.sh up`) afterwards.

## 3. Verify

    npm run doctor        # pre-demo health check, non-zero exit if something is missing
    npm run test          # contract tests + payment-service tests
    npm run test:e2e      # full end-to-end run on a throwaway chain (see TEST_MATRIX.md)
    npm run check:api -- ../HYPNEXIX-FRONTEND-main   # frontend/backend route contract

## 4. Command reference

| Command | What it does |
|---------|--------------|
| `npm run setup` | same as `scripts/setup.sh` |
| `npm run chain -- start\|stop\|status` | local Hardhat node, chainId 1337 |
| `npm run deploy:local` | deploy EntryPointMock, MissionWallet, AgentPaymentGateway; write `deployments/` and `.env` |
| `npm run stack -- up\|down\|status\|logs` | whole stack |
| `npm run test:contracts` | `hardhat test test/MissionWallet.test.ts` |
| `npm run test:payments` | build + `node --test test/paymentLifecycle.test.cjs` |
| `npm run test:e2e` | `scripts/e2e.sh` |
| `npm run doctor` | readiness check |

## 5. Frontend configuration

`HYPNEXIX-FRONTEND-main/.env.example` -> `.env.local`:

- `VITE_BACKEND_URL` — backend base URL (default `http://localhost:5000`).
- `VITE_USE_MOCK` — payments screens use mock data unless this is exactly `false`. Keep `true` until INT-005
  in `KNOWN_BUGS.md` is fixed (the frontend does not yet send the bearer tokens the payments API requires).

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Every `/api/payments` call returns 401 | tokens are placeholders: `node scripts/gen-env.cjs` then restart backend |
| `execute` returns 409 "disabled in demo mode" | `EXECUTION_MODE=demo`; run `npm run deploy:local` (sets `real`) |
| `Recipient is not authorized for this mission` in real mode | `MISSION_RECIPIENTS_JSON` has no entry for the runtime mission ID; apply `patches/0001-mission-recipient-wildcard.patch` (INT-004) |
| `gateway has no code` / `CONTRACT_ADDRESS has no deployed contract code` | chain was restarted; re-run `npm run deploy:local` |
| `EADDRINUSE` 5000 / 8545 / 5173 | `scripts/dev.sh down`, or change `PORT` / `HARDHAT_PORT` |
| CORS errors in browser | `FRONTEND_URL` in backend `.env` must equal the frontend origin |
| `HH` compiler download errors | first compile needs network to fetch solc 0.8.20; afterwards it is cached |
| 429 "Too many requests" | backend rate limit is 100 requests / 15 min / IP; restart backend between long demo runs |

## Safety rules

- Never commit `.env` or any real private key. `.gitignore` excludes `.env*` (except `.env.example`), `data/`,
  `deployments/*.json`, `.run/`.
- The Hardhat key in `.env` is public knowledge and only valid on chainId 1337. `deploy-local.ts` refuses any
  other chain.
- Testnet deployment is manual and follows `DEPLOYMENT_CHECKLIST.md`; it needs a throwaway, faucet-funded key.
