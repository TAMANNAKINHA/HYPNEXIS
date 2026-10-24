# AEGIS Backend Person 2 Security Audit

Audit date: 2026-10-24. Scope: existing backend checkout `Backend-l2-main`; no contract or frontend files were changed.

## Findings and current status

| Requirement | Status | Evidence / remaining limitation |
|---|---|---|
| No fabricated real transaction hashes, receipts, or deployment addresses | Implemented | `src/services/blockchainService.ts` is explicitly demo-only and emits a `demoId`; the payment execution path uses ethers transaction response hashes and receipts. `test/paymentLifecycle.test.cjs` verifies incomplete real configuration yields no hash/receipt. |
| Demo and real execution separated; fail closed | Implemented with a contract blocker | `EXECUTION_MODE=demo` rejects payment API execution. Real mode requires RPC, key, chain, address, ABI, deployed bytecode, global and per-mission recipient allowlists, a state-changing `execute(address,uint256)` method, and matching `PaymentExecuted(address,uint256)` receipt event. The checked-in contract is incompatible, so no real payment is currently executable. |
| Payment state transitions, actor/timestamps, expiry, one-time approval binding | Implemented in the JSON store | `src/services/paymentStore.ts`, `src/services/paymentService.ts`, and payment controllers enforce transitions. Approval hash binds mission, recipient, amount, chain, expiry, and agent ID; role tokens separate operator, approver, executor, reader, and admin. Token roles are static shared secrets, not per-user identity or MFA. |
| Idempotency and concurrent budget reservations | Implemented only within one process | In-process uniqueness checks happen before yielding, and approval synchronously reserves against confirmed plus active payments. Retries return persisted records after a process reload; tests cover simultaneous duplicate and competing-approval requests. JSON files have no durable unique constraints or cross-process transaction semantics; do not run multiple workers. |
| Timeout reservations and chain confirmation | Implemented with manual-reconciliation limitation | Hashless ambiguous submissions stay `SUBMITTED`, preserving reservations; hash-backed reconciliation verifies chain, hash, receipt, configured confirmation depth, and configured payment event. Hashless ambiguity cannot be automatically reconciled and requires an operator to investigate chain state. |
| Simulator cannot broadcast | Implemented | `simulate()` has no provider/signer/contract calls and always returns `preview: true` and `broadcasted: false`. Test asserts the preview shape. Fee estimate is only configured-rate arithmetic, not a node gas simulation. |
| Kill switch and on-chain revocation | Backend part implemented; on-chain part blocked | Kill persists backend disablement before response and lists submitted transactions. Responses explicitly report `onChainRevocation.status: not_performed`. `contracts/MissionWallet.sol` has no agent registry or revoke method. `agentId` is supplied by an authenticated operator, not cryptographically bound to an agent identity. |
| Persistence | Partial; production database migration blocked | `src/services/paymentStore.ts` serializes writes in one process and atomically replaces the JSON file; a process crash before rename leaves the previous complete snapshot plus possibly a temp file. It does not fsync the file/directory, provide durable uniqueness constraints, coordinate multiple processes, or protect against power-loss data loss. `src/store.ts` keeps mission budgets and missions in memory. No `pg` driver, PostgreSQL client (`psql`), or configured DB service is available in this checkout, so a PostgreSQL schema/transaction migration could not be safely implemented or verified here. |
| Request validation and secret protection | Partial | Amounts are decimal strings, addresses are nonzero EVM addresses, body size is capped, and `.env.example` contains placeholders only. A signing key is still a hot private key in the backend environment in real mode; use a signer service/HSM before production. |
| Existing legacy API authorization | Demo-only, not a production security boundary | `src/routes/missionRoutes.ts` legacy demo routes do not use the new role guards. They still call `BlockchainService` simulation, and the checked-in `MissionWallet` cannot transfer assets. Keep legacy routes unavailable to real-funds use until separately protected. |

## Payment API contract

Base path: `/api/payments`. Authenticate with `Authorization: Bearer <role-token>`.

- `POST /simulate`: reader/operator/admin. Accepts payment proposal JSON; returns `{ simulationId, preview: true, canProceed, estimatedFee, remainingBudgetAfterPayment, warnings, violations, broadcasted: false }`.
- `POST /`: operator/admin. Creates `PENDING`; input fields: `missionId`, nonzero `recipient`, decimal-string `amount`, `chainId`, future `expiresAt`, unique `requestId`, `idempotencyKey`, and `agentId`. Response includes payment and `detailsHash`. Matching retries return the original record; key/request ID reuse with altered details returns 409. Similar metadata returns a warning and is allowed.
- `GET /` and `GET /:id`: reader/admin payment history and status, event records, hash/receipt, approval details hash.
- `POST /:id/approve`: approver/admin; body `{ "detailsHash": "..." }`. Checks current details, expiry, frozen state, and budget before reserving.
- `POST /:id/reject`, `POST /:id/freeze`, `POST /:id/unfreeze`: approver/admin. Unfreezing returns the payment to pending; it requires fresh approval.
- `POST /missions/:missionId/freeze` and `/unfreeze`: approver/admin; freeze stops new payment approvals and unfreeze returns eligible records to pending.
- `POST /:id/execute` and `POST /:id/reconcile`: executor/admin. Execution is disabled unless explicitly configured in real mode; reconciliation checks receipt status and confirmation count.
- `POST /agents/:agentId/kill`: admin. Blocks future requests and backend submission for that asserted agent ID. `GET /agents/:agentId/status`: reader/admin and reports backend and on-chain status separately.

Payment states are `PENDING`, `APPROVED`, `SUBMITTED`, `CONFIRMED`, `REJECTED`, `FROZEN`, `EXPIRED`, and `FAILED`. One accounting rule is used by proposal validation, simulation, approval, and execution: `mission.spent` plus confirmed payment records are settled spend; approved/submitted/frozen payment records are reservations; pending/rejected/expired/failed records do not reserve budget. A pending request can therefore appear in history without consuming budget; its approval transaction rechecks and reserves before it becomes executable. The payment API never copies confirmed amounts into `mission.spent`. In the legacy demo, `mission.spent` is set to the whole budget at completion and the mission becomes terminal, so the payment API rejects further use and does not count that spend again. Frozen pending records reserve budget conservatively until unfrozen/rejected/expired.

## Environment and local commands

Copy `.env.example` to `.env`. Set separate random `PAYMENT_READER_TOKEN`, `PAYMENT_OPERATOR_TOKEN`, `PAYMENT_APPROVER_TOKEN`, `PAYMENT_EXECUTOR_TOKEN`, and break-glass `PAYMENT_ADMIN_TOKEN` (at least 32 characters); placeholder values are rejected. Never commit `.env`. Keep `EXECUTION_MODE=demo`. `RPC_URL`, `CHAIN_ID`, `CONTRACT_ADDRESS`, `CONTRACT_ABI`, `CONTRACT_EXECUTE_METHOD`, `CONTRACT_EXECUTION_EVENT`, `PRIVATE_KEY`, `PAYMENT_DECIMALS`, `CONFIRMATIONS`, and `RECIPIENT_ALLOWLIST` are needed for the real adapter, but do not enable it with the checked-in contract.

- Install: `npm install`
- Backend: `npm run dev`
- TypeScript build and automated backend tests: `npm test`
- Existing policy smoke script: `npx tsx test-policy.ts` (logs sample results; it is not an assertion-based automated test)

## Contract and frontend integration actions

Person 1 must supply a reviewed deployed contract/ABI implementing the expected `(address,uint256)` payment method and `PaymentExecuted(address,uint256)` event, on-chain budget/allowlist/freeze/expiry enforcement, authenticated agent revocation, asset/decimal semantics, and replay protection. Confirm ownership and EntryPoint/account architecture before enabling real mode. The current contract only records a different event; it transfers no asset and has no agent revoke path. No local chain verification was possible: `npx hardhat test` exits with “Hardhat only supports ESM projects” because this CommonJS project has no ESM Hardhat test setup, and there is no compatible test contract fixture. No public deployment was attempted.

Person 3 should use role-appropriate bearer tokens, send amounts as decimal strings, store the returned `detailsHash` and submit it unchanged for approval, render payment event history and actual receipt status, distinguish simulation (`preview: true`, `broadcasted: false`) from execution, and display on-chain revocation as not performed. The current API uses a single configured `CONTRACT_ADDRESS` and payment/mission records do not persist across backend restart for mission lookup; coordinate the future API schema and wallet mapping before frontend real-mode integration.

## Reproducible verification and remaining risks

- `npm test`: passed 25/25 backend tests; includes state-by-state accounting, invalid inputs, role checks for every payment controller, budget rejection, concurrent duplicate creation plus retry after reload, competing approvals, similar legitimate payments, approval expiry/reuse/detail binding, freeze behavior, kill switch, simulator isolation, execution locking, RPC preflight/send/wait failures, ambiguous reservations, receipt/event/hash matching, success/revert/pending outcomes, and real-mode fail-closed behavior. Execution tests inject a deterministic RPC runtime; they do not broadcast or sign transactions.
- `npx tsx test-policy.ts`: completed; policy/category/risk examples printed as expected. It contains no assertions.
- `npx hardhat test`: blocked by the ESM requirement noted above; no contract or end-to-end chain tests ran.
- PostgreSQL migration: not done. JSON payment storage and in-memory mission storage are not production persistence, do not provide inter-process uniqueness/locking, and should be replaced with PostgreSQL transactions and unique constraints before scaling or real funds.
- Real chain execution and on-chain kill-switch: unverified and blocked on Person 1's compatible contract interface and secure signer path.
