# Final demonstration runbook

Goal: show mission creation -> policy checks -> approval -> on-chain payment -> status everywhere, then show a
hijacked agent being contained. Total ~8 minutes.

## Before the demo (T-15 min)
1. `scripts/setup.sh --frontend ../HYPNEXIX-FRONTEND-main`   (once per machine)
2. `scripts/dev.sh up --frontend ../HYPNEXIX-FRONTEND-main`
3. `npm run doctor`          -> must exit 0
4. `npm run test:e2e`        -> keep the passing output on screen as a backup. (It uses its own throwaway
   chain state; run `scripts/dev.sh up` again afterwards if it restarted the chain.)

Backup plan if anything is red: `scripts/dev.sh down && scripts/dev.sh up`, then re-run `npm run doctor`.

## Script (API view; UI view once INT-004/INT-005 are fixed)
Tokens are in `.env`. `export B=http://localhost:5000 OP=... AP=... EX=... AD=...`

1. **Create a mission**: `POST /api/missions/create {"text":"Buy OpenAI API credits for ₹5,000"}` -> note `mission.id`.
2. **Preview**: `POST /api/payments/simulate` -> `preview:true, broadcasted:false`.
3. **Propose** (operator) -> `PENDING` + `detailsHash`. **Approve** (approver, send `detailsHash`) -> `APPROVED`.
4. **Execute** (executor) -> `CONFIRMED`, `transactionHash`. Show the same hash in
   `.run/chain.log` and in `GET /api/payments/:id`.
5. **Hijack 1 – overspend**: propose 0.1000…01 ETH (above per-tx limit) -> execution refused, balance unchanged.
6. **Hijack 2 – drain loop**: repeated 0.1 ETH payments stop at the 0.5 ETH daily limit.
7. **Hijack 3 – bad recipient**: attacker address refused by the backend; with the backend bypassed it is
   still refused by the contract allowlist.
8. **Kill switch**: `POST /api/payments/agents/<id>/kill` -> new payments 403. State plainly that on-chain
   revocation is *not* performed yet (INT-003).
9. **Freeze mission** -> approved payments become `FROZEN`; unfreeze requires re-approval.

`test/e2e/e2e.test.cjs` performs exactly these steps automatically; use its output as evidence.

## What not to claim
- No guardian recovery, gas sponsorship, automatic anomaly freeze or invariant fuzzing exist in the code yet
  (Phase 2 items owned by Persons 1/2); see PHASE2_READINESS.md.
- The wallet is not yet driven through a real ERC-4337 EntryPoint by the backend; payments go through the
  gateway adapter on a local chain.
