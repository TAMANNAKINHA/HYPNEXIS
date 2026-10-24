# AEGIS Backend Person 2 Security Audit

Audit date: 2026-10-24. Scope: existing backend checkout `Backend-l2-main`; no contract or frontend files were changed.

## Findings and current status

| Requirement | Status | Evidence / remaining limitation |
|---|---|---|
| No fabricated real transaction hashes, receipts, or deployment addresses | Implemented | `src/services/blockchainService.ts` is demo-only; simulated outcomes contain no transaction hash. Mission JSON and Socket.IO state updates omit internal session keys. Legacy audit entries use `simulation`/`not_applicable`, not hash-shaped placeholders. |
| Demo and real execution separated; fail closed | Implemented; real execution unavailable | Legacy mission controls are demo-only. `EXECUTION_MODE=demo` rejects payment API execution. Real API execution remains disabled even with a generic ABI configured because the adapter does not implement `IMissionWallet` UserOperation submission and event decoding. Mocked runtime injection exists for tests and does not broadcast. |
| Payment state transitions, actor/timestamps, expiry, one-time approval binding | Implemented in the JSON store | `src/services/paymentStore.ts`, `src/services/paymentService.ts`, and payment controllers enforce transitions. Approval hash binds mission, recipient, amount, chain, expiry, and agent ID; role tokens separate operator, approver, executor, reader, and admin. Token roles are static shared secrets, not per-user identity or MFA. |
| Idempotency and concurrent budget reservations | Implemented only within one process | In-process uniqueness checks happen before yielding, and approval synchronously reserves against confirmed plus active payments. Retries return persisted records after a process reload; tests cover simultaneous duplicate and competing-approval requests. JSON files have no durable unique constraints or cross-process transaction semantics; do not run multiple workers. |
| Timeout reservations and chain confirmation | Implemented with manual-reconciliation limitation | Hashless ambiguous submissions stay `SUBMITTED`, preserving reservations; hash-backed reconciliation verifies chain, hash, receipt, configured confirmation depth, and configured payment event. Hashless ambiguity cannot be automatically reconciled and requires an operator to investigate chain state. |
| Simulator cannot broadcast | Implemented | `simulate()` has no provider/signer/contract calls and always returns `preview: true` and `broadcasted: false`. Test asserts the preview shape. Fee estimate is only configured-rate arithmetic, not a node gas simulation. |
| Kill switch and on-chain revocation | Backend part implemented; on-chain part blocked | Kill persists backend disablement before response and lists submitted transactions. Responses explicitly report `onChainRevocation.status: not_performed`. `contracts/MissionWallet.sol` has no agent registry or revoke method. `agentId` is supplied by an authenticated operator, not cryptographically bound to an agent identity. |
| Persistence | Partial; production database migration blocked | `src/services/paymentStore.ts` serializes writes in one process and atomically replaces the JSON file; a process crash before rename leaves the previous complete snapshot plus possibly a temp file. It does not fsync the file/directory, provide durable uniqueness constraints, coordinate multiple processes, or protect against power-loss data loss. `src/store.ts` keeps mission budgets and missions in memory. No `pg` driver, PostgreSQL client (`psql`), or configured DB service is available in this checkout, so a PostgreSQL schema/transaction migration could not be safely implemented or verified here. |
| Request validation and secret protection | Partial | Amounts are decimal strings, addresses are nonzero EVM addresses, body size is capped, and `.env.example` contains placeholders only. Static role tokens are shared secrets. Legacy demo mission endpoints do not authenticate. |
| Existing legacy API authorization | Demo-only, not a production security boundary | `src/routes/missionRoutes.ts` demo routes do not use the payment role guards. They return simulated/non-deployed status and cannot transfer assets. Keep unavailable to real-funds use until separately protected. |

## Payment API contract

Base path: `/api/payments`. Authenticate with `Authorization: Bearer <role-token>`.

- `POST /simulate`: reader/operator/admin. Accepts payment proposal JSON; returns `{ simulationId, preview: true, canProceed, estimatedFee, remainingBudgetAfterPayment, warnings, violations, broadcasted: false }`.
- `POST /`: operator/admin. Creates `PENDING`; input fields: `missionId`, nonzero `recipient`, decimal-string `amount`, `chainId`, future `expiresAt`, unique `requestId`, `idempotencyKey`, and `agentId`. Response includes payment and `detailsHash`. Matching retries return the original record; key/request ID reuse with altered details returns 409. Similar metadata returns a warning and is allowed.
- `GET /` and `GET /:id`: reader/admin payment history and status, event records, hash/receipt, approval details hash.
- `POST /:id/approve`: approver/admin; body `{ "detailsHash": "..." }`. Checks current details, expiry, frozen state, and budget before reserving.
- `POST /:id/reject`, `POST /:id/freeze`, `POST /:id/unfreeze`: approver/admin. Unfreezing returns the payment to pending; it requires fresh approval.
- `POST /missions/:missionId/freeze` and `/unfreeze`: approver/admin; freeze stops new payment approvals and unfreeze returns eligible records to pending.
- `POST /:id/execute` and `POST /:id/reconcile`: executor/admin. Execution fails closed until a compatible `IMissionWallet` adapter exists; reconciliation checks known hashes, receipt status, matching event, and confirmation count.
- `POST /agents/:agentId/kill`: admin. Blocks future requests and backend submission for that asserted agent ID. `GET /agents/:agentId/status`: reader/admin and reports backend and on-chain status separately.

Payment states are `PENDING`, `APPROVED`, `SUBMITTED`, `CONFIRMED`, `REJECTED`, `FROZEN`, `EXPIRED`, and `FAILED`. One accounting rule is used by proposal validation, simulation, approval, and execution: `mission.spent` plus confirmed payment records are settled spend; approved/submitted/frozen payment records are reservations; pending/rejected/expired/failed records do not reserve budget. A pending request can therefore appear in history without consuming budget; its approval transaction rechecks and reserves before it becomes executable. The payment API never copies confirmed amounts into `mission.spent`. In the legacy demo, `mission.spent` is set to the whole budget at completion and the mission becomes terminal, so the payment API rejects further use and does not count that spend again. Frozen pending records reserve budget conservatively until unfrozen/rejected/expired.

## Environment and local commands

Copy `.env.example` to `.env`. Set distinct random `PAYMENT_READER_TOKEN`, `PAYMENT_OPERATOR_TOKEN`, `PAYMENT_APPROVER_TOKEN`, `PAYMENT_EXECUTOR_TOKEN`, and `PAYMENT_ADMIN_TOKEN` values (at least 32 characters); placeholder values are rejected. Never commit `.env`. Keep `EXECUTION_MODE=demo` and `USE_REAL_CONTRACT=false`. Blockchain configuration fields are reserved for a future adapter; do not add a signing key or enable real execution until `IMissionWallet` UserOperation submission and receipt verification are implemented.

- Install: `npm install`
- Backend: `npm run dev`
- TypeScript build and automated backend tests: `npm test`
- Existing policy smoke script: `npx tsx test-policy.ts` (logs sample results; it is not an assertion-based automated test)

## Contract and frontend integration actions

Person 1 must supply a reviewed deployed contract/ABI implementing the expected `(address,uint256)` payment method and `PaymentExecuted(address,uint256)` event, on-chain budget/allowlist/freeze/expiry enforcement, authenticated agent revocation, asset/decimal semantics, and replay protection. Confirm ownership and EntryPoint/account architecture before enabling real mode. The current contract only records a different event; it transfers no asset and has no agent revoke path. No local chain verification was possible: `npx hardhat test` exits with “Hardhat only supports ESM projects” because this CommonJS project has no ESM Hardhat test setup, and there is no compatible test contract fixture. No public deployment was attempted.

Person 3 should use role-appropriate bearer tokens, send amounts as decimal strings, store the returned `detailsHash` and submit it unchanged for approval, render payment event history and actual receipt status, distinguish simulation (`preview: true`, `broadcasted: false`) from execution, and display on-chain revocation as not performed. The current API uses a single configured `CONTRACT_ADDRESS` and payment/mission records do not persist across backend restart for mission lookup; coordinate the future API schema and wallet mapping before frontend real-mode integration.

## Reproducible verification and remaining risks

- `npm test`: passed 29/29 backend tests in the Person 2 implementation run; covers state-by-state accounting, invalid inputs, role checks, budget rejection, concurrent duplicate/retry behavior, competing approvals, expiry and detail binding, freeze/kill controls, simulator isolation, execution locking, mocked RPC failures/timeouts, ambiguous reservations, receipt/event/hash verification, success/revert/pending outcomes, and fail-closed real-mode behavior. Tests inject deterministic runtimes; they do not broadcast or sign transactions.
- `npx tsx test-policy.ts`: completed; policy/category/risk examples printed as expected. It contains no assertions.
- `npm run compile`: not verified; Hardhat could not download the Solidity compiler list (`HH502`, network unavailable). No contract or end-to-end chain tests ran.
- PostgreSQL migration: not done. JSON payment storage and in-memory mission storage are not production persistence, do not provide inter-process uniqueness/locking, and should be replaced with PostgreSQL transactions and unique constraints before scaling or real funds.
- Real chain execution and on-chain kill-switch: unverified and blocked on Person 1's compatible contract interface and secure signer path.
