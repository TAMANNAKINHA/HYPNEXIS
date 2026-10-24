# Known bugs and gaps

Last reviewed by Person 4 against the uploaded `HYPNEXIS-main` / `HYPNEXIX-FRONTEND-main` snapshots.
"Not executed here" means found by reading code; confirm on first `npm run test:e2e`.

| ID | Severity | Finding | Owner | Status |
|----|----------|---------|-------|--------|
| BUG-001 | High | Hardhat ESM/v3 mismatch. `package.json` now pins Hardhat ^2.22 and config/scripts use the v2 API, so they agree. Added explicit `localhost` network. | Person 1 | Likely fixed; verify with `npm run setup` (needs network for solc 0.8.20) |
| GAP-001 | High | `MissionWallet.sol` has ERC-4337 entry points (`validateUserOp`/`executeUserOp`) but `nonce()` returns `totalBudget` ("placeholder") and the backend never submits UserOperations. C-06/C-07 depend on this. | Person 1 | Open |
| GAP-002 | Medium | No automated test runner scripts. | Person 4 | **Fixed**: `test:contracts`, `test:payments`, `test:e2e`, `test:all` |
| BUG-002 | Low | `io` package in dependencies looks accidental (socket.io is used). | Person 2 | Open (left untouched; owner's file) |
| BUG-003 | Low | Backend README describes routes/folders that do not match code. | Person 2 | Open |
| BUG-004 | Low | Frontend repo contains a 30 MB `aegis-project.zip`. | Person 3 | Open |
| BUG-005 | Info | Frontend package name is still `vite-react-typescript-starter`. | Person 3 | Open |
| BUG-006 | Low | `scripts/deploy.ts` compares `network.chainId` (bigint) with numbers using `===`, so the explorer URL branch never prints. Superseded for local work by `deploy-local.ts`. | Person 1/4 | Open |
| BUG-007 | Low | `.env.example` placeholders are rejected by the backend, so a plain copy gives 401 everywhere. | Person 4 | **Fixed**: `scripts/gen-env.cjs`, documented in SETUP.md |
| INT-001 | High | Adapter/contract ABI mismatch: backend calls `execute(address,uint256)` and needs `PaymentExecuted(address indexed,uint256)`; wallet exposes `executePayment(address,uint256)` and a 5-argument `PaymentExecuted`. Real-contract confirmation therefore cannot succeed against `MissionWallet` directly. | Person 1 + 2 | **Mitigated** by `contracts/mocks/AgentPaymentGateway.sol` (wallet still enforces all limits). Needs a decision on the permanent design. |
| INT-002 | Medium | If the chain call reverts at gas estimation (over-limit, bad recipient), `executePayment` has already moved the record to `SUBMITTED` and, with no tx hash, keeps it there ("ambiguous"). A deterministic revert is not ambiguous; the UI will show "submitted" and the reservation stays held. Safe (no funds move) but misleading. | Person 2 | Open - e2e ATTACK-1 accepts `SUBMITTED` or `FAILED` and fails on `CONFIRMED` |
| INT-003 | High | Kill switch is not enforced on-chain. `_isEmergencyKilled()` is a stub returning `false`; `emergencyKillAll()` only emits an event; per-agent kills do not apply to the owner/gateway payment path; `POST /agents/:id/kill` reports `onChainRevocation: not_performed`. I-03 stays BLOCKED. | Person 1 + 2 | Open |
| INT-004 | High | In `real` mode every payment needs `MISSION_RECIPIENTS_JSON[<mission id>]`, but mission IDs are random UUIDs created at runtime, so no payment can pass policy in a live demo. `patches/0001-mission-recipient-wildcard.patch` adds an optional `"*"` fallback (2 lines, `git apply`). | Person 2 | Open - patch provided, not applied |
| INT-005 | High | Frontend payments client (`paymentsApi.ts`) sends no `Authorization` header and no `detailsHash`; backend requires role tokens and returns `{success,message}` / ISO timestamps / `events[].to,at`, while the frontend expects `{error,code}`, numeric timestamps and `events[].status,timestamp`. It only works in `VITE_USE_MOCK=true`. | Person 3 + 2 | Open |
| INT-006 | Medium | Frontend calls routes that do not exist: `POST /api/missions/cancel-pending`, `POST /api/missions/toggle-policy`, `GET /api/agents`, `POST /api/agents/:id/kill-switch` (backend has `POST /api/payments/agents/:id/kill`). Detected by `npm run check:api`. | Person 3 + 2 | Open |
| INT-007 | Low | The legacy mission `/execute` path still uses a mock chain (`BlockchainService` returns random hashes even with `USE_REAL_CONTRACT=true`), so mission "payments" and `/api/payments` can show different truths. | Person 2 | Open |
| INT-008 | Low | Express rate limit (100 req / 15 min / IP) applies to every `/api/` call; a long demo or repeated attack simulations from one IP can hit 429. | Person 2 | Open |

## Phase 2 features not present in the code
Guardian recovery (3 of 5, 48 h delay, owner veto), per-agent gas sponsorship quota, automatic freeze on
unusual spending with detection/false-freeze metrics, and invariant fuzzing do not exist yet. This is
tracked in PHASE2_READINESS.md; QA hooks for them are listed there.
